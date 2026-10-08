use super::*;
use crate::hello::combined::tests::Fake;

#[test]
fn actual_unwrapped_fixture_component_is_returned_only_after_authorization() {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let process = uuid::Uuid::new_v4().to_string();
    let reply = run(&j, &process, &|| true, Action::Prepare, |_| Fake::new(&j)).unwrap();
    assert_eq!(reply.report.outcome, "recovery-prepared");
    assert_eq!(
        reply.password_hash.as_deref(),
        Some(fixture_hash().as_slice())
    );
    assert_eq!(
        reply.ticket.as_ref(),
        Some(&j.read().unwrap().unwrap().header.id)
    );
    assert_eq!(reply.report.combined_state, "recovery-ready");
    let json = serde_json::to_value(&reply.report).unwrap();
    assert!(json.get("passwordHash").is_none());
    assert_eq!(json["enrolled"], false);
    assert!(reply
        .report
        .checks
        .iter()
        .any(|c| c.test == "combined-unwrap-first" && c.status == Outcome::Passed));
}
#[test]
fn revoke_uses_exact_ticket_observes_native_loss_and_cleans_journal() {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let process = uuid::Uuid::new_v4().to_string();
    let reply = run(&j, &process, &|| true, Action::Prepare, |_| Fake::new(&j)).unwrap();
    let ticket = reply.ticket.clone().unwrap();
    let result = run(&j, &process, &|| true, Action::Revoke(ticket), |_| {
        Fake::new(&j)
    })
    .unwrap();
    assert_eq!(result.report.outcome, "recovery-revoked");
    assert_eq!(result.report.combined_state, "no-test");
    assert!(result.password_hash.is_none() && result.ticket.is_none());
    assert!(j.read().unwrap().is_none());
    assert!(result
        .report
        .checks
        .iter()
        .any(|c| c.test == "loss-tpm-reopen" && c.status == Outcome::Passed));
}
#[test]
fn stale_or_foreign_ticket_cannot_delete_any_saved_test() {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let process = uuid::Uuid::new_v4().to_string();
    let reply = run(&j, &process, &|| true, Action::Prepare, |_| Fake::new(&j)).unwrap();
    let before = fs::read(&j.path).unwrap();
    for (p, t) in [
        (process.clone(), uuid::Uuid::new_v4().to_string()),
        (
            uuid::Uuid::new_v4().to_string(),
            reply.ticket.clone().unwrap(),
        ),
    ] {
        let result = run::<Fake>(&j, &p, &|| true, Action::Revoke(t), |_| {
            panic!("must not touch native objects")
        })
        .unwrap();
        assert_eq!(result.report.outcome, "blocked");
        assert_eq!(fs::read(&j.path).unwrap(), before);
    }
    let refused = run::<Fake>(&j, &process, &|| true, Action::Prepare, |_| {
        panic!("must not overwrite")
    })
    .unwrap();
    assert!(refused.password_hash.is_none());
    assert_eq!(fs::read(&j.path).unwrap(), before);
}
#[test]
fn interrupted_creation_touches_no_keys_and_interrupted_revoke_still_cleans_owned_pair() {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let process = uuid::Uuid::new_v4().to_string();
    let result = run::<Fake>(&j, &process, &|| false, Action::Prepare, |_| {
        panic!("stale prepare")
    })
    .unwrap();
    assert_eq!(result.report.outcome, "interrupted");
    assert!(j.read().unwrap().is_none());
    let reply = run(&j, &process, &|| true, Action::Prepare, |_| Fake::new(&j)).unwrap();
    let result = run(
        &j,
        &process,
        &|| false,
        Action::Revoke(reply.ticket.clone().unwrap()),
        |_| Fake::new(&j),
    )
    .unwrap();
    assert_eq!(result.report.outcome, "interrupted");
    assert_eq!(result.report.combined_state, "no-test");
    assert!(result.password_hash.is_none());
}
#[test]
fn recovery_marker_is_authenticated_and_blocks_restart_and_copy_export() {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let process = uuid::Uuid::new_v4().to_string();
    run(&j, &process, &|| true, Action::Prepare, |_| Fake::new(&j)).unwrap();
    let mut r = j.read().unwrap().unwrap();
    assert!(super::super::copy::encode(&r).is_err());
    let original = r.header.aad();
    let result = execute(
        &j,
        &mut r,
        &mut Fake::new(&j),
        super::super::Action::Resume,
        &uuid::Uuid::new_v4().to_string(),
        &|| true,
    );
    assert!(result.checks.is_empty());
    r.header.recovery_fixture = None;
    assert_ne!(r.header.aad(), original);
    assert!(r.open(&[13; 32]).is_err());
}
#[test]
fn authorization_failure_never_returns_a_credential_and_cleanup_is_honest() {
    libsodium_rs::ensure_init().unwrap();
    for fail in [
        "cancel",
        "authorize",
        "unwrap",
        "prf-create",
        "delete-prf",
        "delete-tpm",
    ] {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let process = uuid::Uuid::new_v4().to_string();
        let prepared = run(&j, &process, &|| true, Action::Prepare, |_| {
            let mut b = Fake::new(&j);
            if !fail.starts_with("delete") {
                b.fail = Some(fail);
            }
            b
        })
        .unwrap();
        if fail.starts_with("delete") {
            let revoked = run(
                &j,
                &process,
                &|| true,
                Action::Revoke(prepared.ticket.clone().unwrap()),
                |_| {
                    let mut b = Fake::new(&j);
                    b.fail = Some(fail);
                    b
                },
            )
            .unwrap();
            assert_eq!(revoked.report.combined_state, "cleanup-required");
            assert_ne!(revoked.report.outcome, "recovery-revoked");
            assert!(revoked.password_hash.is_none());
        } else {
            assert!(prepared.password_hash.is_none() && prepared.ticket.is_none());
            assert_eq!(prepared.report.combined_state, "no-test");
            assert_eq!(
                prepared.report.outcome,
                if fail == "cancel" {
                    "cancelled"
                } else {
                    "blocked"
                }
            );
        }
    }
}
#[test]
fn late_result_redaction_drops_credential_but_retains_only_cleanup_ticket() {
    libsodium_rs::ensure_init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::open(dir.path()).unwrap();
    let mut reply = run(
        &j,
        &uuid::Uuid::new_v4().to_string(),
        &|| true,
        Action::Prepare,
        |_| Fake::new(&j),
    )
    .unwrap();
    reply.redact();
    assert!(reply.password_hash.is_none() && reply.ticket.is_some());
    assert_eq!(reply.report.outcome, "interrupted");
}
