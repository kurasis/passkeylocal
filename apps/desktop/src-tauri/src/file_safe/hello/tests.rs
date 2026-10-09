use super::*;
use crate::file_safe::{
    manager::{Change, Mode as QueryMode, Query, Sort},
    store::SafeStore,
};
use crate::hello::enrollment::tests::Fake;
fn setup() -> (tempfile::TempDir, SafeManager, Fake, String) {
    let d = tempfile::tempdir().unwrap();
    let m = SafeManager::open(&d.path().join("safe")).unwrap();
    let token = m.access("synthetic safe password".into(), true).unwrap();
    (d, m, Fake::default(), token)
}
fn run(m: &SafeManager, f: &mut Fake, r: &Request) -> Result<Response> {
    m.hello_with(r, &mut |manager, current, context, action| {
        if !current() {
            return Err(Error::new("STALE"));
        }
        let result = manager.run_with(&m.hello_root, f, context, action);
        if !current() {
            return Err(Error::new("STALE"));
        }
        result
    })
}
fn enroll(token: &str, mode: Mode) -> Request {
    Request::Enroll {
        token: token.into(),
        password: "synthetic safe password".into(),
        mode,
    }
}
fn unlock(m: &SafeManager) -> Request {
    Request::Unlock {
        expected_generation: m.generation().to_string(),
    }
}
fn query() -> Query {
    Query {
        folder_id: None,
        mode: QueryMode::Files,
        search: "".into(),
        sort: Sort::Name,
        offset: 0,
        folder_offset: 0,
        limit: 100,
    }
}

