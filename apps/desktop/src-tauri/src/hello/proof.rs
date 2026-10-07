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

/// Fixed native experiments exposed through separate, argument-free commands.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Experiment {
    SecurityProof,
    AuthorizedOaepCapability,
    // Explicit synthetic compatibility discovery, never an OAEP fallback.
    Pkcs1Compatibility,
    // Separate full behavior measurement, never approval of legacy padding.
    Pkcs1Behavior,
}
impl Experiment {
    fn includes(self, stage: Stage) -> bool {
        matches!(self, Self::SecurityProof | Self::Pkcs1Behavior)
            || matches!(
                stage,
                Stage::HelloConfiguration
                    | Stage::ProviderOpen
                    | Stage::KeyCreate
                    | Stage::KeyPolicy
                    | Stage::PolicyReadback
                    | Stage::PublicWrap
                    | Stage::UnwrapFirst
            )
    }
}

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

/// Format support is distinct from explicit private-export permission denial.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCheck {
    pub format: &'static str,
    pub result: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_code: Option<String>,
}

#[cfg(any(windows, test))]
fn export_result(format: &'static str, code: Option<u32>) -> ExportCheck {
    ExportCheck {
        format,
        result: match code {
            Some(0x80090010) => "refused",            // NTE_PERM
            Some(0x8009000A) => "unsupported-format", // NTE_BAD_TYPE
            None => "unexpected-success",
            _ => "failed",
        },
        native_code: code.map(|code| format!("0x{code:08X}")),
    }
}

