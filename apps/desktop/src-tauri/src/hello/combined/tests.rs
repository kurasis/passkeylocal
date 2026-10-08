use super::*;
use std::cell::Cell;
pub(super) struct Fake<'a> {
    journal: &'a Journal,
    secret: [u8; 32],
    key: [u8; 32],
    authorizations: usize,
    decryptions: usize,
    prf_deletes: usize,
    tpm_deletes: usize,
    fail: Option<&'static str>,
    prf_missing: bool,
    tpm_missing: bool,
    stale_after_auth: Option<&'a Cell<bool>>,
    stale_after_delete: Option<&'a Cell<bool>>,
}
impl<'a> Fake<'a> {
    pub(super) fn new(journal: &'a Journal) -> Self {
        Self {
            journal,
            secret: [0; 32],
            key: [13; 32],
            authorizations: 0,
            decryptions: 0,
            prf_deletes: 0,
            tpm_deletes: 0,
            fail: None,
            prf_missing: false,
            tpm_missing: false,
            stale_after_auth: None,
            stale_after_delete: None,
        }
    }
    fn result(&self, step: &'static str) -> ProofResult<()> {
        if self.fail == Some(step) {
            Err(invalid(step))
        } else {
            Ok(())
        }
    }
}
impl Reader for Fake<'_> {
    fn reopen_tpm(&mut self, _: &Header) -> ProofResult<()> {
        self.result("reopen")?;
        self.result("tpm-reopen")?;
        if self.tpm_missing {
            return Err(Failure {
                status: Outcome::Failed,
                code: Some(0x80090016),
                operation: Some("tpm-reopen-exact-test-key"),
            });
        }
        Ok(())
    }
    fn reopen_prf(&mut self, _: &Header) -> ProofResult<()> {
        self.result("prf-reopen")?;
        if self.prf_missing {
            return Err(invalid("combined-credential-missing"));
        }
        Ok(())
    }
    fn authorize(&mut self) -> ProofResult<Zeroizing<[u8; 32]>> {
        self.authorizations += 1;
        if self.fail == Some("cancel") {
            return Err(Failure {
                status: Outcome::Cancelled,
                code: Some(0x800704c7),
                operation: Some("webauthn-prf-assertion"),
            });
        }
        self.result("authorize")?;
        if let Some(stale) = self.stale_after_auth {
            stale.set(false);
        }
        Ok(Zeroizing::new(self.key))
    }
    fn unwrap(&mut self, cipher: &[u8]) -> ProofResult<Zeroizing<Vec<u8>>> {
        self.decryptions += 1;
        self.result("unwrap")?;
        if cipher != [5; 256] {
            return Err(invalid("fake-cipher"));
        }
        Ok(Zeroizing::new(self.secret.to_vec()))
    }
}
impl Backend for Fake<'_> {
    fn initialize(&mut self) -> ProofResult<()> {
        self.result("preflight")
    }
    fn create_tpm(&mut self) -> ProofResult<(Vec<u8>, Vec<u8>)> {
        assert!(self.journal.read().unwrap().is_some());
        self.result("tpm-create")?;
        Ok((vec![2; 256], vec![3; 34]))
    }
    fn create_prf(&mut self) -> ProofResult<(Vec<u8>, Zeroizing<[u8; 32]>)> {
        assert!(self.journal.read().unwrap().is_some());
        self.result("prf-create")?;
        Ok((vec![4; 32], Zeroizing::new(self.key)))
    }

    fn wrap(&mut self, secret: &[u8; 32]) -> ProofResult<Vec<u8>> {
        self.secret = *secret;
        self.result("wrap")?;
        Ok(vec![5; 256])
    }

    fn cleanup_prf(&mut self) -> ProofResult<()> {
        assert!(!self.journal.read().unwrap().unwrap().ready);
        self.prf_deletes += 1;
        self.result("delete-prf")?;
        self.prf_missing = true;
        if let Some(current) = self.stale_after_delete {
            current.set(false);
        }
        Ok(())
    }
    fn cleanup_tpm(&mut self) -> ProofResult<()> {
        assert!(!self.journal.read().unwrap().unwrap().ready);
        self.tpm_deletes += 1;
        self.result("delete-tpm")?;
        self.tpm_missing = true;
        Ok(())
    }
}
fn initialized() {
    libsodium_rs::ensure_init().unwrap();
    assert!(aes::is_available());
}
fn process() -> String {
    uuid::Uuid::new_v4().to_string()
}
#[test]
fn restart_requires_a_new_process_and_two_new_authorizations_then_cleans_both_objects() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let p1 = process();
    let p2 = process();
    let mut r = Record::new(&p1);
    let mut b = Fake::new(&j);
    let report = execute(&j, &mut r, &mut b, Action::Prepare, &p1, &|| true);
    assert_eq!(report.outcome, "restart-required");
    assert_eq!((b.authorizations, b.decryptions), (1, 1));
    let stored = fs::read(&j.path).unwrap();
    assert!(!stored.windows(32).any(|w| w == b.secret || w == b.key));
    assert!(!String::from_utf8(stored)
        .unwrap()
        .contains(&serde_json::to_string(&b.secret).unwrap()));
    assert_eq!(
        execute(&j, &mut r, &mut b, Action::Resume, &p1, &|| true).outcome,
        "restart-required"
    );
    assert_eq!(b.authorizations, 1);
    let mut reopened = j.read().unwrap().unwrap();
    let mut fresh = Fake::new(&j);
    fresh.secret = b.secret;
    let report = execute(&j, &mut reopened, &mut fresh, Action::Resume, &p2, &|| true);
    assert_eq!(report.outcome, "combined-restart-passed");
    assert_eq!(report.process_scope, "fresh-process");
    assert_eq!(
        (
            fresh.authorizations,
            fresh.decryptions,
            fresh.prf_deletes,
            fresh.tpm_deletes
        ),
        (2, 2, 1, 1)
    );
    assert!(j.read().unwrap().is_none());
    let json = serde_json::to_value(report).unwrap();
    for field in ["eligible", "enrolled", "unlocked"] {
        assert_eq!(json[field], false);
    }
    for forbidden in [
        "credential",
        "salt",
        "public",
        "name",
        "expected",
        "ciphertext",
        "nonce",
    ] {
        assert!(json.get(forbidden).is_none());
    }
}
#[test]
fn all_preparation_failures_attempt_both_cleanup_paths() {
    initialized();
    for fault in [
        "preflight",
        "tpm-create",
        "prf-create",
        "wrap",
        "authorize",
        "unwrap",
    ] {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let p = process();
        let mut r = Record::new(&p);
        let mut b = Fake::new(&j);
        b.fail = Some(fault);
        let report = execute(&j, &mut r, &mut b, Action::Prepare, &p, &|| true);
        assert_eq!(report.outcome, "blocked", "{fault}");
        assert_eq!((b.prf_deletes, b.tpm_deletes), (1, 1));
        assert!(j.read().unwrap().is_none());
    }
}
#[test]
fn interrupted_creation_is_recoverable_from_the_precreation_journal() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let p = process();
    let j = Journal::open(dir.path()).unwrap();
    let r = Record::new(&p);
    j.save(&r).unwrap();
    // Simulate a crash after the OS created an object but before returning its ID.
    drop(j);
    let j = Journal::open(dir.path()).unwrap();
    let mut r = j.read().unwrap().unwrap();
    assert!(r.header.credential.is_empty());
    assert_eq!(state(Some(&r), &process()), "cleanup-required");
    let mut b = Fake::new(&j);
    let report = execute(&j, &mut r, &mut b, Action::Cleanup, &process(), &|| false);
    assert_eq!(report.outcome, "combined-cleaned");
    assert_eq!((b.prf_deletes, b.tpm_deletes), (1, 1));
}
#[test]
fn partial_cleanup_keeps_a_nonresumable_journal_and_retry_needs_no_authorization() {
    initialized();
    for failed in ["delete-prf", "delete-tpm"] {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let p = process();
        let mut r = Record::new(&p);
        let mut b = Fake::new(&j);
        assert_eq!(
            execute(&j, &mut r, &mut b, Action::Prepare, &p, &|| true).outcome,
            "restart-required"
        );
        b.fail = Some(failed);
        let report = execute(&j, &mut r, &mut b, Action::Cleanup, &p, &|| false);
        assert_eq!(report.combined_state, "cleanup-required");
        assert_eq!((b.prf_deletes, b.tpm_deletes), (1, 1));
        let mut r = j.read().unwrap().unwrap();
        assert!(!r.ready);
        b.fail = None;
        assert_eq!(
            execute(&j, &mut r, &mut b, Action::Cleanup, &p, &|| false).outcome,
            "combined-cleaned"
        );
        assert_eq!(b.authorizations, 1);
    }
}
#[test]
fn cancelled_or_stale_authorization_never_reaches_tpm_and_can_retry_after_restart() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let p = process();
    let mut r = Record::new(&p);
    let mut b = Fake::new(&j);
    execute(&j, &mut r, &mut b, Action::Prepare, &p, &|| true);
    let current = Cell::new(true);
    b.stale_after_auth = Some(&current);
    let report = execute(&j, &mut r, &mut b, Action::Resume, &process(), &|| {
        current.get()
    });
    assert_eq!(report.outcome, "interrupted");
    assert_eq!(b.decryptions, 1);
    assert_eq!(b.prf_deletes, 0);
    assert!(j.read().unwrap().unwrap().ready);
    b.stale_after_auth = None;
    b.fail = Some("cancel");
    assert_eq!(
        execute(&j, &mut r, &mut b, Action::Resume, &process(), &|| true).outcome,
        "cancelled"
    );
    assert_eq!(b.decryptions, 1);
}
#[test]
fn envelope_rejects_all_bound_identity_changes_nonce_ciphertext_and_wrong_key() {
    initialized();
    let mut r = Record::new(&process());
    r.header.credential = vec![4; 32];
    r.header.public = vec![2; 256];
    r.header.name = vec![3; 34];
    r.header.expected = [11; 32];
    r.seal(&[5; 256], &[7; 32]).unwrap();
    r.ready = true;
    negative_controls(&r, &[7; 32]).unwrap();
    for field in ["id", "creator", "source", "domain"] {
        let mut changed = r.clone();
        match field {
            "id" => changed.header.id = process(),
            "creator" => changed.header.creator = process(),
            "source" => changed.header.source = "different-build".into(),
            _ => changed.header.domain.push('x'),
        }
        assert!(changed.open(&[7; 32]).is_err(), "{field}");
    }
    for field in 0..8 {
        let mut c = r.clone();
        match field {
            0 => c.header.salt[0] ^= 1,
            1 => c.header.credential[0] ^= 1,
            2 => c.header.public[0] ^= 1,
            3 => c.header.name[0] ^= 1,
            4 => c.header.expected[0] ^= 1,
            5 => c.nonce[0] ^= 1,
            6 => c.header.version = 2,
            _ => c.ciphertext[271] ^= 1,
        }
        assert!(c.open(&[7; 32]).is_err());
    }
}
#[test]
fn journal_refuses_traversal_oversize_unknown_fields_and_malformed_records() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let mut r = Record::new(&process());
    assert!(r
        .header
        .key_name()
        .starts_with("PassKeyLocal.CombinedTest."));
    assert_eq!(r.header.user().len(), 32);
    assert_eq!(RP, "combined.passkey-local.desktop.invalid");
    r.header.id = "../../other".into();
    assert!(j.save(&r).is_err());
    fs::write(&j.path, vec![b' '; MAX_RECORD + 1]).unwrap();
    assert!(j.read().is_err());
    let mut value = serde_json::to_value(Record::new(&process())).unwrap();
    value["secret"] = serde_json::json!([1, 2, 3]);
    fs::write(&j.path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(j.read().is_err());
    fs::write(&j.path, b"{").unwrap();
    assert!(j.read().is_err());
    assert_eq!(state(None, &process()), "no-test");
    let _ = Action::Status;
}
#[cfg(unix)]
#[test]
fn journal_refuses_linked_directory_and_linked_state() {
    use std::os::unix::fs::symlink;
    let dir = tempfile::tempdir().unwrap();
    let other = tempfile::tempdir().unwrap();
    symlink(other.path(), dir.path().join("hello-combined-test")).unwrap();
    assert!(Journal::open(dir.path()).is_err());
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    symlink(other.path().join("missing"), &j.path).unwrap();
    assert!(j.read().is_err());
}

