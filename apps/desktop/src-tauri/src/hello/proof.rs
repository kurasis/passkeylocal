//! A synthetic-secret experiment, never an enrollment or a vault unlock.
//! Provider support, export denial and silent-operation behavior are measured
//! separately. A round trip cannot stand in for TPM attestation or device tests.
use serde::Serialize;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::run;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Stage {
    HelloConfiguration,
    ProviderOpen,
    KeyCreate,
    KeyPolicy,
    PolicyReadback,
    PublicWrap,
    PrivateExport,
    SilentBefore,
    UnwrapFirst,
    SilentAfterFirst,
    UnwrapSecond,
    SilentAfterSecond,
    TestKeyDelete,
}
const STEPS: [Stage; 12] = [
    Stage::HelloConfiguration,
    Stage::ProviderOpen,
    Stage::KeyCreate,
    Stage::KeyPolicy,
    Stage::PolicyReadback,
    Stage::PublicWrap,
    Stage::SilentBefore,
    Stage::UnwrapFirst,
    Stage::SilentAfterFirst,
    Stage::UnwrapSecond,
    Stage::SilentAfterSecond,
    Stage::PrivateExport,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Outcome {
    Passed,
    Failed,
    Cancelled,
    Interrupted,
    NotRun,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub test: Stage,
    pub status: Outcome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub version: u8,
    pub purpose: &'static str,
    pub eligible: bool,
    pub unlocked: bool,
    pub enrolled: bool,
    pub outcome: &'static str,
    pub checks: Vec<Check>,
    pub remaining: [&'static str; 4],
}

#[derive(Clone, Copy)]
pub(crate) struct Failure {
    pub status: Outcome,
    pub code: Option<u32>,
    pub operation: Option<&'static str>,
}
impl Failure {
    pub(crate) fn failed() -> Self {
        Self {
            status: Outcome::Failed,
            code: None,
            operation: None,
        }
    }
    pub(crate) fn at(mut self, operation: &'static str) -> Self {
        self.operation = Some(operation);
        self
    }
}
pub(crate) trait Provider {
    fn step(&mut self, stage: Stage) -> std::result::Result<(), Failure>;
    fn cleanup(&mut self) -> std::result::Result<(), Failure>;
}

/// Only native code chooses the provider, algorithm, key and synthetic secret.
/// Generation changes stop subsequent prompts, but never skip key deletion.
pub(crate) fn exercise(provider: &mut impl Provider, current: impl Fn() -> bool) -> Report {
    let mut report = Report {
        version: 1,
        purpose: "synthetic-key-proof",
        eligible: false,
        unlocked: false,
        enrolled: false,
        outcome: "roundtrip-passed",
        checks: Vec::with_capacity(13),
        remaining: [
            "per-key-tpm-proof",
            "fresh-authorization-proof",
            "fresh-process-proof",
            "account-machine-copy-proof",
        ],
    };
    let mut stopped = false;
    for stage in STEPS {
        if stopped {
            report.checks.push(Check {
                test: stage,
                status: Outcome::NotRun,
                native_code: None,
                operation: None,
            });
            continue;
        }
        let result = if current() {
            provider.step(stage)
        } else {
            Err(Failure {
                status: Outcome::Interrupted,
                code: None,
                operation: None,
            })
        };
        let (status, native_code, operation) = match result {
            Ok(()) => (Outcome::Passed, None, None),
            Err(error) => {
                stopped = true;
                report.outcome = match error.status {
                    Outcome::Cancelled => "cancelled",
                    Outcome::Interrupted => "interrupted",
                    _ => "blocked",
                };
                (
                    error.status,
                    error.code.map(|code| format!("0x{code:08X}")),
                    error.operation,
                )
            }
        };
        report.checks.push(Check {
            test: stage,
            status,
            native_code,
            operation,
        });
    }
    // An owned OS prompt may outlive a lock. Its result remains synthetic, and
    // epoch checks prevent another prompt or any accepted success after lock.
    if !stopped && !current() {
        report.outcome = "interrupted";
    }
    let (status, native_code, operation) = match provider.cleanup() {
        Ok(()) => (Outcome::Passed, None, None),
        Err(error) => {
            report.outcome = "blocked";
            (
                error.status,
                error.code.map(|code| format!("0x{code:08X}")),
                error.operation,
            )
        }
    };
    report.checks.push(Check {
        test: Stage::TestKeyDelete,
        status,
        native_code,
        operation,
    });
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    struct SyntheticProvider {
        calls: Vec<Stage>,
        failure: Option<Stage>,
        cleanup_failure: bool,
    }
    impl Provider for SyntheticProvider {
        fn step(&mut self, stage: Stage) -> std::result::Result<(), Failure> {
            self.calls.push(stage);
            if self.failure == Some(stage) {
                Err(Failure::failed())
            } else {
                Ok(())
            }
        }
        fn cleanup(&mut self) -> std::result::Result<(), Failure> {
            self.calls.push(Stage::TestKeyDelete);
            if self.cleanup_failure {
                Err(Failure::failed())
            } else {
                Ok(())
            }
        }
    }
    fn provider(failure: Option<Stage>) -> SyntheticProvider {
        SyntheticProvider {
            calls: Vec::new(),
            failure,
            cleanup_failure: false,
        }
    }
    #[test]
    fn success_is_not_hardware_evidence_or_unlock() {
        let mut provider = provider(None);
        let report = exercise(&mut provider, || true);
        assert_eq!(report.outcome, "roundtrip-passed");
        assert!(!report.eligible && !report.unlocked && !report.enrolled);
        assert_eq!(report.remaining.len(), 4);
        assert_eq!(provider.calls.len(), 13);
        let json = serde_json::to_string(&report).unwrap();
        assert!(
            !json.contains("ciphertext") && !json.contains("keyName") && !json.contains("password")
        );
    }
    #[test]
    fn every_failure_stops_private_operations_and_always_deletes() {
        for (index, stage) in STEPS.into_iter().enumerate() {
            let mut provider = provider(Some(stage));
            let report = exercise(&mut provider, || true);
            assert_eq!(report.outcome, "blocked");
            assert_eq!(provider.calls.last(), Some(&Stage::TestKeyDelete));
            assert_eq!(provider.calls.len(), index + 2);
            assert!(report.checks[index + 1..12]
                .iter()
                .all(|c| c.status == Outcome::NotRun));
        }
    }
    #[test]
    fn session_invalidation_stops_a_second_prompt_and_cleans_up() {
        let mut provider = provider(None);
        let calls = std::cell::Cell::new(0);
        let report = exercise(&mut provider, || {
            calls.set(calls.get() + 1);
            calls.get() <= 8
        });
        assert_eq!(report.outcome, "interrupted");
        assert!(provider.calls.contains(&Stage::UnwrapFirst));
        assert!(!provider.calls.contains(&Stage::UnwrapSecond));
        assert_eq!(provider.calls.last(), Some(&Stage::TestKeyDelete));
    }
    #[test]
    fn failed_deletion_cannot_be_reported_as_success() {
        let mut provider = provider(None);
        provider.cleanup_failure = true;
        let report = exercise(&mut provider, || true);
        assert_eq!(report.outcome, "blocked");
        assert_eq!(report.checks.last().unwrap().status, Outcome::Failed);
    }
    #[test]
    fn cancelled_operation_keeps_its_code_and_still_cleans_up() {
        struct Cancelled(bool);
        impl Provider for Cancelled {
            fn step(&mut self, _: Stage) -> std::result::Result<(), Failure> {
                Err(Failure {
                    status: Outcome::Cancelled,
                    code: Some(0x80090036),
                    operation: None,
                }
                .at("native-test-cancellation"))
            }
            fn cleanup(&mut self) -> std::result::Result<(), Failure> {
                self.0 = true;
                Ok(())
            }
        }
        let mut provider = Cancelled(false);
        let report = exercise(&mut provider, || true);
        assert!(provider.0);
        assert_eq!(report.outcome, "cancelled");
        assert_eq!(report.checks[0].native_code.as_deref(), Some("0x80090036"));
        assert_eq!(report.checks[0].operation, Some("native-test-cancellation"));
        assert_eq!(report.checks[1].status, Outcome::NotRun);
    }
}
