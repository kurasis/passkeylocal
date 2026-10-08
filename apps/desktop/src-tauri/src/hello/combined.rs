//! Persistent synthetic PRF + TPM experiment. Never enrolls or unlocks a vault.
use super::{
    prf::{check, interrupted, invalid, PrfCheck},
    proof::{Failure, Outcome},
};
use crate::{
    filesystem as io,
    storage::{Error, Result},
};
use libsodium_rs::crypto_aead::aes256gcm as aes;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use zeroize::Zeroizing;

pub mod copy;
pub mod recovery;
#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::{run, run_copy, run_recovery};

#[cfg(test)]
const RP: &str = "combined.passkey-local.desktop.invalid";
const DOMAIN: &str = "PassKey Local synthetic PRF+TPM envelope v1";
const MAX_RECORD: usize = 32 * 1024;
type ProofResult<T> = std::result::Result<T, Failure>;

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Header {
    domain: String,
    version: u32,
    id: String,
    creator: String,
    source: String,
    salt: [u8; 32],
    credential: Vec<u8>,
    public: Vec<u8>,
    name: Vec<u8>,
    expected: [u8; 32],
    #[serde(default, skip_serializing_if = "Option::is_none")]
    copy_context: Option<copy::Context>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    recovery_fixture: Option<String>,
}
impl Header {
    fn key_name(&self) -> String {
        format!("PassKeyLocal.CombinedTest.{}", self.id)
    }
    fn user(&self) -> [u8; 32] {
        Sha256::digest(format!("{DOMAIN}:{}", self.id)).into()
    }
    fn aad(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("fixed metadata is serializable")
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    header: Header,
    ready: bool,
    nonce: [u8; 12],
    ciphertext: Vec<u8>,
}
impl Record {
    fn new(process: &str) -> Self {
        let mut salt = [0; 32];
        libsodium_rs::random::fill_bytes(&mut salt);
        Self {
            header: Header {
                domain: DOMAIN.into(),
                version: 1,
                id: uuid::Uuid::new_v4().to_string(),
                creator: process.into(),
                source: option_env!("PASSKEY_SOURCE_COMMIT")
                    .unwrap_or("development")
                    .into(),
                salt,
                credential: vec![],
                public: vec![],
                name: vec![],
                expected: [0; 32],
                copy_context: None,
                recovery_fixture: None,
            },
            ready: false,
            nonce: [0; 12],
            ciphertext: vec![],
        }
    }
    fn validate(&self) -> Result<()> {
        let h = &self.header;
        if h.domain != DOMAIN
            || h.version != 1
            || !canonical_uuid(&h.id)
            || !canonical_uuid(&h.creator)
            || h.recovery_fixture
                .as_ref()
                .is_some_and(|id| id != recovery::FIXTURE_ID || h.copy_context.is_some())
            || h.source.len() > 64
            || h.credential.len() > 4096
            || h.public.len() > 2048
            || h.name.len() > 68
            || self.ciphertext.len() > 272
            || (self.ready
                && (h.credential.is_empty()
                    || h.public.is_empty()
                    || h.name.len() != 34
                    || self.ciphertext.len() != 272))
        {
            return Err(Error::new("INVALID_STATE"));
        }
        Ok(())
    }
    fn seal(&mut self, inner: &[u8], prf: &[u8; 32]) -> ProofResult<()> {
        if inner.len() != 256 {
            return Err(invalid("combined-inner-length"));
        }
        let key = derived_key(prf, &self.header)?;
        let nonce = aes::Nonce::generate();
        self.nonce.copy_from_slice(nonce.as_ref());
        self.ciphertext = aes::encrypt(inner, Some(&self.header.aad()), &nonce, &key)
            .map_err(|_| invalid("combined-seal"))?;
        Ok(())
    }
    fn open(&self, prf: &[u8; 32]) -> ProofResult<Zeroizing<Vec<u8>>> {
        let key = derived_key(prf, &self.header)?;
        let plaintext = Zeroizing::new(
            aes::decrypt(
                &self.ciphertext,
                Some(&self.header.aad()),
                &aes::Nonce::from_bytes(self.nonce),
                &key,
            )
            .map_err(|_| invalid("combined-authenticated-envelope"))?,
        );
        if plaintext.len() != 256 {
            return Err(invalid("combined-inner-length"));
        }
        Ok(plaintext)
    }
}
fn canonical_uuid(s: &str) -> bool {
    uuid::Uuid::parse_str(s).is_ok_and(|v| v.get_version_num() == 4 && v.to_string() == s)
}
fn derived_key(prf: &[u8; 32], h: &Header) -> ProofResult<aes::Key> {
    if !aes::is_available() {
        return Err(invalid("combined-aes-unavailable"));
    }
    let mut key = Zeroizing::new([0; 32]);
    hkdf::Hkdf::<Sha256>::new(Some(&h.salt), prf)
        .expand(DOMAIN.as_bytes(), key.as_mut_slice())
        .map_err(|_| invalid("combined-kdf"))?;
    aes::Key::from_bytes(key.as_slice()).map_err(|_| invalid("combined-key"))
}
struct Journal {
    path: PathBuf,
    _pins: Vec<fs::File>,
}
impl Journal {
    // The caller holds the vault Store process lock for the entire lifetime of
    // this app, plus Attempt for this operation. The root is never renderer supplied.
    fn open(root: &Path) -> Result<Self> {
        let root = io::child(root, "hello-combined-test")?;
        io::reject_links(&root)?;
        fs::create_dir_all(&root)?;
        io::secure_directory(&root)?;
        let pins = io::pin_directory(&root)?;
        Ok(Self {
            path: io::child(&root, "test.json")?,
            _pins: pins,
        })
    }
    fn read(&self) -> Result<Option<Record>> {
        self.remove_pending()
            .map_err(|_| Error::new("INVALID_STATE"))?;
        match fs::symlink_metadata(&self.path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
            Ok(_) => {}
        }
        let r: Record = serde_json::from_slice(&io::read(&self.path, MAX_RECORD)?)?;
        r.validate()?;
        Ok(Some(r))
    }
    fn save(&self, r: &Record) -> ProofResult<()> {
        r.validate()
            .map_err(|_| invalid("combined-journal-invalid"))?;
        let bytes = serde_json::to_vec(r).map_err(|_| invalid("combined-journal-encode"))?;
        if bytes.len() > MAX_RECORD {
            return Err(invalid("combined-journal-size"));
        }
        // A fixed staging name is recoverable after a crash; never accumulate
        // untracked metadata temporaries. No native object is created until
        // this replacement and exact readback have completed.
        let pending = self.path.with_file_name("test.pending.json");
        self.remove_pending()?;
        io::exclusive_write(&pending, &bytes).map_err(|_| invalid("combined-journal-stage"))?;
        let replaced = io::replace(&pending, &self.path, None, !self.path.exists());
        if io::read(&self.path, MAX_RECORD).ok().as_deref() == Some(&bytes) {
            self.remove_pending()?;
            return Ok(());
        }
        replaced.map_err(|_| invalid("combined-journal-replace"))?;
        Err(invalid("combined-journal-write-readback"))
    }
    fn remove_pending(&self) -> ProofResult<()> {
        let pending = self.path.with_file_name("test.pending.json");
        match fs::symlink_metadata(&pending) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(_) => return Err(invalid("combined-journal-stage-metadata")),
            Ok(_) => {}
        }
        let bytes =
            io::read(&pending, MAX_RECORD).map_err(|_| invalid("combined-journal-stage-read"))?;
        let hash = format!("{:x}", Sha256::digest(bytes));
        if !io::remove_verified(&pending, &hash)
            .map_err(|_| invalid("combined-journal-stage-delete"))?
        {
            return Err(invalid("combined-journal-stage-mismatch"));
        }
        Ok(())
    }