#[test]
fn interrupted_atomic_write_keeps_committed_identity_and_prunes_only_fixed_staging() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let r = Record::new(&process());
    j.save(&r).unwrap();
    let changed = Record::new(&process());
    fs::write(
        j.path.with_file_name("test.pending.json"),
        serde_json::to_vec(&changed).unwrap(),
    )
    .unwrap();
    fs::write(j.path.with_file_name("unrelated.json"), b"preserve").unwrap();
    assert_eq!(j.read().unwrap().unwrap().header.id, r.header.id);
    assert!(!j.path.with_file_name("test.pending.json").exists());
    assert_eq!(
        fs::read(j.path.with_file_name("unrelated.json")).unwrap(),
        b"preserve"
    );
    j.remove().unwrap();
    assert!(j.read().unwrap().is_none());
}

#[test]
fn unreadable_cleanup_journal_reports_failure_before_touching_native_objects() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let p = process();
    let mut r = Record::new(&p);
    j.save(&r).unwrap();
    // Inject a journal read failure after the command's initial read.
    fs::write(&j.path, b"{").unwrap();
    let mut b = Fake::new(&j);
    let report = execute(&j, &mut r, &mut b, Action::Cleanup, &p, &|| false);
    assert_eq!(report.outcome, "blocked");
    assert_eq!(report.combined_state, "cleanup-required");
    assert_eq!((b.prf_deletes, b.tpm_deletes), (0, 0));
    assert_eq!(report.checks.last().unwrap().status, Outcome::Failed);
}

