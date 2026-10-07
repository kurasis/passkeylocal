//! Fixed synthetic WebAuthn PRF experiments; never vault enrollment or unlock.
use super::proof::{Failure, Outcome};
use serde::Serialize;

#[cfg(all(windows, test))]
mod abi;
#[cfg(windows)]
#[allow(
    dead_code,
    non_snake_case,
    non_camel_case_types,
    non_upper_case_globals,
    clippy::upper_case_acronyms
)]
mod bindings;
#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::run;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Experiment {
    Capability,
    Synthetic,
}

const CAPABILITY: [&str; 4] = [
    "webauthn-load",
    "webauthn-api",
    "hello-platform",
    "hello-route",
];
const SYNTHETIC: [&str; 9] = [
    "webauthn-load",
    "webauthn-api",
    "hello-platform",
    "hello-route",
    "prf-create",
    "prf-first",
    "prf-repeat",
    "prf-changed",
    "prf-roundtrip",
];

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capability {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_build: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_version: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform_available: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hello_candidates: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hello_locked: Option<bool>,
    pub routing: &'static str,
    pub tpm_binding: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrfCheck {
    pub test: &'static str,
    pub status: Outcome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<&'static str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub version: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_commit: Option<&'static str>,
    pub purpose: &'static str,
    pub algorithm: &'static str,
    pub eligible: bool,
    pub enrolled: bool,
    pub unlocked: bool,
    pub outcome: &'static str,
    pub checks: Vec<PrfCheck>,
    pub webauthn: Capability,
    pub remaining: [&'static str; 4],
}

pub(super) trait Provider {
    fn step(&mut self, step: &'static str) -> Result<(), Failure>;
    fn cleanup(&mut self) -> Result<(), Failure>;
    fn capability(&self) -> Capability;
}

fn check(test: &'static str, result: Result<(), Failure>) -> PrfCheck {
    match result {
        Ok(()) => PrfCheck {
            test,
            status: Outcome::Passed,
            native_code: None,
            operation: None,
        },
        Err(e) => PrfCheck {
            test,
            status: e.status,
            native_code: e.code.map(|c| format!("0x{c:08X}")),
            operation: e.operation,
        },
    }
}

pub(super) fn exercise(
    provider: &mut impl Provider,
    current: impl Fn() -> bool,
    experiment: Experiment,
) -> Report {
    let mut report = Report {
        version: 1,
        source_commit: option_env!("PASSKEY_SOURCE_COMMIT"),
        purpose: if experiment == Experiment::Capability {
            "webauthn-prf-capability"
        } else {
            "synthetic-webauthn-prf"
        },
        algorithm: "webauthn-prf-aes256gcm",
        eligible: false,
        enrolled: false,
        unlocked: false,
        outcome: "blocked",
        checks: Vec::new(),
        webauthn: Capability::default(),
        remaining: [
            "per-key-tpm-proof",
            "fresh-authorization-proof",
            "fresh-process-proof",
            "account-machine-copy-proof",
        ],
    };
    let steps = if experiment == Experiment::Capability {
        &CAPABILITY[..]
    } else {
        &SYNTHETIC[..]
    };
    let mut running = true;
    for step in steps {
        if !running {
            report.checks.push(PrfCheck {
                test: step,
                status: Outcome::NotRun,
                native_code: None,
                operation: None,
            });
            continue;
        }
        let result = if current() {
            provider.step(step)
        } else {
            Err(interrupted("prf-session-changed"))
        };
        let result = if result.is_ok() && !current() {
            Err(interrupted("prf-session-changed"))
        } else {
            result
        };
        let value = check(step, result);
        running = value.status == Outcome::Passed;
        if !running {
            report.outcome = match value.status {
                Outcome::Cancelled => "cancelled",
                Outcome::Interrupted => "interrupted",
                _ => "blocked",
            };
        }
        report.checks.push(value);
    }
    if experiment == Experiment::Synthetic {
        let cleanup = check("test-passkey-delete", provider.cleanup());
        if cleanup.status != Outcome::Passed {
            running = false;
            report.outcome = "blocked";
        }
        report.checks.push(cleanup);
    }
    report.webauthn = provider.capability();
    if running {
        report.outcome = if experiment == Experiment::Capability {
            "webauthn-capability-observed"
        } else {
            "prf-roundtrip-passed"
        };
    }
    report
}

pub(super) fn interrupted(operation: &'static str) -> Failure {
    Failure {
        status: Outcome::Interrupted,
        code: None,
        operation: Some(operation),
    }
}
pub(super) fn invalid(operation: &'static str) -> Failure {
    Failure::failed().at(operation)
}

fn roundtrip(secret: &[u8; 32]) -> Result<(), Failure> {
    use libsodium_rs::crypto_aead::aes256gcm as aes;
    use zeroize::Zeroizing;
    if !aes::is_available() {
        return Err(invalid("aes256gcm-unavailable"));
    }
    let key = aes::Key::from_bytes(secret).map_err(|_| invalid("aes256gcm-key"))?;
    let nonce = aes::Nonce::generate();
    let mut message = Zeroizing::new([0u8; 32]);
    libsodium_rs::random::fill_bytes(message.as_mut_slice());
    let aad = b"PassKey Local synthetic PRF v1";
    let mut encrypted = aes::encrypt(message.as_slice(), Some(aad), &nonce, &key)
        .map_err(|_| invalid("prf-aes256gcm-encrypt"))?;
    let decrypted = Zeroizing::new(
        aes::decrypt(&encrypted, Some(aad), &nonce, &key)
            .map_err(|_| invalid("prf-aes256gcm-decrypt"))?,
    );
    if !libsodium_rs::utils::memcmp(&decrypted, message.as_slice()) {
        return Err(invalid("prf-aes256gcm-secret-mismatch"));
    }
    if aes::decrypt(&encrypted, Some(b"changed binding"), &nonce, &key).is_ok() {
        return Err(invalid("prf-aes256gcm-aad-accepted"));
    }
    let other = aes::Key::generate();
    if aes::decrypt(&encrypted, Some(aad), &nonce, &other).is_ok() {
        return Err(invalid("prf-aes256gcm-wrong-key-accepted"));
    }
    encrypted[0] ^= 1;
    if aes::decrypt(&encrypted, Some(aad), &nonce, &key).is_ok() {
        return Err(invalid("prf-aes256gcm-tamper-accepted"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fake {
        calls: Vec<&'static str>,
        failure: Option<&'static str>,
        delete_failure: bool,
    }
    impl Provider for Fake {
        fn step(&mut self, s: &'static str) -> Result<(), Failure> {
            self.calls.push(s);
            if self.failure == Some(s) {
                Err(invalid("synthetic-failure"))
            } else {
                Ok(())
            }
        }
        fn cleanup(&mut self) -> Result<(), Failure> {
            self.calls.push("delete");
            if self.delete_failure {
                Err(invalid("synthetic-delete-failure"))
            } else {
                Ok(())
            }
        }
        fn capability(&self) -> Capability {
            Capability {
                api_version: Some(9),
                routing: "display-name-candidate",
                tpm_binding: "not-verified",
                ..Default::default()
            }
        }
    }
    fn fake() -> Fake {
        Fake {
            calls: Vec::new(),
            failure: None,
            delete_failure: false,
        }
    }
    #[test]
    fn capability_never_creates_or_deletes_a_credential() {
        let mut p = fake();
        let r = exercise(&mut p, || true, Experiment::Capability);
        assert_eq!(p.calls, CAPABILITY);
        assert_eq!(r.checks.len(), 4);
        assert_eq!(r.outcome, "webauthn-capability-observed");
        assert!(!r.eligible && !r.enrolled && !r.unlocked);
        assert_eq!(r.remaining.len(), 4);
    }
    #[test]
    fn every_failure_stops_later_operations_but_always_cleans_up() {
        for (i, stage) in SYNTHETIC.iter().enumerate() {
            let mut p = fake();
            p.failure = Some(stage);
            let r = exercise(&mut p, || true, Experiment::Synthetic);
            assert_eq!(&p.calls[..i + 1], &SYNTHETIC[..i + 1]);
            assert_eq!(p.calls.last(), Some(&"delete"));
            assert!(r.checks[i + 1..9]
                .iter()
                .all(|c| c.status == Outcome::NotRun));
            assert_eq!(r.outcome, "blocked");
            assert!(!r.eligible && !r.enrolled && !r.unlocked);
        }
    }
    #[test]
    fn invalidated_request_does_no_crypto_and_delete_failure_cannot_be_success() {
        let mut p = fake();
        let r = exercise(&mut p, || false, Experiment::Synthetic);
        assert_eq!(p.calls, ["delete"]);
        assert_eq!(r.outcome, "interrupted");
        let mut p = fake();
        p.delete_failure = true;
        let r = exercise(&mut p, || true, Experiment::Synthetic);
        assert_eq!(r.outcome, "blocked");
        assert_eq!(r.checks.last().unwrap().status, Outcome::Failed);
    }
    #[test]
    fn invalidation_at_each_pre_and_post_step_always_stops_and_cleans_up() {
        use std::cell::Cell;
        for limit in 0..SYNTHETIC.len() * 2 {
            let calls = Cell::new(0);
            let mut p = fake();
            let r = exercise(
                &mut p,
                || {
                    let n = calls.get();
                    calls.set(n + 1);
                    n < limit
                },
                Experiment::Synthetic,
            );
            assert_eq!(r.outcome, "interrupted");
            assert_eq!(p.calls.last(), Some(&"delete"));
            assert_eq!(p.calls.len() - 1, limit.div_ceil(2));
            assert!(!r.eligible && !r.enrolled && !r.unlocked);
        }
    }
    #[test]
    fn successful_prf_report_keeps_all_security_gates_unresolved() {
        let mut p = fake();
        let r = exercise(&mut p, || true, Experiment::Synthetic);
        assert_eq!(r.outcome, "prf-roundtrip-passed");
        let value = serde_json::to_value(&r).unwrap();
        assert_eq!(value["webauthn"]["tpmBinding"], "not-verified");
        assert_eq!(value["remaining"].as_array().unwrap().len(), 4);
        assert!(!r.eligible && !r.enrolled && !r.unlocked);
        // The report type has no credential, challenge, salt or secret field.
        let keys: Vec<_> = value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert!(keys.iter().all(|k| [
            "version",
            "sourceCommit",
            "purpose",
            "algorithm",
            "eligible",
            "enrolled",
            "unlocked",
            "outcome",
            "checks",
            "webauthn",
            "remaining"
        ]
        .contains(k)));
    }
    #[test]
    fn actual_authenticated_encryption_roundtrip_and_negative_controls() {
        libsodium_rs::ensure_init().unwrap();
        if libsodium_rs::crypto_aead::aes256gcm::is_available() {
            roundtrip(&[7; 32]).unwrap();
        } else {
            assert!(roundtrip(&[7; 32]).is_err());
        }
    }
}