#[test]
fn root_stays_native_and_hello_opens_actual_catalog_after_normal_save() {
    let (d, m, mut f, token) = setup();
    let response = run(&m, &mut f, &enroll(&token, Mode::Remember6)).unwrap();
    assert_eq!(response.status.state, "enabled");
    assert!(response.token.is_none());
    assert_eq!(f.prompts, 2);
    let page = m.page(&token, query()).unwrap();
    m.change(
        &token,
        &page.snapshot_id,
        Change::Folder {
            parent_id: page.root_id,
            name: "Saved through normal file-safe storage".into(),
        },
    )
    .unwrap();
    let saved = m.page(&token, query()).unwrap();
    let source = d.path().join("hello-file.txt");
    std::fs::write(&source, b"synthetic protected file bytes\x00\xff").unwrap();
    let (sources, skipped) =
        crate::file_safe::manager::collect_sources(vec![source], false).unwrap();
    assert_eq!(
        m.import(
            &token,
            &saved.snapshot_id,
            &saved.root_id,
            None,
            sources,
            skipped
        )
        .unwrap()
        .imported,
        1
    );
    m.lock();
    let opened = run(&m, &mut f, &unlock(&m)).unwrap();
    let token = opened.token.as_ref().unwrap();
    let file = m.page(token, query()).unwrap().files[0].id.clone();
    let exported = d.path().join("hello-export.txt");
    m.export(token, &file, None, &exported).unwrap();
    assert_eq!(
        std::fs::read(exported).unwrap(),
        b"synthetic protected file bytes\x00\xff"
    );
    assert!(m
        .page(token, query())
        .unwrap()
        .folders
        .iter()
        .any(|v| v.name == "Saved through normal file-safe storage"));
    let wire = serde_json::to_value(&opened).unwrap();
    assert_eq!(wire.as_object().unwrap().len(), 2);
    assert!(
        wire.get("root").is_none()
            && wire.get("component").is_none()
            && wire.get("binding").is_none()
    );
    std::fs::create_dir(d.path().join("copies")).unwrap();
    let copy = m.backup(token, &d.path().join("copies")).unwrap();
    let (_, catalog) =
        SafeStore::verify_package(&copy, b"synthetic safe password", &|| Ok(())).unwrap();
    assert!(catalog
        .folders
        .iter()
        .any(|v| v.name == "Saved through normal file-safe storage"));
    assert!(!copy.join("hello-file-safe").exists());
    m.lock();
    assert!(m.access("synthetic safe password".into(), false).is_ok());
}
#[test]
fn fresh_password_and_token_are_required_before_native_creation() {
    let (_d, m, mut f, token) = setup();
    let wrong = Request::Enroll {
        token: token.clone(),
        password: "wrong".into(),
        mode: Mode::Session,
    };
    assert_eq!(run(&m, &mut f, &wrong).unwrap_err().code, "AUTH_FAILED");
    assert_eq!(f.prompts, 0);
    m.lock();
    assert!(run(&m, &mut f, &enroll(&token, Mode::Session)).is_err());
    assert_eq!(f.prompts, 0);
}
#[test]
fn cancel_stale_generation_and_wrong_root_leave_safe_locked() {
    let (_d, m, mut f, token) = setup();
    run(&m, &mut f, &enroll(&token, Mode::Remember24)).unwrap();
    let stale = unlock(&m);
    m.lock();
    assert!(run(&m, &mut f, &stale).is_err());
    assert_eq!(f.prompts, 2);
    f.deny = true;
    assert_eq!(
        run(&m, &mut f, &unlock(&m)).unwrap_err().code,
        "HELLO_CANCELLED"
    );
    assert!(!m.status().unwrap().unlocked);
    f.deny = false;
    let failure = m.hello_with(&unlock(&m), &mut |manager, _, context, action| {
        let mut r = manager.run_with(&m.hello_root, &mut f, context, action)?;
        r.component.as_mut().unwrap().fill(0);
        Ok(r)
    });
    assert!(failure.is_err());
    assert!(!m.status().unwrap().unlocked);
    let late = m.hello_with(&unlock(&m), &mut |manager, _, context, action| {
        let r = manager.run_with(&m.hello_root, &mut f, context, action)?;
        m.revoke();
        Ok(r)
    });
    assert!(late.is_err());
    assert!(!m.status().unwrap().unlocked);
}
#[test]
fn session_restart_cannot_unlock_and_remembered_restart_can() {
    for mode in [Mode::Session, Mode::Remember12] {
        let (d, m, mut f, token) = setup();
        run(&m, &mut f, &enroll(&token, mode)).unwrap();
        let disk: serde_json::Value = serde_json::from_slice(
            &std::fs::read(m.hello_root.join("hello-file-safe/enrollment.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(disk["header"]["domain"], "PassKeyLocal.FileSafeHello.v1");
        assert!(
            disk["header"]["safe"]["key_epoch_id"]
                .as_str()
                .unwrap()
                .len()
                == 32
        );
        if mode == Mode::Session {
            assert_eq!(disk["ready"], false);
            assert_eq!(disk["ciphertext"].as_array().unwrap().len(), 0);
        }
        drop(m);
        let reopened = SafeManager::open(&d.path().join("safe")).unwrap();
        assert_eq!(
            run(&reopened, &mut f, &unlock(&reopened)).is_ok(),
            mode != Mode::Session
        );
    }
}
#[test]
fn password_rotation_invalidates_before_write_and_preserves_old_backup_password() {
    let (d, m, mut f, token) = setup();
    run(&m, &mut f, &enroll(&token, Mode::Remember24)).unwrap();
    std::fs::create_dir(d.path().join("copies")).unwrap();
    let copy = m.backup(&token, &d.path().join("copies")).unwrap();
    let snapshot = m.page(&token, query()).unwrap().snapshot_id;
    assert!(m
        .rotate(&token, &snapshot, "wrong".into(), "new password".into())
        .is_err());
    assert_eq!(
        run(&m, &mut f, &Request::Status {}).unwrap().status.state,
        "enabled"
    );
    m.rotate(
        &token,
        &snapshot,
        "synthetic safe password".into(),
        "new password".into(),
    )
    .unwrap();
    m.lock();
    assert!(run(&m, &mut f, &unlock(&m)).is_err());
    assert_eq!(
        run(&m, &mut f, &Request::Status {}).unwrap().status.state,
        "cleanup-required"
    );
    assert!(m.access("new password".into(), false).is_ok());
    assert!(SafeStore::verify_package(&copy, b"synthetic safe password", &|| Ok(())).is_ok());
}
#[test]
fn restore_revokes_enrollment_and_failed_delete_remains_retryable() {
    let (d, m, mut f, token) = setup();
    std::fs::create_dir(d.path().join("copies")).unwrap();
    let copy = m.backup(&token, &d.path().join("copies")).unwrap();
    run(&m, &mut f, &enroll(&token, Mode::Remember24)).unwrap();
    m.restore(&copy, "synthetic safe password".into(), true)
        .unwrap();
    assert!(run(&m, &mut f, &unlock(&m)).is_err());
    f.delete_error = true;
    let revoke = Request::Revoke {
        expected_generation: m.generation().to_string(),
    };
    assert_eq!(
        run(&m, &mut f, &revoke).unwrap_err().code,
        "HELLO_CLEANUP_REQUIRED"
    );
    assert_eq!(
        run(&m, &mut f, &Request::Status {}).unwrap().status.state,
        "cleanup-required"
    );
    f.delete_error = false;
    assert_eq!(run(&m, &mut f, &revoke).unwrap().status.state, "off");
    assert!(m.access("synthetic safe password".into(), false).is_ok());
}
#[test]
fn strict_file_safe_command_never_accepts_keys_paths_or_other_module_targets() {
    for input in [
        r#"{"operation":"unlock","expected_generation":"0","root":[1]}"#,
        r#"{"operation":"status","path":"other"}"#,
        r#"{"operation":"revoke","expected_generation":"0","rp":"vault.passkey-local.desktop.invalid"}"#,
        r#"{"operation":"enroll","token":"t","password":"p","mode":"forever"}"#,
    ] {
        assert!(serde_json::from_str::<Request>(input).is_err());
    }
}