#[test]
fn key_loss_uses_a_positive_roundtrip_then_exact_absence_and_finishes_cleanup() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let p = process();
    let mut r = Record::new(&p);
    let mut b = Fake::new(&j);
    assert!(Action::KeyLoss.creates_test());
    assert!(!Action::Resume.creates_test());
    let report = execute(&j, &mut r, &mut b, Action::KeyLoss, &p, &|| true);
    assert_eq!(report.outcome, "combined-key-loss-passed");
    assert_eq!(report.purpose, "synthetic-combined-key-loss");
    assert_eq!(report.process_scope, "same-process");
    assert_eq!(report.combined_state, "no-test");
    assert_eq!((b.authorizations, b.decryptions), (1, 1));
    assert_eq!((b.prf_deletes, b.tpm_deletes), (2, 2));
    assert!(j.read().unwrap().is_none());
    assert!(report.checks.iter().all(|c| c.status == Outcome::Passed));
    let tpm = report
        .checks
        .iter()
        .find(|c| c.test == "loss-tpm-reopen")
        .unwrap();
    assert_eq!(tpm.native_code.as_deref(), Some("0x80090016"));
    assert_eq!(tpm.operation, Some("tpm-reopen-exact-test-key"));
    assert!(!report.eligible && !report.enrolled && !report.unlocked);
}