#[cfg(any(windows, test))]
pub(crate) fn measure_exports(
    current: impl Fn() -> bool,
    mut attempt: impl FnMut(&'static str) -> std::result::Result<(), Failure>,
) -> (Vec<ExportCheck>, std::result::Result<(), Failure>) {
    let formats = [
        ("rsa-private", "private-export-rsa"),
        ("rsa-full-private", "private-export-rsa-full"),
        ("pkcs8-private", "private-export-pkcs8"),
    ];
    let mut checks: Vec<_> = formats
        .iter()
        .map(|(format, _)| ExportCheck {
            format,
            result: "not-run",
            native_code: None,
        })
        .collect();
    let mut first_failure = None;
    for (index, (format, operation)) in formats.into_iter().enumerate() {
        if !current() {
            return (
                checks,
                Err(Failure {
                    status: Outcome::Interrupted,
                    code: None,
                    operation: Some("private-export-session-changed"),
                }),
            );
        }
        let result = attempt(format);
        checks[index] = export_result(format, result.as_ref().err().and_then(|error| error.code));
        // No-code native failures must not be confused with API success.
        if result.is_err() && checks[index].result == "unexpected-success" {
            checks[index].result = "failed";
        }
        match result {
            Err(error) if error.code == Some(0x80090010) && error.status == Outcome::Failed => {}
            Err(error) if matches!(error.status, Outcome::Cancelled | Outcome::Interrupted) => {
                return (checks, Err(error.at(operation)));
            }
            Err(error) => {
                first_failure.get_or_insert(error.at(operation));
            }
            // A successful private export violates the gate. Output is never
            // returned, and no subsequent export attempt is necessary.
            Ok(()) => return (checks, Err(Failure::failed().at(operation))),
        }
    }
    (checks, first_failure.map_or(Ok(()), Err))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub version: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_commit: Option<&'static str>,
    pub purpose: &'static str,
    pub algorithm: &'static str,
    pub eligible: bool,
    pub unlocked: bool,
    pub enrolled: bool,
    pub outcome: &'static str,
    pub checks: Vec<Check>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub export_checks: Vec<ExportCheck>,
    pub remaining: [&'static str; 4],
}

#[derive(Clone, Copy, Debug)]
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
    fn export_checks(&self) -> Vec<ExportCheck> {
        Vec::new()
    }
}

/// Only native code chooses the provider, algorithm, key and synthetic secret.
/// Generation changes stop subsequent prompts, but never skip key deletion.
pub(crate) fn exercise(provider: &mut impl Provider, current: impl Fn() -> bool) -> Report {
    exercise_selected(provider, current, Experiment::SecurityProof)
}

pub(crate) fn exercise_selected(
    provider: &mut impl Provider,
    current: impl Fn() -> bool,
    experiment: Experiment,
) -> Report {
    let mut report = Report {
        version: 1,
        source_commit: option_env!("PASSKEY_SOURCE_COMMIT"),
        purpose: match experiment {
            Experiment::SecurityProof => "synthetic-key-proof",
            Experiment::AuthorizedOaepCapability => "synthetic-oaep-capability",
            Experiment::Pkcs1Compatibility => "synthetic-pkcs1-compatibility",
            Experiment::Pkcs1Behavior => "synthetic-pkcs1-behavior",
        },
        algorithm: match experiment {
            Experiment::Pkcs1Compatibility | Experiment::Pkcs1Behavior => "rsa-pkcs1-v1_5",
            _ => "rsa-oaep-sha256",
        },
        eligible: false,
        unlocked: false,
        enrolled: false,
        outcome: match experiment {
            Experiment::SecurityProof => "roundtrip-passed",
            Experiment::AuthorizedOaepCapability => "capability-passed",
            Experiment::Pkcs1Compatibility => "compatibility-passed",
            Experiment::Pkcs1Behavior => "behavior-passed",
        },
        checks: Vec::with_capacity(13),
        export_checks: Vec::new(),
        remaining: [
            "per-key-tpm-proof",
            "fresh-authorization-proof",
            "fresh-process-proof",
            "account-machine-copy-proof",
        ],
    };
    let mut stopped = false;
    for stage in STEPS {
        if stopped || !experiment.includes(stage) {
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
    report.export_checks = provider.export_checks();
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
    fn authorized_capability_is_separate_and_never_claims_skipped_security_checks() {
        let mut provider = provider(None);
        let report =
            exercise_selected(&mut provider, || true, Experiment::AuthorizedOaepCapability);
        assert_eq!(report.purpose, "synthetic-oaep-capability");
        assert_eq!(report.outcome, "capability-passed");
        assert!(!report.eligible && !report.unlocked && !report.enrolled);
        assert_eq!(report.remaining.len(), 4);
        assert_eq!(
            provider.calls,
            vec![
                Stage::HelloConfiguration,
                Stage::ProviderOpen,
                Stage::KeyCreate,
                Stage::KeyPolicy,
                Stage::PolicyReadback,
                Stage::PublicWrap,
                Stage::UnwrapFirst,
                Stage::TestKeyDelete,
            ]
        );
        for check in &report.checks {
            if matches!(
                check.test,
                Stage::SilentBefore
                    | Stage::SilentAfterFirst
                    | Stage::SilentAfterSecond
                    | Stage::UnwrapSecond
                    | Stage::PrivateExport
            ) {
                assert_eq!(check.status, Outcome::NotRun);
            }
        }
        // The independent action cannot change the required primary sequence.
        let mut provider = super::tests::provider(Some(Stage::SilentBefore));
        let primary = exercise(&mut provider, || true);
        assert_eq!(primary.purpose, "synthetic-key-proof");
        assert_eq!(primary.outcome, "blocked");
        assert!(!provider.calls.contains(&Stage::UnwrapFirst));
    }
    #[test]
    fn every_capability_failure_stops_and_deletes_its_key() {
        for stage in STEPS
            .into_iter()
            .filter(|stage| Experiment::AuthorizedOaepCapability.includes(*stage))
        {
            let mut provider = provider(Some(stage));
            let report =
                exercise_selected(&mut provider, || true, Experiment::AuthorizedOaepCapability);
            assert_eq!(report.outcome, "blocked");
            assert_eq!(provider.calls.last(), Some(&Stage::TestKeyDelete));
            let index = report
                .checks
                .iter()
                .position(|check| check.test == stage)
                .unwrap();
            assert!(report.checks[index + 1..12]
                .iter()
                .all(|check| check.status == Outcome::NotRun));
        }
        let mut provider = provider(None);
        provider.cleanup_failure = true;
        let report =
            exercise_selected(&mut provider, || true, Experiment::AuthorizedOaepCapability);
        assert_eq!(report.outcome, "blocked");
        assert_eq!(report.checks.last().unwrap().status, Outcome::Failed);
    }
    #[test]
    fn legacy_compatibility_is_explicit_and_never_promotes_or_replaces_oaep() {
        let experiment = Experiment::Pkcs1Compatibility;
        let mut synthetic = provider(None);
        let report = exercise_selected(&mut synthetic, || true, experiment);
        assert_eq!(report.purpose, "synthetic-pkcs1-compatibility");
        assert_eq!(report.algorithm, "rsa-pkcs1-v1_5");
        assert_eq!(report.outcome, "compatibility-passed");
        assert!(!report.eligible && !report.enrolled && !report.unlocked);
        assert_eq!(report.remaining.len(), 4);
        assert_eq!(synthetic.calls.len(), 8);
        for check in &report.checks {
            if !experiment.includes(check.test) && check.test != Stage::TestKeyDelete {
                assert_eq!(check.status, Outcome::NotRun);
            }
        }
        for stage in STEPS
            .into_iter()
            .filter(|stage| experiment.includes(*stage))
        {
            let mut synthetic = provider(Some(stage));
            let failed = exercise_selected(&mut synthetic, || true, experiment);
            assert_eq!(failed.outcome, "blocked");
            assert_eq!(synthetic.calls.last(), Some(&Stage::TestKeyDelete));
            let index = failed
                .checks
                .iter()
                .position(|check| check.test == stage)
                .unwrap();
            assert!(failed.checks[index + 1..12]
                .iter()
                .all(|check| check.status == Outcome::NotRun));
        }
        let mut synthetic = provider(None);
        synthetic.cleanup_failure = true;
        assert_eq!(
            exercise_selected(&mut synthetic, || true, experiment).outcome,
            "blocked"
        );
        for allowed in [6, 7] {
            let calls = std::cell::Cell::new(0);
            let mut synthetic = provider(None);
            let report = exercise_selected(
                &mut synthetic,
                || {
                    calls.set(calls.get() + 1);
                    calls.get() <= allowed
                },
                experiment,
            );
            assert_eq!(report.outcome, "interrupted");
            assert_eq!(synthetic.calls.contains(&Stage::UnwrapFirst), allowed == 7);
            assert_eq!(synthetic.calls.last(), Some(&Stage::TestKeyDelete));
        }
        // A failed OAEP private call still stops that action. It cannot run or
        // return a compatibility pass as an automatic fallback.
        for experiment in [
            Experiment::SecurityProof,
            Experiment::AuthorizedOaepCapability,
        ] {
            let mut synthetic = provider(Some(Stage::UnwrapFirst));
            let report = exercise_selected(&mut synthetic, || true, experiment);
            assert_eq!(report.algorithm, "rsa-oaep-sha256");
            assert_eq!(report.outcome, "blocked");
            assert_eq!(
                synthetic
                    .calls
                    .iter()
                    .filter(|stage| **stage == Stage::UnwrapFirst)
                    .count(),
                1
            );
        }
    }
    #[test]
    fn capability_session_invalidation_prevents_or_discards_authorized_decryption() {
        for allowed in [6, 7] {
            let mut provider = provider(None);
            let calls = std::cell::Cell::new(0);
            let report = exercise_selected(
                &mut provider,
                || {
                    calls.set(calls.get() + 1);
                    calls.get() <= allowed
                },
                Experiment::AuthorizedOaepCapability,
            );
            assert_eq!(report.outcome, "interrupted");
            assert_eq!(provider.calls.contains(&Stage::UnwrapFirst), allowed == 7);
            assert_eq!(provider.calls.last(), Some(&Stage::TestKeyDelete));
        }
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
    fn legacy_behavior_measures_all_stages_without_promoting_eligibility() {
        let mut complete = provider(None);
        let report = exercise_selected(&mut complete, || true, Experiment::Pkcs1Behavior);
        assert_eq!(report.purpose, "synthetic-pkcs1-behavior");
        assert_eq!(report.algorithm, "rsa-pkcs1-v1_5");
        assert_eq!(report.outcome, "behavior-passed");
        assert!(!report.eligible && !report.enrolled && !report.unlocked);
        assert_eq!(report.remaining.len(), 4);
        assert!(report
            .checks
            .iter()
            .all(|check| check.status == Outcome::Passed));
        assert_eq!(&complete.calls[..12], &STEPS);
        assert_eq!(complete.calls.last(), Some(&Stage::TestKeyDelete));
        for (index, stage) in STEPS.into_iter().enumerate() {
            let mut failed = provider(Some(stage));
            let report = exercise_selected(&mut failed, || true, Experiment::Pkcs1Behavior);
            assert_eq!(report.outcome, "blocked");
            assert_eq!(failed.calls.len(), index + 2);
            assert_eq!(failed.calls.last(), Some(&Stage::TestKeyDelete));
            assert_eq!(report.checks[index].status, Outcome::Failed);
            assert!(report.checks[index + 1..12]
                .iter()
                .all(|check| check.status == Outcome::NotRun));
        }
        let mut deletion = provider(None);
        deletion.cleanup_failure = true;
        assert_eq!(
            exercise_selected(&mut deletion, || true, Experiment::Pkcs1Behavior).outcome,
            "blocked"
        );
        // Invalidate before every stage, and after the last stage. No later
        // private operation is started and cleanup remains unconditional.
        for allowed in 0..=12 {
            let mut interrupted = provider(None);
            let calls = std::cell::Cell::new(0);
            let report = exercise_selected(
                &mut interrupted,
                || {
                    calls.set(calls.get() + 1);
                    calls.get() <= allowed
                },
                Experiment::Pkcs1Behavior,
            );
            assert_eq!(report.outcome, "interrupted");
            assert_eq!(interrupted.calls.len(), allowed + 1);
            assert_eq!(interrupted.calls.last(), Some(&Stage::TestKeyDelete));
        }
    }
    #[test]
    fn export_formats_are_measured_without_blessing_unsupported_types() {
        let formats = ["rsa-private", "rsa-full-private", "pkcs8-private"];
        let mut calls = Vec::new();
        let (checks, result) = measure_exports(
            || true,
            |format| {
                calls.push(format);
                Err(Failure {
                    code: Some(if format == "rsa-private" {
                        0x8009000A
                    } else {
                        0x80090010
                    }),
                    ..Failure::failed()
                })
            },
        );
        assert_eq!(calls, formats);
        let error = result.unwrap_err();
        assert_eq!(error.code, Some(0x8009000A));
        assert_eq!(error.operation, Some("private-export-rsa"));
        assert_eq!(checks[0].result, "unsupported-format");
        assert_eq!(checks[1].result, "refused");
        assert_eq!(checks[2].result, "refused");
        // No private data or key identifiers are serialized.
        let json = serde_json::to_string(&checks).unwrap();
        assert!(!json.contains("plaintext") && !json.contains("keyName"));
        for code in [0x8009000A, 0x80090027, 0x80090029] {
            let (checks, result) = measure_exports(
                || true,
                |_| {
                    Err(Failure {
                        code: Some(code),
                        ..Failure::failed()
                    })
                },
            );
            assert!(result.is_err());
            assert!(checks.iter().all(|check| check.result != "refused"));
        }
        let (checks, result) = measure_exports(
            || true,
            |_| {
                Err(Failure {
                    code: Some(0x80090010),
                    ..Failure::failed()
                })
            },
        );
        assert!(result.is_ok());
        assert!(checks.iter().all(|check| check.result == "refused"));
        for stop_at in 0..3 {
            let mut calls = 0;
            let (checks, result) = measure_exports(
                || true,
                |_| {
                    calls += 1;
                    if calls == stop_at + 1 {
                        Ok(())
                    } else {
                        Err(Failure {
                            code: Some(0x80090010),
                            ..Failure::failed()
                        })
                    }
                },
            );
            assert!(result.is_err());
            assert_eq!(calls, stop_at + 1);
            assert_eq!(checks[stop_at].result, "unexpected-success");
            assert!(checks[stop_at + 1..]
                .iter()
                .all(|check| check.result == "not-run"));
        }
        for allowed in 0..3 {
            let calls = std::cell::Cell::new(0);
            let (checks, result) = measure_exports(
                || calls.get() < allowed,
                |_| {
                    calls.set(calls.get() + 1);
                    Err(Failure {
                        code: Some(0x8009000A),
                        ..Failure::failed()
                    })
                },
            );
            assert_eq!(result.unwrap_err().status, Outcome::Interrupted);
            assert_eq!(calls.get(), allowed);
            assert!(checks[allowed..]
                .iter()
                .all(|check| check.result == "not-run"));
        }
        let (_, result) = measure_exports(
            || true,
            |_| {
                Err(Failure {
                    status: Outcome::Cancelled,
                    code: Some(0x80090036),
                    operation: None,
                })
            },
        );
        assert_eq!(result.unwrap_err().status, Outcome::Cancelled);
    }
    #[test]
    fn export_details_survive_failed_gate_and_unconditional_cleanup() {
        struct Exports {
            checks: Vec<ExportCheck>,
            deleted: bool,
        }
        impl Provider for Exports {
            fn step(&mut self, stage: Stage) -> std::result::Result<(), Failure> {
                if stage != Stage::PrivateExport {
                    return Ok(());
                }
                let (checks, result) = measure_exports(
                    || true,
                    |_| {
                        Err(Failure {
                            code: Some(0x8009000A),
                            ..Failure::failed()
                        })
                    },
                );
                self.checks = checks;
                result
            }
            fn cleanup(&mut self) -> std::result::Result<(), Failure> {
                self.deleted = true;
                Ok(())
            }
            fn export_checks(&self) -> Vec<ExportCheck> {
                self.checks.clone()
            }
        }
        let mut provider = Exports {
            checks: Vec::new(),
            deleted: false,
        };
        let report = exercise_selected(&mut provider, || true, Experiment::Pkcs1Behavior);
        assert!(provider.deleted);
        assert_eq!(report.outcome, "blocked");
        assert!(!report.eligible && !report.enrolled && !report.unlocked);
        assert_eq!(report.export_checks.len(), 3);
        assert_eq!(report.checks.last().unwrap().status, Outcome::Passed);
        let value = serde_json::to_value(report).unwrap();
        assert_eq!(value["exportChecks"][2]["format"], "pkcs8-private");
        assert_eq!(value["exportChecks"][2]["nativeCode"], "0x8009000A");
        assert_eq!(value["exportChecks"][2]["result"], "unsupported-format");
    }
    #[test]
    fn cancelled_operation_keeps_its_code_and_still_cleans_up() {
        struct Cancelled(bool);
        impl Provider for Cancelled {
            fn step(&mut self, stage: Stage) -> std::result::Result<(), Failure> {
                if stage != Stage::UnwrapFirst {
                    return Ok(());
                }
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
        for experiment in [
            Experiment::SecurityProof,
            Experiment::AuthorizedOaepCapability,
            Experiment::Pkcs1Compatibility,
            Experiment::Pkcs1Behavior,
        ] {
            let mut provider = Cancelled(false);
            let report = exercise_selected(&mut provider, || true, experiment);
            assert!(provider.0);
            assert_eq!(report.outcome, "cancelled");
            let index = report
                .checks
                .iter()
                .position(|check| check.test == Stage::UnwrapFirst)
                .unwrap();
            assert_eq!(
                report.checks[index].native_code.as_deref(),
                Some("0x80090036")
            );
            assert_eq!(
                report.checks[index].operation,
                Some("native-test-cancellation")
            );
            assert!(report.checks[index + 1..12]
                .iter()
                .all(|check| check.status == Outcome::NotRun));
        }
    }
}