    fn remove(&self) -> ProofResult<()> {
        self.remove_pending()?;
        let bytes = io::read(&self.path, MAX_RECORD)
            .map_err(|_| invalid("combined-journal-read-delete"))?;
        let hash = format!("{:x}", Sha256::digest(&bytes));
        if !io::remove_verified(&self.path, &hash)
            .map_err(|_| invalid("combined-journal-delete"))?
        {
            return Err(invalid("combined-journal-delete-mismatch"));
        }
        Ok(())
    }
}

#[derive(Clone, Copy)]
pub enum Action {
    Status,
    Prepare,
    Resume,
    Cleanup,
    KeyLoss,
}
impl Action {
    fn creates_test(self) -> bool {
        matches!(self, Self::Prepare | Self::KeyLoss)
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    version: u32,
    source_commit: Option<&'static str>,
    purpose: &'static str,
    algorithm: &'static str,
    eligible: bool,
    enrolled: bool,
    unlocked: bool,
    pub outcome: &'static str,
    #[serde(skip_serializing_if = "empty_state")]
    pub combined_state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    copy_evidence: Option<copy::Evidence>,
    process_scope: &'static str,
    authorization: &'static str,
    pub checks: Vec<PrfCheck>,
    remaining: [&'static str; 3],
}
fn empty_state(s: &&str) -> bool {
    s.is_empty()
}
impl Report {
    fn new(state: &'static str) -> Self {
        Self {
            version: 1,
            source_commit: option_env!("PASSKEY_SOURCE_COMMIT"),
            purpose: "synthetic-combined-restart",
            algorithm: "webauthn-prf-aes256gcm-tpm-oaep-sha256",
            eligible: false,
            enrolled: false,
            unlocked: false,
            outcome: state,
            combined_state: state,
            copy_evidence: None,
            process_scope: "same-process",
            authorization: "os-required-user-verification",
            checks: vec![],
            remaining: [
                "fresh-authorization-proof",
                "fresh-process-proof",
                "account-machine-copy-proof",
            ],
        }
    }
    fn stage<T>(&mut self, name: &'static str, result: ProofResult<T>) -> ProofResult<T> {
        match result {
            Ok(v) => {
                self.checks.push(check(name, Ok(())));
                Ok(v)
            }
            Err(e) => {
                self.outcome = match e.status {
                    Outcome::Cancelled => "cancelled",
                    Outcome::Interrupted => "interrupted",
                    _ => "blocked",
                };
                self.checks.push(check(name, Err(e)));
                Err(e)
            }
        }
    }
}
// Imported files can use this interface only; it cannot create or delete keys.
trait Reader {
    fn reopen_tpm(&mut self, h: &Header) -> ProofResult<()>;
    fn reopen_prf(&mut self, h: &Header) -> ProofResult<()>;
    fn reopen(&mut self, h: &Header) -> ProofResult<()> {
        self.reopen_tpm(h)?;
        self.reopen_prf(h)
    }
    fn authorize(&mut self) -> ProofResult<Zeroizing<[u8; 32]>>;
    fn unwrap(&mut self, cipher: &[u8]) -> ProofResult<Zeroizing<Vec<u8>>>;
}
trait Backend: Reader {
    fn initialize(&mut self) -> ProofResult<()>;
    fn create_tpm(&mut self) -> ProofResult<(Vec<u8>, Vec<u8>)>;
    fn create_prf(&mut self) -> ProofResult<(Vec<u8>, Zeroizing<[u8; 32]>)>;
    fn wrap(&mut self, secret: &[u8; 32]) -> ProofResult<Vec<u8>>;
    fn cleanup_prf(&mut self) -> ProofResult<()>;
    fn cleanup_tpm(&mut self) -> ProofResult<()>;
}
fn active(current: &dyn Fn() -> bool) -> ProofResult<()> {
    if current() {
        Ok(())
    } else {
        Err(interrupted("combined-session-invalidated"))
    }
}
fn verify(r: &Record, b: &mut impl Reader, current: &dyn Fn() -> bool) -> ProofResult<()> {
    recover(r, b, current).map(drop)
}
fn recover(
    r: &Record,
    b: &mut impl Reader,
    current: &dyn Fn() -> bool,
) -> ProofResult<Zeroizing<Vec<u8>>> {
    active(current)?;
    let prf = b.authorize()?;
    active(current)?;
    let inner = r.open(&prf)?;
    drop(prf);
    active(current)?;
    let secret = b.unwrap(&inner)?;
    active(current)?;
    if secret.len() != 32
        || !libsodium_rs::utils::memcmp(&Sha256::digest(&secret), &r.header.expected)
    {
        return Err(invalid("combined-secret-digest-mismatch"));
    }
    Ok(secret)
}
fn cleanup(j: &Journal, b: &mut impl Backend, report: &mut Report) -> ProofResult<()> {
    report.combined_state = "cleanup-required";
    // Mark nonresumable BEFORE deleting either object, including successful resumes.
    let prepare_cleanup = (|| {
        let mut record = j
            .read()
            .map_err(|_| invalid("combined-cleanup-journal-read"))?
            .ok_or_else(|| invalid("combined-cleanup-journal-missing"))?;
        record.ready = false;
        j.save(&record)
    })();
    report.stage("combined-journal-cleanup", prepare_cleanup)?;
    // Both are attempted even if the other fails. Keep the journal for retry.
    let prf = report.stage("test-passkey-delete", b.cleanup_prf());
    let tpm = report.stage("test-key-delete", b.cleanup_tpm());
    prf?;
    tpm?;
    report.stage("combined-journal-delete", j.remove())?;
    report.combined_state = "no-test";
    Ok(())
}
// An expected absence is narrowly classified. Cancellation, policy errors and
// provider failures are not evidence that a deleted key is inaccessible.
fn expect_missing(
    report: &mut Report,
    stage: &'static str,
    result: ProofResult<()>,
    operation: &'static str,
    code: Option<u32>,
) -> ProofResult<()> {
    match result {
        Err(e)
            if e.status == Outcome::Failed && e.operation == Some(operation) && e.code == code =>
        {
            let mut observed = check(stage, Err(e));
            observed.status = Outcome::Passed;
            report.checks.push(observed);
            Ok(())
        }
        Err(e) => report.stage(stage, Err(e)),
        Ok(()) => report.stage(stage, Err(invalid("combined-deleted-object-reopened"))),
    }
}
fn key_loss(
    j: &Journal,
    r: &mut Record,
    b: &mut impl Backend,
    current: &dyn Fn() -> bool,
    report: &mut Report,
) -> ProofResult<()> {
    // The successful prepare round trip is the positive control for these exact
    // identities. Persist nonresumability before intentionally losing a key.
    active(current)?;
    r.ready = false;
    report.stage("loss-journal-invalidate", j.save(r))?;
    report.combined_state = "cleanup-required";
    active(current)?;
    report.stage("loss-passkey-delete", b.cleanup_prf())?;
    active(current)?;
    expect_missing(
        report,
        "loss-passkey-reopen",
        b.reopen_prf(&r.header),
        "combined-credential-missing",
        None,
    )?;
    active(current)?;
    // Reopening the still-existing TPM key is an independent positive control:
    // missing PRF must not be mistaken for missing TPM or a broken provider.
    report.stage("loss-tpm-positive-control", b.reopen_tpm(&r.header))?;
    active(current)?;
    report.stage("loss-tpm-delete", b.cleanup_tpm())?;
    active(current)?;
    expect_missing(
        report,
        "loss-tpm-reopen",
        b.reopen_tpm(&r.header),
        "tpm-reopen-exact-test-key",
        Some(0x80090016),
    )?; // NTE_BAD_KEYSET only
    active(current)
}
fn prepare(
    j: &Journal,
    r: &mut Record,
    b: &mut impl Backend,
    current: &dyn Fn() -> bool,
    report: &mut Report,
) -> ProofResult<()> {
    let mut secret = Zeroizing::new([0; 32]);
    libsodium_rs::random::fill_bytes(secret.as_mut_slice());
    prepare_secret(j, r, b, current, report, &secret).map(drop)
}
fn prepare_secret(
    j: &Journal,
    r: &mut Record,
    b: &mut impl Backend,
    current: &dyn Fn() -> bool,
    report: &mut Report,
    secret: &[u8; 32],
) -> ProofResult<Zeroizing<Vec<u8>>> {
    report.stage("combined-journal-create", j.save(r))?; // BEFORE either persisted native object
    report.combined_state = "cleanup-required";
    report.stage("combined-preflight", b.initialize())?;
    active(current)?;
    let (public, name) = report.stage("combined-tpm-create-binding", b.create_tpm())?;
    r.header.public = public;
    r.header.name = name;
    active(current)?;
    let (id, prf) = report.stage("combined-prf-create", b.create_prf())?;
    r.header.credential = id;
    r.header.expected = Sha256::digest(secret.as_slice()).into();
    let inner = report.stage("combined-tpm-wrap", b.wrap(secret))?;
    report.stage("combined-seal", r.seal(&inner, &prf))?;
    // Independent authenticated-envelope negatives before disposing of the creation output.
    report.stage("combined-negative-controls", negative_controls(r, &prf))?;
    drop(prf);
    let recovered = report.stage("combined-unwrap-first", recover(r, b, current))?;
    active(current)?;
    r.ready = true;
    report.stage("combined-journal-ready", j.save(r))?;
    active(current)?;
    report.combined_state = "restart-required";
    report.outcome = "restart-required";
    Ok(recovered)
}
fn negative_controls(r: &Record, prf: &[u8; 32]) -> ProofResult<()> {
    let good = r.open(prf)?;
    let mut changed = r.clone();
    changed.ciphertext[0] ^= 1;
    let mut aad = r.clone();
    aad.header.expected[0] ^= 1;
    let mut wrong = Zeroizing::new(*prf);
    wrong[0] ^= 1;
    if changed.open(prf).is_ok() || aad.open(prf).is_ok() || r.open(&wrong).is_ok() {
        return Err(invalid("combined-tamper-accepted"));
    }
    if *good != *r.open(prf)? {
        return Err(invalid("combined-positive-control-mismatch"));
    }
    Ok(())
}
fn state(r: Option<&Record>, process: &str) -> &'static str {
    match r {
        None => "no-test",
        Some(r) if !r.ready => "cleanup-required",
        Some(r) if r.header.copy_context.is_some() => "copy-ready",
        Some(r) if r.header.recovery_fixture.is_some() => "recovery-ready",
        Some(r) if r.header.creator == process => "restart-required",
        Some(_) => "ready-to-resume",
    }
}
fn execute(
    j: &Journal,
    r: &mut Record,
    b: &mut impl Backend,
    action: Action,
    process: &str,
    current: &dyn Fn() -> bool,
) -> Report {
    let mut report = Report::new(state(Some(r), process));
    if matches!(action, Action::KeyLoss) {
        report.purpose = "synthetic-combined-key-loss";
        // This action owns only objects it creates in this invocation. It must
        // never reuse or overwrite a saved restart/cancellation experiment.
        match j.read() {
            Ok(None) => {}
            Ok(Some(existing)) => {
                return Report {
                    purpose: report.purpose,
                    ..Report::new(state(Some(&existing), process))
                }
            }
            Err(_) => {
                let _ = report.stage::<()>(
                    "combined-journal-create",
                    Err(invalid("combined-existing-journal-unreadable")),
                );
                return report;
            }
        }
    }
    match action {
        Action::KeyLoss => {
            let result = prepare(j, r, b, current, &mut report)
                .and_then(|()| key_loss(j, r, b, current, &mut report));
            if let Err(e) = result {
                if report.checks.iter().all(|c| c.status == Outcome::Passed) {
                    let _ = report.stage::<()>("combined-session", Err(e));
                }
            }
            let outcome = report.outcome;
            if j.path.exists() && cleanup(j, b, &mut report).is_ok() {
                if result.is_ok() {
                    if report.stage("loss-session-final", active(current)).is_ok() {
                        report.outcome = "combined-key-loss-passed";
                    }
                } else {
                    report.outcome = outcome;
                }
            }
        }
        Action::Prepare => {
            if let Err(e) = prepare(j, r, b, current, &mut report) {
                // Also record a boundary interruption that occurred between stages.
                if report.outcome != "blocked"
                    && report.outcome != "cancelled"
                    && report.outcome != "interrupted"
                {
                    let _ = report.stage::<()>("combined-session", Err(e));
                }
                let outcome = report.outcome;
                if j.path.exists() && cleanup(j, b, &mut report).is_err() {
                    report.combined_state = "cleanup-required";
                }
                if report.combined_state == "no-test" {
                    report.outcome = outcome;
                }
            }
        }
        Action::Resume => {
            if !r.ready
                || r.header.copy_context.is_some()
                || r.header.recovery_fixture.is_some()
                || r.header.creator == process
            {
                return report;
            }
            report.process_scope = "fresh-process";
            let result = (|| {
                report.stage("combined-reopen-binding", b.reopen(&r.header))?;
                report.stage("combined-unwrap-first", verify(r, b, current))?;
                report.stage("combined-unwrap-second", verify(r, b, current))?;
                active(current)?;
                cleanup(j, b, &mut report)?;
                active(current)?;
                Ok::<_, Failure>(())
            })();
            if result.is_ok() {
                report.outcome = "combined-restart-passed";
            } else if !report.checks.iter().any(|c| c.status != Outcome::Passed) {
                let _ = report.stage::<()>("combined-session", result);
            }
        }
        Action::Cleanup => {
            if cleanup(j, b, &mut report).is_ok() {
                report.outcome = "combined-cleaned";
            } else {
                report.combined_state = "cleanup-required";
            }
        }
        Action::Status => {}
    }
    report
}

#[cfg(test)]
mod tests;