#[test]
fn expected_absence_never_accepts_success_cancellation_other_codes_or_other_operations() {
    let exact = Failure {
        status: Outcome::Failed,
        code: Some(0x80090016),
        operation: Some("tpm-reopen-exact-test-key"),
    };
    for result in [
        Ok(()),
        Err(Failure {
            code: Some(0x8009000a),
            ..exact
        }),
        Err(Failure {
            code: Some(0x80090010),
            ..exact
        }),
        Err(Failure {
            code: Some(0x80090036),
            status: Outcome::Cancelled,
            ..exact
        }),
        Err(Failure {
            status: Outcome::Interrupted,
            ..exact
        }),
        Err(Failure {
            operation: Some("tpm-provider-open"),
            ..exact
        }),
        Err(Failure {
            code: None,
            ..exact
        }),
    ] {
        let mut report = Report::new("cleanup-required");
        assert!(expect_missing(
            &mut report,
            "loss-tpm-reopen",
            result,
            "tpm-reopen-exact-test-key",
            Some(0x80090016)
        )
        .is_err());
        assert_ne!(report.checks[0].status, Outcome::Passed);
    }
    let mut report = Report::new("cleanup-required");
    assert!(expect_missing(
        &mut report,
        "loss-passkey-reopen",
        Err(invalid("combined-credential-identity-mismatch")),
        "combined-credential-missing",
        None
    )
    .is_err());
}

