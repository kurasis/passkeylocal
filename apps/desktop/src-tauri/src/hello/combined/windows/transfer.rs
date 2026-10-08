use super::*;
use crate::hello::combined::copy as transport;

// The imported-record adapter deliberately implements only Reader. No journal,
// native creation, native deletion or vault API can be reached through it.
struct ImportReader<'a> {
    credential: Credential<'a>,
    key: Key<'a>,
}
impl Reader for ImportReader<'_> {
    fn reopen_tpm(&mut self, h: &Header) -> ProofResult<()> {
        self.key.reopen(&h.public, &h.name)
    }
    fn reopen_prf(&mut self, h: &Header) -> ProofResult<()> {
        self.credential.reopen_for_copy(&h.credential)
    }
    fn authorize(&mut self) -> ProofResult<Zeroizing<[u8; 32]>> {
        self.credential.authorize()
    }
    fn unwrap(&mut self, bytes: &[u8]) -> ProofResult<Zeroizing<Vec<u8>>> {
        self.key.unwrap(bytes)
    }
}

pub fn run_copy(
    root: &Path,
    hwnd: usize,
    current: impl Fn() -> bool + Sync,
    action: transport::Action,
    choose: impl FnOnce(bool) -> Option<PathBuf>,
) -> Result<Report> {
    let _attempt = crate::hello::Attempt::begin()?;
    libsodium_rs::ensure_init().map_err(|_| Error::new("UNAVAILABLE"))?;
    let mut report = transport::report();
    if matches!(action, transport::Action::Check) {
        let result = (|| {
            active(&current)?;
            let path = choose(false).ok_or(Failure {
                status: Outcome::Cancelled,
                code: None,
                operation: Some("copy-file-dialog"),
            })?;
            active(&current)?;
            let path = io::user_path(&path).map_err(|_| invalid("copy-file-path"))?;
            io::read(&path, MAX_RECORD).map_err(|_| invalid("copy-file-read"))
        })();
        let bytes = match report.stage("copy-file-read", result) {
            Ok(b) => b,
            Err(_) => return Ok(report),
        };
        // No managed Journal is opened on import, even when its local state is corrupt.
        let mut observed = transport::inspect(
            &bytes,
            transport::observe,
            |r| ImportReader {
                credential: Credential::new(hwnd, &current, r.header.salt, r.header.user()),
                key: Key::new(&r.header.key_name(), &current),
            },
            &current,
        );
        observed.checks.insert(0, report.checks.remove(0));
        return Ok(observed);
    }
    let j = Journal::open(root)?;
    let existing = j.read()?;
    let process = process_id();
    report.combined_state = state(existing.as_ref(), process);
    if (existing.is_some() && matches!(action, transport::Action::PrepareExport))
        || (existing.is_none() && matches!(action, transport::Action::Export))
    {
        report.outcome = report.combined_state;
        return Ok(report);
    }
    let mut r = existing.unwrap_or_else(|| Record::new(process));
    let result = (|| {
        active(&current)?;
        if matches!(action, transport::Action::Export)
            && (!r.ready || r.header.copy_context.is_none())
        {
            return Err(invalid("copy-export-requires-copy-test"));
        }
        // Choose a NEW destination before native object creation. Cancellation
        // does not leave a fresh test pair behind or affect an existing pair.
        let path = report.stage(
            "copy-file-select",
            choose(true).ok_or(Failure {
                status: Outcome::Cancelled,
                code: None,
                operation: Some("copy-file-dialog"),
            }),
        )?;
        active(&current)?;
        let target = report.stage("copy-context", transport::observe(&r.header.salt))?;
        let mut native = Native {
            credential: Credential::new(hwnd, &current, r.header.salt, r.header.user()),
            key: Key::new(&r.header.key_name(), &current),
        };
        if matches!(action, transport::Action::PrepareExport) {
            r.header.copy_context = Some(target.clone());
            let prepared = execute(&j, &mut r, &mut native, Action::Prepare, process, &current);
            report.checks.extend(prepared.checks);
            report.combined_state = prepared.combined_state;
            if prepared.outcome != "restart-required" {
                report.outcome = prepared.outcome;
                return Ok(()); // prepare owns cleanup/recovery for failures
            }
        } else {
            if r.header.copy_context.as_ref() != Some(&target) {
                return Err(invalid("copy-export-context-mismatch"));
            }
            report.stage("copy-source-binding", native.reopen(&r.header))?;
            report.stage("copy-source-decrypt", verify(&r, &mut native, &current))?;
        }
        report.combined_state = "copy-ready";
        active(&current)?;
        let bytes = report.stage("copy-file-encode", transport::encode(&r))?;
        let evidence = transport::exported(&r, &bytes, &target)?;
        report.stage("copy-file-write", transport::write_file(&path, &bytes))?;
        report.copy_evidence = Some(evidence);
        report.stage("copy-session-final", active(&current))?;
        report.outcome = "copy-exported";
        Ok(())
    })();
    if let Err(e) = result {
        if report.checks.iter().all(|c| c.status == Outcome::Passed) {
            let _ = report.stage::<()>("copy-session-final", Err(e));
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());
    #[test]
    fn native_copy_dialog_cancellation_and_no_record_export_touch_no_keys() {
        let _serial = SERIAL.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let report = run_copy(dir.path(), 0, || true, transport::Action::Check, |_| None).unwrap();
        assert_eq!(report.outcome, "cancelled");
        assert!(!dir.path().join("hello-combined-test").exists());
        let report = run_copy(
            dir.path(),
            0,
            || true,
            transport::Action::Export,
            |_| panic!("no record must not open dialog"),
        )
        .unwrap();
        assert_eq!(report.outcome, "no-test");
        assert!(report.checks.is_empty());
        let report = run_copy(
            dir.path(),
            0,
            || true,
            transport::Action::PrepareExport,
            |_| None,
        )
        .unwrap();
        assert_eq!(report.outcome, "cancelled");
        assert!(Journal::open(dir.path()).unwrap().read().unwrap().is_none());
    }
    #[test]
    fn native_copy_import_ignores_even_corrupt_local_journals_and_never_persists_input() {
        let _serial = SERIAL.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        fs::write(&j.path, b"existing corrupt journal").unwrap();
        let path = dir.path().join("test.hello-test");
        fs::write(&path, b"{").unwrap();
        let report = run_copy(
            dir.path(),
            0,
            || true,
            transport::Action::Check,
            |_| Some(path.clone()),
        )
        .unwrap();
        assert_eq!(report.outcome, "blocked");
        assert_eq!(report.checks.last().unwrap().test, "copy-file-validate");
        assert_eq!(fs::read(&j.path).unwrap(), b"existing corrupt journal");
        assert_eq!(fs::read(&path).unwrap(), b"{");
    }
    #[test]
    fn native_copy_creation_refuses_existing_experiment_before_dialog_or_key_access() {
        let _serial = SERIAL.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path()).unwrap();
        let r = Record::new(process_id());
        j.save(&r).unwrap();
        let before = fs::read(&j.path).unwrap();
        let report = run_copy(
            dir.path(),
            0,
            || true,
            transport::Action::PrepareExport,
            |_| panic!("existing test must not open dialog"),
        )
        .unwrap();
        assert_eq!(report.outcome, "cleanup-required");
        assert_eq!(fs::read(&j.path).unwrap(), before);
    }
}
