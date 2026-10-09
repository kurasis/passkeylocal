use super::*;
use std::cell::Cell;
#[derive(Default)]
pub(crate) struct Fake {
    pub(crate) deleted: bool,
    id: String,
    pub(crate) prompts: usize,
    pub(crate) deny: bool,
    pub(crate) delete_error: bool,
    pub(crate) create_error: bool,
}
impl Protection for Fake {
    fn create(&mut self, h: &mut Header) -> Result<Zeroizing<[u8; 32]>> {
        assert!(h
            .key_name()
            .starts_with(if h.purpose().unwrap() == Purpose::Vault {
                "PassKeyLocal.VaultHello."
            } else {
                "PassKeyLocal.FileSafeHello."
            }));
        assert_ne!(h.user(), [0; 32]);
        self.id = h.id.clone();
        self.deleted = false;
        if self.create_error {
            return Err(Error::new("HELLO_CANCELLED"));
        }
        h.credential = vec![1; 32];
        h.public = vec![2; 256];
        h.name = vec![3; 34];
        self.prompts += 1;
        Ok(Zeroizing::new([7; 32]))
    }
    fn reopen(&mut self, h: &Header) -> Result<()> {
        if self.deleted || h.id != self.id {
            Err(invalid())
        } else {
            Ok(())
        }
    }
    fn authorize(&mut self) -> Result<Zeroizing<[u8; 32]>> {
        self.prompts += 1;
        if self.deny {
            Err(Error::new("HELLO_CANCELLED"))
        } else {
            Ok(Zeroizing::new([7; 32]))
        }
    }
    fn wrap(&mut self, c: &[u8; 32]) -> Result<Vec<u8>> {
        let mut b = vec![0; 256];
        b[..32].copy_from_slice(c);
        Ok(b)
    }
    fn unwrap(&mut self, c: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
        if self.deleted {
            return Err(invalid());
        }
        Ok(Zeroizing::new(c[..32].to_vec()))
    }
    fn delete(&mut self, _header: &Header) -> Result<()> {
        if self.delete_error {
            return Err(Error::new("WRITE_FAILED"));
        }
        self.deleted = true;
        Ok(())
    }
}
fn binding() -> Binding {
    Binding {
        vault: uuid::Uuid::new_v4().to_string(),
        password_epoch: 0,
        generation: 1,
        sha256: "a".repeat(64),
        safe: None,
    }
}
fn safe_binding() -> Binding {
    Binding {
        vault: crate::file_safe::format::id(),
        password_epoch: 0,
        generation: 0,
        sha256: "b".repeat(64),
        safe: Some(SafeBinding {
            store_id: crate::file_safe::format::id(),
            key_epoch_id: crate::file_safe::format::id(),
        }),
    }
}
#[test]
fn old_vault_header_serialization_and_key_domain_remain_compatible() {
    let old = r#"{"domain":"PassKeyLocal.VaultHello.v1","version":1,"id":"12345678-1234-4123-8123-123456789012","vault":"12345678-1234-4123-8123-123456789013","epoch":2,"mode":"remember6","created":1000,"expires":21601000,"salt":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"credential":[1],"public":[2],"name":[3]}"#;
    let header: Header = serde_json::from_str(old).unwrap();
    assert!(header.safe.is_none());
    assert_eq!(header.aad(), old.as_bytes());
    assert_eq!(
        header.key_name(),
        "PassKeyLocal.VaultHello.12345678-1234-4123-8123-123456789012"
    );
    assert_eq!(
        header.user(),
        <[u8; 32]>::from(Sha256::digest(
            "PassKeyLocal.VaultHello.v1:12345678-1234-4123-8123-123456789012"
        ))
    );
}
#[test]
fn purposes_reject_copied_records_and_use_distinct_aead_keys_and_owned_names() {
    libsodium_rs::ensure_init().unwrap();
    let d = tempfile::tempdir().unwrap();
    let v = safe_binding();
    let j = Journal::for_purpose(d.path(), Purpose::FileSafe).unwrap();
    let mut m = Manager::file_safe();
    let mut f = Fake::default();
    m.enroll(&j, &mut f, &v, Mode::Remember24, &[42; 32], &|| {
        Ok((v.clone(), 1000))
    })
    .unwrap();
    let mut record = j.read().unwrap().unwrap();
    assert!(record
        .header
        .key_name()
        .starts_with("PassKeyLocal.FileSafeHello."));
    let vault = Journal::open(d.path()).unwrap();
    std::fs::copy(&j.path, &vault.path).unwrap();
    assert!(vault.read().is_err());
    let mut moved = record.clone();
    moved.header.domain = DOMAIN.into();
    moved.header.vault = uuid::Uuid::new_v4().to_string();
    moved.header.safe = None;
    assert_ne!(record.header.user(), moved.header.user());
    assert!(moved.open(&[7; 32]).is_err());
    record.header.safe.as_mut().unwrap().key_epoch_id = crate::file_safe::format::id();
    assert!(record.open(&[7; 32]).is_err());
}
#[test]
fn wrong_safe_store_or_root_epoch_refuses_before_authorization_and_clears_record() {
    for store in [false, true] {
        libsodium_rs::ensure_init().unwrap();
        let d = tempfile::tempdir().unwrap();
        let j = Journal::for_purpose(d.path(), Purpose::FileSafe).unwrap();
        let mut m = Manager::file_safe();
        let mut f = Fake::default();
        let mut v = safe_binding();
        m.enroll(&j, &mut f, &v, Mode::Remember6, &[42; 32], &|| {
            Ok((v.clone(), 1000))
        })
        .unwrap();
        if store {
            v.safe.as_mut().unwrap().store_id = crate::file_safe::format::id();
        } else {
            v.safe.as_mut().unwrap().key_epoch_id = crate::file_safe::format::id();
        }
        assert!(m.unlock(&j, &mut f, &v, &|| Ok((v.clone(), 2000))).is_err());
        assert_eq!(f.prompts, 2);
        let record = j.read().unwrap().unwrap();
        assert!(!record.ready && record.ciphertext.is_empty());
    }
}
fn setup() -> (tempfile::TempDir, Journal, Manager, Fake, Binding) {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    (dir, j, Manager::default(), Fake::default(), binding())
}
#[test]
fn remembered_roundtrip_reopens_across_manager_restart_without_plaintext_or_verifier() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    m.enroll(&j, &mut b, &v, Mode::Remember24, &[42; 32], &context)
        .unwrap();
    assert_eq!(b.prompts, 2);
    let disk = io::read(&j.path, MAX_RECORD).unwrap();
    let parsed: serde_json::Value = serde_json::from_slice(&disk).unwrap();
    assert!(parsed.get("component").is_none());
    assert!(parsed["header"].get("expected").is_none());
    let mut restarted = Manager::default();
    assert_eq!(
        *restarted.unlock(&j, &mut b, &v, &context).unwrap(),
        vec![42; 32]
    );
    assert_eq!(
        *restarted.unlock(&j, &mut b, &v, &context).unwrap(),
        vec![42; 32]
    );
    assert_eq!(b.prompts, 4);
}
#[test]
fn session_envelope_is_memory_only_and_restart_requires_cleanup() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    m.enroll(&j, &mut b, &v, Mode::Session, &[9; 32], &context)
        .unwrap();
    let disk = j.read().unwrap().unwrap();
    assert!(!disk.ready);
    assert!(disk.ciphertext.is_empty());
    assert_eq!(
        m.unlock(&j, &mut b, &v, &context).unwrap().as_slice(),
        [9; 32]
    );
    let mut restarted = Manager::default();
    assert_eq!(
        restarted.status(&j, &v, 1000).unwrap().state,
        "cleanup-required"
    );
    assert!(restarted.unlock(&j, &mut b, &v, &context).is_err());
    restarted.revoke(&j, &mut b, disk).unwrap();
    assert!(j.read().unwrap().is_none());
}
#[test]
fn generation_changes_allow_saved_content_but_rotation_and_wrong_vault_refuse_before_prompt() {
    let (_d, j, mut m, mut b, mut v) = setup();
    m.enroll(&j, &mut b, &v, Mode::Remember6, &[8; 32], &|| {
        Ok((v.clone(), 1000))
    })
    .unwrap();
    v.generation += 1;
    v.sha256 = "b".repeat(64);
    assert!(m.unlock(&j, &mut b, &v, &|| Ok((v.clone(), 2000))).is_ok());
    let prompts = b.prompts;
    v.password_epoch += 1;
    assert!(m.unlock(&j, &mut b, &v, &|| Ok((v.clone(), 3000))).is_err());
    v.password_epoch -= 1;
    v.vault = uuid::Uuid::new_v4().to_string();
    assert!(m.unlock(&j, &mut b, &v, &|| Ok((v.clone(), 3000))).is_err());
    assert_eq!(b.prompts, prompts);
}
#[test]
fn cancellation_returns_no_component_and_does_not_retry() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    m.enroll(&j, &mut b, &v, Mode::Remember12, &[8; 32], &context)
        .unwrap();
    b.deny = true;
    assert_eq!(
        m.unlock(&j, &mut b, &v, &context).unwrap_err().code,
        "HELLO_CANCELLED"
    );
    assert_eq!(b.prompts, 3);
    assert_eq!(m.status(&j, &v, 1000).unwrap().state, "enabled");
}
#[test]
fn expiry_backward_clock_and_context_change_during_prompt_return_no_component() {
    let (_d, j, mut m, mut b, v) = setup();
    m.enroll(&j, &mut b, &v, Mode::Remember6, &[8; 32], &|| {
        Ok((v.clone(), 1000))
    })
    .unwrap();
    let calls = Cell::new(0);
    let context = || {
        calls.set(calls.get() + 1);
        let mut next = v.clone();
        if calls.get() > 1 {
            next.generation += 1;
        }
        Ok((next, 2000))
    };
    assert_eq!(
        m.unlock(&j, &mut b, &v, &context).unwrap_err().code,
        "STALE"
    );
    assert_eq!(b.prompts, 3);
    assert!(m
        .unlock(&j, &mut b, &v, &|| Err(Error::new("STALE")))
        .is_err());
    assert!(m
        .unlock(&j, &mut b, &v, &|| Ok((v.clone(), 1000 + 6 * 3_600_000)))
        .is_err());
    assert!(!j.read().unwrap().unwrap().ready);
    // Returning the clock to the formerly valid interval cannot re-enable it.
    assert!(m.unlock(&j, &mut b, &v, &|| Ok((v.clone(), 3000))).is_err());
    assert_eq!(b.prompts, 3);
}
#[test]
fn revoked_envelope_replay_cannot_reopen_deleted_key() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    m.enroll(&j, &mut b, &v, Mode::Remember24, &[8; 32], &context)
        .unwrap();
    let old = j.read().unwrap().unwrap();
    m.revoke(&j, &mut b, old.clone()).unwrap();
    assert!(b.deleted);
    j.save(&old).unwrap();
    assert!(m.unlock(&j, &mut b, &v, &context).is_err());
}
#[test]
fn failed_deletion_is_nonresumable_and_retryable() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    m.enroll(&j, &mut b, &v, Mode::Session, &[8; 32], &context)
        .unwrap();
    let r = m.read(&j).unwrap().unwrap();
    b.delete_error = true;
    assert!(m.revoke(&j, &mut b, r).is_err());
    assert!(m.session.is_none());
    assert!(!j.read().unwrap().unwrap().ready);
    assert!(m.unlock(&j, &mut b, &v, &context).is_err());
    b.delete_error = false;
    m.revoke(&j, &mut b, j.read().unwrap().unwrap()).unwrap();
    assert!(j.read().unwrap().is_none());
}
#[test]
fn failed_creation_cleans_journal_and_failed_cleanup_keeps_ownership() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    b.create_error = true;
    assert!(m
        .enroll(&j, &mut b, &v, Mode::Session, &[8; 32], &context)
        .is_err());
    assert!(b.deleted);
    assert!(j.read().unwrap().is_none());
    b.delete_error = true;
    assert_eq!(
        m.enroll(&j, &mut b, &v, Mode::Session, &[8; 32], &context)
            .unwrap_err()
            .code,
        "HELLO_CLEANUP_REQUIRED"
    );
    assert!(j.read().unwrap().is_some());
    assert!(m.session.is_none());
}
#[test]
fn tampered_cipher_and_authenticated_metadata_fail_closed() {
    let (_d, j, mut m, mut b, v) = setup();
    let context = || Ok((v.clone(), 1000));
    m.enroll(&j, &mut b, &v, Mode::Remember24, &[8; 32], &context)
        .unwrap();
    let old = j.read().unwrap().unwrap();
    let mut r = old.clone();
    r.ciphertext[0] ^= 1;
    j.save(&r).unwrap();
    assert!(m.unlock(&j, &mut b, &v, &context).is_err());
    let mut r = old;
    r.header.salt[0] ^= 1;
    j.save(&r).unwrap();
    assert!(m.unlock(&j, &mut b, &v, &context).is_err());
}
#[test]
fn stale_enrollment_never_becomes_enabled() {
    let (_d, j, mut m, mut b, v) = setup();
    let calls = Cell::new(0);
    let context = || {
        calls.set(calls.get() + 1);
        if calls.get() > 1 {
            Err(Error::new("STALE"))
        } else {
            Ok((v.clone(), 1000))
        }
    };
    assert!(m
        .enroll(&j, &mut b, &v, Mode::Remember24, &[8; 32], &context)
        .is_err());
    assert!(b.deleted);
    assert!(j.read().unwrap().is_none());
}