#[test]
fn key_loss_preserves_existing_or_unreadable_journal_without_native_work() {
    initialized();
    for malformed in [false, true] {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let p = process();
        let mut r = Record::new(&p);
        j.save(&r).unwrap();
        if malformed {
            fs::write(&j.path, b"{").unwrap();
        }
        let before = fs::read(&j.path).unwrap();
        let mut b = Fake::new(&j);
        let report = execute(&j, &mut r, &mut b, Action::KeyLoss, &p, &|| true);
        assert_ne!(report.outcome, "combined-key-loss-passed");
        assert_eq!(
            (
                b.authorizations,
                b.decryptions,
                b.prf_deletes,
                b.tpm_deletes
            ),
            (0, 0, 0, 0)
        );
        assert_eq!(fs::read(&j.path).unwrap(), before);
    }
}

#[test]
fn key_loss_cancellation_and_reopen_failures_cleanup_without_claiming_success() {
    initialized();
    for fault in ["cancel", "prf-reopen", "tpm-reopen"] {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let p = process();
        let mut r = Record::new(&p);
        let mut b = Fake::new(&j);
        b.fail = Some(fault);
        let report = execute(&j, &mut r, &mut b, Action::KeyLoss, &p, &|| true);
        assert_eq!(
            report.outcome,
            if fault == "cancel" {
                "cancelled"
            } else {
                "blocked"
            }
        );
        assert_eq!(report.combined_state, "no-test");
        assert!(j.read().unwrap().is_none());
        assert!(b.prf_missing && b.tpm_missing);
        assert!(!report.checks.iter().any(|c| c.test == "loss-tpm-reopen"));
        if fault == "cancel" {
            assert_eq!(b.decryptions, 0);
        }
    }
}

#[test]
fn key_loss_partial_deletion_is_nonresumable_and_cleanup_is_retryable() {
    initialized();
    for fault in ["delete-prf", "delete-tpm"] {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let p = process();
        let mut r = Record::new(&p);
        let mut b = Fake::new(&j);
        b.fail = Some(fault);
        let report = execute(&j, &mut r, &mut b, Action::KeyLoss, &p, &|| true);
        assert_eq!(report.outcome, "blocked");
        assert_eq!(report.combined_state, "cleanup-required");
        let mut persisted = j.read().unwrap().unwrap();
        assert!(!persisted.ready);
        assert!(b.prf_deletes > 0 && b.tpm_deletes > 0);
        b.fail = None;
        let resumed = execute(
            &j,
            &mut persisted,
            &mut b,
            Action::Resume,
            &process(),
            &|| true,
        );
        assert_eq!(resumed.outcome, "cleanup-required");
        assert_eq!(b.authorizations, 1);
        let cleaned = execute(&j, &mut persisted, &mut b, Action::Cleanup, &p, &|| false);
        assert_eq!(cleaned.outcome, "combined-cleaned");
        assert!(j.read().unwrap().is_none());
    }
}

#[test]
fn key_loss_stale_session_stops_measurements_but_completes_owned_cleanup() {
    initialized();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let p = process();
    let mut r = Record::new(&p);
    let mut b = Fake::new(&j);
    let current = Cell::new(true);
    b.stale_after_delete = Some(&current);
    let report = execute(&j, &mut r, &mut b, Action::KeyLoss, &p, &|| current.get());
    assert_eq!(report.outcome, "interrupted");
    assert_eq!(report.combined_state, "no-test");
    assert!(b.prf_missing && b.tpm_missing);
    assert!(j.read().unwrap().is_none());
    assert!(!report
        .checks
        .iter()
        .any(|c| c.test == "loss-passkey-reopen"));
    assert_eq!(b.authorizations, 1);
}
