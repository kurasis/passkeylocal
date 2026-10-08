//! A real protected unwrap of ONE public fixture's KDBX password hash.
//! No caller-selected material, vault or enrollment can enter this diagnostic.
use super::*;
use zeroize::Zeroize;

pub(super) const FIXTURE_ID: &str = "passkey-local-public-kdbx-recovery-v1";
pub enum Action {
    Prepare,
    Revoke(String),
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reply {
    pub report: Report,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ticket: Option<String>,
    // This public synthetic fixture credential goes only to an isolated worker.
    // It is deliberately outside the report, clipboard and diagnostic logging.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_hash: Option<Vec<u8>>,
}
impl Reply {
    pub fn redact(&mut self) {
        if let Some(mut bytes) = self.password_hash.take() {
            bytes.zeroize();
        }
        let _ = self.report.stage::<()>(
            "recovery-session",
            Err(interrupted("recovery-session-invalidated")),
        );
    }
}
impl Drop for Reply {
    fn drop(&mut self) {
        if let Some(bytes) = &mut self.password_hash {
            bytes.zeroize();
        }
    }
}
fn fixture_hash() -> Zeroizing<[u8; 32]> {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../../../fixtures/hello-recovery.json"))
            .expect("compiled public fixture");
    assert_eq!(fixture["id"], FIXTURE_ID);
    Zeroizing::new(Sha256::digest(fixture["password"].as_str().unwrap().as_bytes()).into())
}
fn report(state: &'static str) -> Report {
    Report {
        purpose: "synthetic-kdbx-recovery",
        ..Report::new(state)
    }
}
pub(super) fn run<B: Backend>(
    j: &Journal,
    process: &str,
    current: &dyn Fn() -> bool,
    action: Action,
    backend: impl FnOnce(&Record) -> B,
) -> Result<Reply> {
    let existing = j.read()?;
    let mut reply = Reply {
        report: report(state(existing.as_ref(), process)),
        ticket: None,
        password_hash: None,
    };
    let mut r = match (&action, existing) {
        (Action::Prepare, None) => {
            let mut r = Record::new(process);
            r.header.recovery_fixture = Some(FIXTURE_ID.into());
            r
        }
        (Action::Prepare, Some(_)) | (Action::Revoke(_), None) => return Ok(reply),
        (Action::Revoke(ticket), Some(r)) => {
            // A late worker/finally callback cannot delete a different saved test.
            // After process exit, the existing explicit cleanup handles recovery.
            if !canonical_uuid(ticket)
                || r.header.id != *ticket
                || r.header.creator != process
                || r.header.recovery_fixture.as_deref() != Some(FIXTURE_ID)
            {
                let _ = reply
                    .report
                    .stage::<()>("recovery-ticket", Err(invalid("recovery-ticket-mismatch")));
                return Ok(reply);
            }
            r
        }
    };
    if let Err(e) = active(current) {
        let _ = reply.report.stage::<()>("recovery-session", Err(e));
        // Revoke is also the worker's automatic cleanup after interruption.
        if matches!(action, Action::Prepare) {
            return Ok(reply);
        }
    }
    let mut b = backend(&r);
    let result = match action {
        Action::Prepare => {
            let secret = fixture_hash();
            let result = prepare_secret(j, &mut r, &mut b, current, &mut reply.report, &secret);
            match result {
                Ok(material) => {
                    // Match the exact compiled fixture independently of journal metadata.
                    if !libsodium_rs::utils::memcmp(&material, secret.as_slice()) {
                        Err(invalid("recovery-fixture-credential-mismatch"))
                    } else {
                        reply.ticket = Some(r.header.id.clone());
                        reply.password_hash = Some(material.to_vec());
                        reply.report.combined_state = "recovery-ready";
                        reply.report.outcome = "recovery-prepared";
                        return Ok(reply);
                    }
                }
                Err(e) => Err(e),
            }
        }
        Action::Revoke(_) => {
            let result = (|| {
                if !r.ready {
                    return Err(invalid("recovery-not-ready"));
                }
                active(current)?;
                // Fresh native handles must reopen this exact TPM key before loss.
                reply
                    .report
                    .stage("recovery-reopen-binding", b.reopen_tpm(&r.header))?;
                key_loss(j, &mut r, &mut b, current, &mut reply.report)
            })();
            if result.is_ok() {
                reply.report.outcome = "recovery-revoked";
            }
            result
        }
    };
    if let Err(e) = result {
        if reply
            .report
            .checks
            .iter()
            .all(|c| c.status == Outcome::Passed)
        {
            let _ = reply.report.stage::<()>("recovery-session", Err(e));
        }
    }
    let outcome = reply.report.outcome;
    if j.path.exists() && cleanup(j, &mut b, &mut reply.report).is_ok() {
        reply.report.outcome = outcome;
        if result.is_ok() {
            let _ = reply.report.stage("recovery-session", active(current));
        }
    }
    Ok(reply)
}

#[cfg(test)]
mod tests;
