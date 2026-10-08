use super::*;
use std::cell::Cell;

struct ReadOnly<'a> {
    tpm: ProofResult<()>,
    prf: ProofResult<()>,
    prf_key: [u8; 32],
    secret: [u8; 32],
    auths: &'a Cell<usize>,
    decrypts: &'a Cell<usize>,
    cancel: bool,
}
impl Reader for ReadOnly<'_> {
    fn reopen_tpm(&mut self, _: &Header) -> ProofResult<()> {
        self.tpm
    }
    fn reopen_prf(&mut self, _: &Header) -> ProofResult<()> {
        self.prf
    }
    fn authorize(&mut self) -> ProofResult<Zeroizing<[u8; 32]>> {
        self.auths.set(self.auths.get() + 1);
        if self.cancel {
            return Err(Failure {
                status: Outcome::Cancelled,
                code: Some(0x80090036),
                operation: Some("webauthn-prf-assertion"),
            });
        }
        Ok(Zeroizing::new(self.prf_key))
    }
    fn unwrap(&mut self, cipher: &[u8]) -> ProofResult<Zeroizing<Vec<u8>>> {
        self.decrypts.set(self.decrypts.get() + 1);
        assert_eq!(cipher, [5; 256]);
        Ok(Zeroizing::new(self.secret.to_vec()))
    }
}
fn fixture() -> Record {
    libsodium_rs::ensure_init().unwrap();
    let mut r = Record::new(&uuid::Uuid::new_v4().to_string());
    r.header.copy_context = Some(Context::new(
        &r.header.salt,
        b"source-install",
        b"source-account",
    ));
    r.header.credential = vec![4; 32];
    r.header.public = vec![2; 256];
    r.header.name = vec![3; 34];
    r.header.expected = Sha256::digest([19; 32]).into();
    r.seal(&[5; 256], &[7; 32]).unwrap();
    r.ready = true;
    r
}
fn missing_tpm() -> ProofResult<()> {
    Err(Failure {
        status: Outcome::Failed,
        code: Some(0x80090016),
        operation: Some("tpm-reopen-exact-test-key"),
    })
}
fn missing_prf() -> ProofResult<()> {
    Err(invalid("combined-credential-missing"))
}
fn reader<'a>(auths: &'a Cell<usize>, decrypts: &'a Cell<usize>) -> ReadOnly<'a> {
    ReadOnly {
        tpm: Ok(()),
        prf: Ok(()),
        prf_key: [7; 32],
        secret: [19; 32],
        auths,
        decrypts,
        cancel: false,
    }
}
#[test]
fn source_roundtrip_authenticates_context_and_reports_same_file_digest_without_secrets() {
    let r = fixture();
    let bytes = encode(&r).unwrap();
    let original = bytes.clone();
    let auths = Cell::new(0);
    let decrypts = Cell::new(0);
    let report = inspect(
        &bytes,
        |salt| Ok(Context::new(salt, b"source-install", b"source-account")),
        |_| reader(&auths, &decrypts),
        &|| true,
    );
    assert_eq!(report.outcome, "copy-source-roundtrip-passed");
    assert_eq!((auths.get(), decrypts.get()), (1, 1));
    assert_eq!(bytes, original);
    let json = serde_json::to_value(&report).unwrap();
    assert!(json.get("combinedState").is_none());
    assert_eq!(
        json["copyEvidence"]["fileSha256"],
        format!("{:x}", Sha256::digest(&bytes))
    );
    assert_eq!(
        json["copyEvidence"]["contextRelation"],
        "same-account-and-installation"
    );
    assert_eq!(json["processScope"], "not-measured");
    for field in ["eligible", "enrolled", "unlocked"] {
        assert_eq!(json[field], false);
    }
    for field in [
        "salt",
        "credential",
        "public",
        "name",
        "nonce",
        "ciphertext",
        "account",
        "installation",
    ] {
        assert!(!serde_json::to_string(&report)
            .unwrap()
            .contains(&format!("\"{field}\":")));
    }
}
#[test]
fn different_account_and_installation_require_native_absence_not_just_context_labels() {
    for (install, account, relation) in [
        (
            b"source-install".as_slice(),
            b"other-account".as_slice(),
            "different-account",
        ),
        (
            b"other-install",
            b"source-account",
            "different-installation",
        ),
    ] {
        for (tpm, prf) in [
            (missing_tpm(), missing_prf()),
            (missing_tpm(), Ok(())),
            (Ok(()), missing_prf()),
        ] {
            let r = fixture();
            let bytes = encode(&r).unwrap();
            let auths = Cell::new(0);
            let decrypts = Cell::new(0);
            let report = inspect(
                &bytes,
                |salt| Ok(Context::new(salt, install, account)),
                |_| ReadOnly {
                    tpm,
                    prf,
                    ..reader(&auths, &decrypts)
                },
                &|| true,
            );
            assert_eq!(report.outcome, "copy-isolation-observed");
            assert_eq!(report.copy_evidence.unwrap().context_relation, relation);
            assert_eq!((auths.get(), decrypts.get()), (0, 0));
            assert!(report.checks.iter().all(|c| c.status == Outcome::Passed));
        }
    }
}
#[test]
fn foreign_context_that_can_decrypt_is_a_failure_and_cancellation_is_not_isolation() {
    for cancel in [false, true] {
        let r = fixture();
        let bytes = encode(&r).unwrap();
        let auths = Cell::new(0);
        let decrypts = Cell::new(0);
        let report = inspect(
            &bytes,
            |salt| Ok(Context::new(salt, b"foreign", b"foreign")),
            |_| ReadOnly {
                cancel,
                ..reader(&auths, &decrypts)
            },
            &|| true,
        );
        assert_eq!(report.outcome, if cancel { "cancelled" } else { "blocked" });
        assert_eq!(decrypts.get(), usize::from(!cancel));
        assert!(report.checks.iter().any(|c| c.status != Outcome::Passed));
    }
}
#[test]
fn provider_permission_wrong_operation_and_unsupported_errors_never_count_as_copy_resistance() {
    for error in [
        Failure {
            status: Outcome::Failed,
            code: Some(0x80090016),
            operation: Some("open-platform-crypto-provider"),
        },
        Failure {
            status: Outcome::Failed,
            code: Some(0x80090010),
            operation: Some("tpm-reopen-exact-test-key"),
        },
        Failure {
            status: Outcome::Failed,
            code: Some(0x8009000a),
            operation: Some("tpm-reopen-exact-test-key"),
        },
        Failure {
            status: Outcome::Cancelled,
            code: Some(0x80090036),
            operation: Some("tpm-reopen-exact-test-key"),
        },
    ] {
        let r = fixture();
        let bytes = encode(&r).unwrap();
        let auths = Cell::new(0);
        let decrypts = Cell::new(0);
        let report = inspect(
            &bytes,
            |salt| Ok(Context::new(salt, b"foreign", b"foreign")),
            |_| ReadOnly {
                tpm: Err(error),
                prf: missing_prf(),
                ..reader(&auths, &decrypts)
            },
            &|| true,
        );
        assert_ne!(report.outcome, "copy-isolation-observed");
        assert_eq!(report.copy_evidence.as_ref().unwrap().tpm_access, "error");
        assert_eq!(
            report.copy_evidence.as_ref().unwrap().passkey_access,
            "missing"
        );
        assert_eq!(auths.get(), 0);
    }
}
#[test]
fn a_source_with_lost_keys_is_not_a_successful_control() {
    let r = fixture();
    let bytes = encode(&r).unwrap();
    let auths = Cell::new(0);
    let decrypts = Cell::new(0);
    let report = inspect(
        &bytes,
        |salt| Ok(Context::new(salt, b"source-install", b"source-account")),
        |_| ReadOnly {
            tpm: missing_tpm(),
            prf: missing_prf(),
            ..reader(&auths, &decrypts)
        },
        &|| true,
    );
    assert_eq!(report.outcome, "blocked");
    assert_eq!(auths.get(), 0);
}
#[test]
fn malformed_oversized_unready_legacy_and_unknown_fields_are_rejected_before_native_access() {
    let r = fixture();
    let bytes = encode(&r).unwrap();
    let mut unknown: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    unknown["secret"] = serde_json::json!("forbidden");
    let mut unready = r.clone();
    unready.ready = false;
    assert!(encode(&unready).is_err());
    let mut legacy = r.clone();
    legacy.header.copy_context = None;
    assert!(encode(&legacy).is_err());
    let mut bad_version: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    bad_version["version"] = 2.into();
    let mut traversal: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    traversal["record"]["header"]["id"] = "../../arbitrary".into();
    for bytes in [
        b"{".to_vec(),
        vec![b' '; MAX_RECORD + 1],
        serde_json::to_vec(&unknown).unwrap(),
        serde_json::to_vec(&r).unwrap(),
        serde_json::to_vec(&bad_version).unwrap(),
        serde_json::to_vec(&traversal).unwrap(),
    ] {
        let auths = Cell::new(0);
        let decrypts = Cell::new(0);
        let report = inspect(
            &bytes,
            |_| panic!("invalid file must not query identity"),
            |_| reader(&auths, &decrypts),
            &|| true,
        );
        assert_eq!(report.outcome, "blocked");
        assert_eq!(report.checks[0].test, "copy-file-validate");
        assert_eq!(auths.get(), 0);
    }
}
#[test]
fn context_is_salted_authenticated_and_never_alters_legacy_envelope_encoding() {
    let mut r = fixture();
    let origin = r.header.copy_context.clone().unwrap();
    r.header.copy_context = Some(Context::new(&r.header.salt, b"changed", b"source-account"));
    assert!(r.open(&[7; 32]).is_err());
    r.header.copy_context = Some(origin);
    assert!(r.open(&[7; 32]).is_ok());
    assert_ne!(
        Context::new(&[1; 32], b"i", b"a"),
        Context::new(&[2; 32], b"i", b"a")
    );
    r.header.copy_context = None;
    let aad = String::from_utf8(r.header.aad()).unwrap();
    assert!(!aad.contains("copy_context"));
    let decoded: Record = serde_json::from_slice(&serde_json::to_vec(&r).unwrap()).unwrap();
    assert!(decoded.header.copy_context.is_none());
}
#[test]
fn copy_file_export_is_exclusive_and_import_does_not_modify_it_or_a_local_journal() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("test.hello-test");
    let r = fixture();
    let bytes = encode(&r).unwrap();
    write_file(&path, &bytes).unwrap();
    assert_eq!(fs::read(&path).unwrap(), bytes);
    assert!(write_file(&path, &bytes).is_err());
    let journal = dir.path().join("hello-combined-test");
    fs::create_dir(&journal).unwrap();
    fs::write(journal.join("test.json"), b"unrelated corrupt journal").unwrap();
    let auths = Cell::new(0);
    let decrypts = Cell::new(0);
    inspect(
        &io::read(&path, MAX_RECORD).unwrap(),
        |salt| Ok(Context::new(salt, b"source-install", b"source-account")),
        |_| reader(&auths, &decrypts),
        &|| true,
    );
    assert_eq!(
        fs::read(journal.join("test.json")).unwrap(),
        b"unrelated corrupt journal"
    );
    assert_eq!(fs::read(&path).unwrap(), bytes);
    assert!(exported(
        &r,
        &bytes,
        &Context::new(&r.header.salt, b"other", b"other")
    )
    .is_err());
}
#[test]
fn stale_import_does_not_touch_native_keys_or_return_success() {
    let r = fixture();
    let bytes = encode(&r).unwrap();
    let auths = Cell::new(0);
    let decrypts = Cell::new(0);
    let report = inspect(
        &bytes,
        |_| panic!("stale must not inspect context"),
        |_| reader(&auths, &decrypts),
        &|| false,
    );
    assert_eq!(report.outcome, "interrupted");
    assert_eq!(auths.get(), 0);
}
#[test]
fn copy_record_cannot_be_consumed_by_the_restart_action() {
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let mut r = fixture();
    j.save(&r).unwrap();
    let p = uuid::Uuid::new_v4().to_string();
    let mut b = super::super::tests::Fake::new(&j);
    assert_eq!(state(Some(&r), &p), "copy-ready");
    let report = execute(
        &j,
        &mut r,
        &mut b,
        super::super::Action::Resume,
        &p,
        &|| true,
    );
    assert_eq!(report.outcome, "copy-ready");
    assert!(j.read().unwrap().unwrap().ready);
}