#[test]
fn backward_clock_observation_stays_disabled_after_clock_recovers() {
    let (_d, j, mut m, mut b, v) = setup();
    m.enroll(&j, &mut b, &v, Mode::Remember6, &[8; 32], &|| {
        Ok((v.clone(), 1000))
    })
    .unwrap();
    assert_eq!(m.status(&j, &v, 999).unwrap().state, "cleanup-required");
    assert_eq!(m.status(&j, &v, 2000).unwrap().state, "cleanup-required");
    assert!(m.unlock(&j, &mut b, &v, &|| Ok((v.clone(), 2000))).is_err());
    assert_eq!(b.prompts, 2);
}
#[test]
fn credential_changing_storage_operations_require_prior_invalidation() {
    use serde_json::json;
    assert!(!credential_write(
        "commit",
        &json!({"expectedGeneration":2,"passwordEpoch":null,"confirmedReplacement":false})
    ));
    assert!(credential_write("commit", &json!({"passwordEpoch":1})));
    assert!(credential_write(
        "commit",
        &json!({"confirmedReplacement":true})
    ));
    assert!(credential_write("restoreBlob", &json!({"blobId":"opaque"})));
    assert!(!credential_write("readBlob", &json!({})));
}

#[test]
fn ipc_accepts_only_fixed_actions_and_bounded_mode_choices() {
    for json in [
        r#"{"operation":"decrypt","ciphertext":[1]}"#,
        r#"{"operation":"unlock","key":"arbitrary"}"#,
        r#"{"operation":"enroll","mode":"forever","generation":1,"sha256":"a","component":[]}"#,
    ] {
        assert!(
            serde_json::from_str::<Action>(json).is_err(),
            "accepted {json}"
        );
    }
    for operation in ["status", "unlock", "revoke"] {
        let valid = serde_json::json!({"operation":operation});
        assert!(serde_json::from_value::<Action>(valid).is_ok());
        let extra = serde_json::json!({"operation":operation,"component":vec![0;32]});
        assert!(serde_json::from_value::<Action>(extra).is_err());
    }
    for mode in ["session", "remember6", "remember12", "remember24"] {
        let input = serde_json::json!({"operation":"enroll","mode":mode,"generation":1,"sha256":"a".repeat(64),"component":vec![0;32]});
        assert!(serde_json::from_value::<Action>(input).is_ok());
    }
}
