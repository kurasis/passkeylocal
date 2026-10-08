//! Bounded synthetic copy files. Import is an observation, never a journal restore.
use super::*;
use std::io::Write;
#[cfg(windows)]
mod context;
#[cfg(windows)]
pub(super) use context::observe;

const FILE_DOMAIN: &str = "PassKey Local synthetic Hello copy test";
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Context {
    installation: [u8; 32],
    account: [u8; 32],
}
impl Context {
    fn new(salt: &[u8; 32], installation: &[u8], account: &[u8]) -> Self {
        let label = |domain: &[u8], value: &[u8]| {
            let mut h = Sha256::new();
            h.update(FILE_DOMAIN);
            h.update(salt);
            h.update(domain);
            h.update(value);
            h.finalize().into()
        };
        Self {
            installation: label(b"installation", installation),
            account: label(b"account", account),
        }
    }
    fn relation(&self, target: &Self) -> &'static str {
        if self.installation != target.installation {
            "different-installation"
        } else if self.account != target.account {
            "different-account"
        } else {
            "same-account-and-installation"
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Evidence {
    file_sha256: String,
    origin_source_commit: String,
    context_relation: &'static str,
    // Imported metadata cannot be authenticated when the keys are unavailable.
    // Pair the full-file digest with export AND source recheck reports.
    correlation: &'static str,
    tpm_access: &'static str,
    passkey_access: &'static str,
}
impl Evidence {
    fn new(bytes: &[u8], r: &Record, target: &Context) -> Self {
        Self {
            file_sha256: format!("{:x}", Sha256::digest(bytes)),
            origin_source_commit: r.header.source.clone(),
            context_relation: r.header.copy_context.as_ref().unwrap().relation(target),
            correlation: "match-export-and-source-recheck",
            tpm_access: "not-run",
            passkey_access: "not-run",
        }
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Package {
    format: String,
    version: u32,
    record: Record,
}
#[derive(Clone, Copy)]
pub enum Action {
    PrepareExport,
    Export,
    Check,
}

pub(super) fn report() -> Report {
    let mut r = Report::new(""); // Import must not overwrite the source journal's UI state.
    r.outcome = "blocked";
    r.purpose = "synthetic-combined-copy";
    r.process_scope = "not-measured";
    r
}
fn validate(r: &Record) -> ProofResult<()> {
    r.validate().map_err(|_| invalid("copy-record-invalid"))?;
    if !r.ready || r.header.copy_context.is_none() || r.header.recovery_fixture.is_some() {
        return Err(invalid("copy-record-not-ready"));
    }
    Ok(())
}
pub(super) fn encode(r: &Record) -> ProofResult<Vec<u8>> {
    validate(r)?;
    let bytes = serde_json::to_vec(&Package {
        format: FILE_DOMAIN.into(),
        version: 1,
        record: r.clone(),
    })
    .map_err(|_| invalid("copy-file-encode"))?;
    if bytes.len() > MAX_RECORD {
        return Err(invalid("copy-file-size"));
    }
    Ok(bytes)
}
fn decode(bytes: &[u8]) -> ProofResult<Record> {
    if bytes.len() > MAX_RECORD {
        return Err(invalid("copy-file-size"));
    }
    let p: Package = serde_json::from_slice(bytes).map_err(|_| invalid("copy-file-format"))?;
    if p.format != FILE_DOMAIN || p.version != 1 {
        return Err(invalid("copy-file-version"));
    }
    validate(&p.record)?;
    Ok(p.record)
}
// A user-selected transport file inherits the destination ACL. It contains only
// synthetic ciphertext/public metadata and must be readable after copying to
// another account. Unlike managed journals, do not attach the source user's DACL.
pub(super) fn write_file(path: &Path, bytes: &[u8]) -> ProofResult<()> {
    decode(bytes)?;
    let write = (|| -> Result<()> {
        let path = io::user_path(path)?;
        let _pins = io::pin_directory(path.parent().ok_or(Error::new("INVALID_STATE"))?)?;
        let mut opts = fs::OpenOptions::new();
        opts.write(true).create_new(true); // Refuse overwrite, even if the dialog offers it.
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            opts.share_mode(0).custom_flags(0x00200000);
        }
        let mut f = opts.open(&path)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        if io::read(&path, MAX_RECORD)? != bytes {
            return Err(Error::new("READBACK_FAILED"));
        }
        Ok(())
    })();
    write.map_err(|_| invalid("copy-export-write-readback"))
}
pub(super) fn exported(r: &Record, bytes: &[u8], target: &Context) -> ProofResult<Evidence> {
    validate(r)?;
    if r.header.copy_context.as_ref() != Some(target) {
        return Err(invalid("copy-export-context-mismatch"));
    }
    Ok(Evidence {
        tpm_access: "opened",
        passkey_access: "opened",
        ..Evidence::new(bytes, r, target)
    })
}
fn access(
    report: &mut Report,
    stage: &'static str,
    result: ProofResult<()>,
    operation: &'static str,
    code: Option<u32>,
) -> ProofResult<&'static str> {
    match result {
        Ok(()) => {
            report.stage(stage, Ok(()))?;
            Ok("opened")
        }
        Err(e)
            if e.status == Outcome::Failed && e.operation == Some(operation) && e.code == code =>
        {
            let mut c = check(stage, Err(e));
            c.status = Outcome::Passed;
            report.checks.push(c);
            Ok("missing")
        }
        Err(e) => {
            report.stage::<()>(stage, Err(e))?;
            unreachable!()
        }
    }
}
pub(super) fn inspect<B: Reader>(
    bytes: &[u8],
    context: impl FnOnce(&[u8; 32]) -> ProofResult<Context>,
    reader: impl FnOnce(&Record) -> B,
    current: &dyn Fn() -> bool,
) -> Report {
    let mut report = report();
    let result = (|| {
        active(current)?;
        let r = report.stage("copy-file-validate", decode(bytes))?;
        let target = report.stage("copy-context", context(&r.header.salt))?;
        let mut evidence = Evidence::new(bytes, &r, &target);
        let same = evidence.context_relation == "same-account-and-installation";
        report.copy_evidence = Some(evidence);
        active(current)?;
        let mut b = reader(&r);
        let tpm = access(
            &mut report,
            "copy-tpm-open",
            b.reopen_tpm(&r.header),
            "tpm-reopen-exact-test-key",
            Some(0x80090016),
        );
        report.copy_evidence.as_mut().unwrap().tpm_access =
            tpm.as_ref().copied().unwrap_or("error");
        active(current)?;
        let prf = access(
            &mut report,
            "copy-passkey-open",
            b.reopen_prf(&r.header),
            "combined-credential-missing",
            None,
        );
        evidence = report.copy_evidence.take().unwrap();
        evidence.tpm_access = tpm.as_ref().copied().unwrap_or("error");
        evidence.passkey_access = prf.as_ref().copied().unwrap_or("error");
        report.copy_evidence = Some(evidence);
        let tpm = tpm?;
        let prf = prf?;
        active(current)?;
        if same && (tpm != "opened" || prf != "opened") {
            return report.stage(
                "copy-source-decrypt",
                Err(invalid("copy-source-keys-missing")),
            );
        }
        if tpm == "opened" && prf == "opened" {
            report.stage("copy-source-decrypt", verify(&r, &mut b, current))?;
            if !same {
                return report.stage(
                    "copy-foreign-access",
                    Err(invalid("copy-foreign-context-decrypted")),
                );
            }
        }
        report.stage("copy-session-final", active(current))?;
        report.outcome = if same {
            "copy-source-roundtrip-passed"
        } else {
            "copy-isolation-observed"
        };
        Ok(())
    })();
    if let Err(e) = result {
        if report.checks.iter().all(|c| c.status == Outcome::Passed) {
            let _ = report.stage::<()>("copy-session-final", Err(e));
        }
    }
    report
}

#[cfg(test)]
mod tests;
