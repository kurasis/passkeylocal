use crate::filesystem as io;
use chrono::Utc;
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use uuid::Uuid;

pub const MAX_BYTES: usize = 16 * 1024 * 1024;
pub type Result<T> = std::result::Result<T, Error>;
#[derive(Debug, Serialize)]
pub struct Error {
    pub code: &'static str,
}
impl Error {
    pub fn new(code: &'static str) -> Self {
        Self { code }
    }
}
impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Self::new(if matches!(e.raw_os_error(), Some(28) | Some(112)) {
            "QUOTA"
        } else if e.kind() == std::io::ErrorKind::NotFound {
            "NOT_FOUND"
        } else {
            "WRITE_FAILED"
        })
    }
}
impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Self::new("CORRUPT")
    }
}

pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn stamp() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
fn id() -> String {
    Uuid::new_v4().to_string()
}
fn parse_id(s: &str) -> Result<()> {
    if Uuid::parse_str(s).is_ok() {
        Ok(())
    } else {
        Err(Error::new("INVALID_STATE"))
    }
}
fn hash_valid(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn arg<T: serde::de::DeserializeOwned>(v: &Value, key: &str) -> Result<T> {
    serde_json::from_value(v.get(key).cloned().unwrap_or(Value::Null))
        .map_err(|_| Error::new("INVALID_STATE"))
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Head {
    slot: String,
    blob_id: String,
    generation: u64,
    format: String,
    password_epoch: u64,
    committed_at: String,
    verified_generation: Option<u64>,
    unbacked_since: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Blob {
    id: String,
    sha256: String,
    size: usize,
    generation: u64,
    password_epoch: u64,
    committed_at: String,
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Backup {
    folder: Option<PathBuf>,
    owner: String,
    retention: usize,
    folder_identity: Option<String>,
    tracked: Vec<TrackedBackup>,
    // A bounded queue: only the latest immutable revision is pending.
    pending: Option<String>,
    status: String,
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Metadata {
    version: u32,
    head: Option<Head>,
    blobs: Vec<Blob>,
    receipts: Vec<Value>,
    preferences: BTreeMap<String, Value>,
    backup: Backup,
}
#[derive(Deserialize, Serialize)]
struct Journal {
    previous: Metadata,
    next: Metadata,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TrackedBackup {
    name: String,
    sha256: String,
}

/// At most one in-flight immutable ciphertext copy, outside the store mutex.
pub struct BackupJob {
    folder: PathBuf,
    folder_identity: String,
    opaque: String,
    sha256: String,
    bytes: Vec<u8>,
    tracked: Vec<TrackedBackup>,
    retention: usize,
}
pub struct BackupCompleted {
    written: TrackedBackup,
    removed: Vec<String>,
}
impl BackupJob {
    pub fn run(&self) -> Result<BackupCompleted> {
        io::user_path(&self.folder)?;
        let _pins = io::pin_directory(&self.folder)?;
        if io::identity(&self.folder)? != self.folder_identity {
            return Err(Error::new("INVALID_STATE"));
        }
        let name = format!(
            "vault-{}-{}-{}.kdbx",
            Utc::now().format("%Y%m%dT%H%M%SZ"),
            &self.sha256[..12],
            id()
        );
        io::exclusive_write(&io::child(&self.folder, &name)?, &self.bytes)?;
        let mut removed = Vec::new();
        // The new byte-verified copy is already durable before any pruning.
        for old in self
            .tracked
            .iter()
            .take((self.tracked.len() + 1).saturating_sub(self.retention))
        {
            let path = io::child(&self.folder, &old.name)?;
            if path.exists() {
                // User-replaced content under a tracked name is no longer ours.
                io::remove_verified(&path, &old.sha256)?;
            }
            removed.push(old.name.clone());
        }
        Ok(BackupCompleted {
            written: TrackedBackup {
                name,
                sha256: self.sha256.clone(),
            },
            removed,
        })
    }
}

pub struct Store {
    root: PathBuf,
    _pins: Vec<File>,
    _lock: File,
    meta: Metadata,
    session: Option<String>,
    deadline: Option<Instant>,
    interval: Duration,
    #[cfg(test)]
    fault: Option<&'static str>,
}

impl Store {
    pub fn open(root: &Path) -> Result<Self> {
        io::reject_links(root)?;
        fs::create_dir_all(root)?;
        io::secure_directory(root)?;
        let pins = io::pin_directory(root)?;
        let lock_path = io::child(root, "store.lock")?;
        let mut opts = OpenOptions::new();
        opts.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            opts.mode(0o600);
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            opts.custom_flags(0x00200000).share_mode(1 | 2);
        }
        let lock = opts.open(lock_path)?;
        lock.try_lock_exclusive()
            .map_err(|_| Error::new("CONFLICT"))?;
        let meta_path = io::child(root, "state.json")?;
        let meta: Metadata = if meta_path.exists() {
            serde_json::from_slice(&io::read(&meta_path, 256 * 1024)?)?
        } else {
            Metadata {
                version: 1,
                backup: Backup {
                    owner: id(),
                    retention: 30,
                    status: "unconfigured".into(),
                    ..Backup::default()
                },
                ..Metadata::default()
            }
        };
        let mut store = Self {
            root: root.into(),
            _pins: pins,
            _lock: lock,
            meta,
            session: None,
            deadline: None,
            interval: Duration::from_secs(120),
            #[cfg(test)]
            fault: None,
        };
        store.reconcile()?;
        if let Some(ms) = store
            .meta
            .preferences
            .get("lockIntervalMs")
            .and_then(Value::as_u64)
        {
            store.interval = Duration::from_millis(ms);
        }
        store.validate_metadata()?;
        // An orphan current file must remain recoverable, never look empty.
        if store.meta.head.is_none() && store.path("current.kdbx")?.exists() {
            let bytes = io::read(&store.path("current.kdbx")?, MAX_BYTES)?;
            let blob = Blob {
                id: id(),
                sha256: hash(&bytes),
                size: bytes.len(),
                generation: 1,
                password_epoch: 0,
                committed_at: stamp(),
            };
            io::exclusive_write(&store.blob_path(&blob.id)?, &bytes)?;
            store.meta.head = Some(Self::head_of(&blob, None));
            store.meta.blobs.push(blob);
            store.persist()?;
        }
        if store.meta.head.is_none() && store.meta.blobs.is_empty() {
            for entry in fs::read_dir(&store.root)? {
                let name = entry?.file_name().to_string_lossy().into_owned();
                if let Some(opaque) = name
                    .strip_prefix("blob-")
                    .and_then(|s| s.strip_suffix(".kdbx"))
                {
                    if parse_id(opaque).is_ok() {
                        let bytes = io::read(&store.blob_path(opaque)?, MAX_BYTES)?;
                        store.meta.blobs.push(Blob {
                            id: opaque.into(),
                            sha256: hash(&bytes),
                            size: bytes.len(),
                            generation: 0,
                            password_epoch: 0,
                            committed_at: stamp(),
                        });
                    }
                }
            }
        }
        // A first commit interrupted before publication leaves its staged blob:
        // create a deliberately unreadable head so recovery offers snapshots.
        if store.meta.head.is_none() && !store.meta.blobs.is_empty() {
            let mut head = Self::head_of(&store.meta.blobs[0], None);
            head.blob_id = id();
            store.meta.head = Some(head);
            store.persist()?;
        }
        Ok(store)
    }
    fn path(&self, name: &str) -> Result<PathBuf> {
        io::child(&self.root, name)
    }
    fn blob_path(&self, opaque: &str) -> Result<PathBuf> {
        parse_id(opaque)?;
        self.path(&format!("blob-{opaque}.kdbx"))
    }
    fn validate_metadata(&self) -> Result<()> {
        if self.meta.version != 1
            || self.meta.blobs.len() > 100
            || self.meta.receipts.len() > 64
            || self.meta.preferences.len() > 8
            || !(1..=100).contains(&self.meta.backup.retention)
        {
            return Err(Error::new("CORRUPT"));
        }
        parse_id(&self.meta.backup.owner)?;
        if let Some(h) = &self.meta.head {
            parse_id(&h.blob_id)?;
            if h.slot != "active"
                || h.format != "kdbx4"
                || h.generation > 9_007_199_254_740_990
                || h.password_epoch > 9_007_199_254_740_990
            {
                return Err(Error::new("CORRUPT"));
            }
        }
        for b in &self.meta.blobs {
            parse_id(&b.id)?;
            if !hash_valid(&b.sha256) || b.size > MAX_BYTES {
                return Err(Error::new("CORRUPT"));
            }
        }
        Ok(())
    }
    fn persist(&self) -> Result<()> {
        io::atomic_json(&self.path("state.json")?, &serde_json::to_vec(&self.meta)?)
    }
    fn reconcile(&mut self) -> Result<()> {
        let journal_path = self.path("commit.json")?;
        if !journal_path.exists() {
            return Ok(());
        }
        let journal: Journal = serde_json::from_slice(&io::read(&journal_path, 256 * 1024)?)?;
        let current_hash = io::read(&self.path("current.kdbx")?, MAX_BYTES)
            .ok()
            .map(|b| hash(&b));
        let matching = |m: &Metadata| {
            m.head
                .as_ref()
                .and_then(|h| m.blobs.iter().find(|b| b.id == h.blob_id))
                .map(|b| b.sha256.clone())
        };
        if current_hash == matching(&journal.next) && current_hash.is_some() {
            self.meta = journal.next;
            self.persist()?;
            fs::remove_file(journal_path)?;
        } else if current_hash == matching(&journal.previous) && current_hash.is_some() {
            self.meta = journal.previous;
            self.persist()?;
            fs::remove_file(journal_path)?;
        } else {
            // Keep both candidate and previous descriptors. Missing/changed
            // current is presented as damaged and never initializes empty data.
            self.meta = journal.next;
            self.persist()?;
        }
        Ok(())
    }
    pub fn begin(&mut self) -> String {
        let token = id();
        self.session = Some(token.clone());
        self.deadline = Some(Instant::now() + self.interval);
        token
    }
    pub fn end(&mut self, token: &str) {
        if self.session.as_deref() == Some(token) {
            self.invalidate();
        }
    }
    pub fn invalidate(&mut self) {
        self.session = None;
        self.deadline = None;
    }
    pub fn activity(&mut self) {
        if self.session.is_some() && !self.expired() {
            self.deadline = Some(Instant::now() + self.interval);
        }
    }
    pub fn expired(&self) -> bool {
        self.deadline.is_some_and(|d| Instant::now() >= d)
    }
    pub fn lock_interval(&self) -> Duration {
        self.interval
    }
    /// The Windows host owns a separate monotonic clock so disk I/O cannot
    /// delay revocation. Synchronize its deadline before checking a command.
    pub fn native_deadline(&mut self, deadline: Option<Instant>) {
        self.deadline = deadline;
    }
    fn authorize(&self, token: &str) -> Result<()> {
        if self.session.as_deref() != Some(token) || self.expired() {
            Err(Error::new("INVALID_STATE"))
        } else {
            Ok(())
        }
    }
    pub fn dispatch(&mut self, token: &str, operation: &str, args: Value) -> Result<Value> {
        self.authorize(token)?;
        if !args.is_object() {
            return Err(Error::new("INVALID_STATE"));
        }
        match operation {
            "readHead" => Ok(serde_json::to_value(&self.meta.head)?),
            "readBlob" => {
                let blob_id: String = arg(&args, "id")?;
                let (blob, bytes) = self.read_blob(&blob_id, true)?;
                let mut value = serde_json::to_value(blob)?;
                value["bytes"] = json!(bytes);
                Ok(value)
            }
            "readBlobUnchecked" => {
                let blob_id: String = arg(&args, "id")?;
                Ok(json!(self.read_blob(&blob_id, false)?.1))
            }
            "listBlobs" => Ok(json!(self
                .meta
                .blobs
                .iter()
                .map(|b| {
                    let mut v = serde_json::to_value(b).unwrap();
                    v["isHead"] = json!(self.meta.head.as_ref().is_some_and(|h| h.blob_id == b.id));
                    v
                })
                .rev()
                .collect::<Vec<_>>())),
            "commit" => {
                let bytes: Vec<u8> = arg(&args, "bytes")?;
                let sha: String = arg(&args, "sha256")?;
                let expected: Option<u64> = arg(&args, "expectedGeneration")?;
                let epoch: Option<u64> = arg(&args, "passwordEpoch")?;
                Ok(serde_json::to_value(self.commit(
                    bytes,
                    sha,
                    expected,
                    epoch,
                    args.get("confirmedReplacement") == Some(&Value::Bool(true)),
                )?)?)
            }
            "restoreBlob" => {
                let blob_id: String = arg(&args, "blobId")?;
                let expected = arg(&args, "expectedGeneration")?;
                let (blob, bytes) = self.read_blob(&blob_id, true)?;
                Ok(serde_json::to_value(self.commit(
                    bytes,
                    blob.sha256,
                    expected,
                    Some(self.meta.head.as_ref().map_or(0, |h| h.password_epoch + 1)),
                    true,
                )?)?)
            }
            "pruneRollback" => Ok(json!(self.prune(false)?)),
            "deleteOlderPasswordEpochs" => Ok(json!(self.prune(true)?)),
            "countOlderPasswordEpochs" => Ok(json!(self
                .meta
                .blobs
                .iter()
                .filter(|b| self
                    .meta
                    .head
                    .as_ref()
                    .is_some_and(|h| b.id != h.blob_id && b.password_epoch < h.password_epoch))
                .count())),
            "getPreference" => {
                let key: String = arg(&args, "key")?;
                Self::preference_key(&key)?;
                Ok(self
                    .meta
                    .preferences
                    .get(&key)
                    .cloned()
                    .unwrap_or(Value::Null))
            }
            "setPreference" => {
                self.preference(&args)?;
                Ok(Value::Null)
            }
            "listReceipts" => Ok(json!(self.meta.receipts.iter().rev().collect::<Vec<_>>())),
            "addReceipt" => self.receipt(&args),
            _ => Err(Error::new("INVALID_STATE")),
        }
    }
    fn read_blob(&self, opaque: &str, checked: bool) -> Result<(Blob, Vec<u8>)> {
        parse_id(opaque)?;
        let blob = self
            .meta
            .blobs
            .iter()
            .find(|b| b.id == opaque)
            .cloned()
            .ok_or(Error::new("NOT_FOUND"))?;
        let is_head = self.meta.head.as_ref().is_some_and(|h| h.blob_id == opaque);
        let path = if is_head {
            self.path("current.kdbx")?
        } else {
            self.blob_path(opaque)?
        };
        let bytes = io::read(&path, MAX_BYTES).map_err(|_| Error::new("CORRUPT"))?;
        if checked && (bytes.len() != blob.size || hash(&bytes) != blob.sha256) {
            return Err(Error::new("CORRUPT"));
        }
        Ok((blob, bytes))
    }
    fn head_of(blob: &Blob, previous: Option<&Head>) -> Head {
        Head {
            slot: "active".into(),
            blob_id: blob.id.clone(),
            generation: blob.generation,
            format: "kdbx4".into(),
            password_epoch: blob.password_epoch,
            committed_at: blob.committed_at.clone(),
            verified_generation: previous.and_then(|h| h.verified_generation),
            unbacked_since: Some(
                previous
                    .and_then(|h| h.unbacked_since.clone())
                    .unwrap_or_else(stamp),
            ),
        }
    }
    #[cfg(test)]
    fn boundary(&self, stage: &'static str) -> Result<()> {
        if self.fault == Some(stage) {
            Err(Error::new("WRITE_FAILED"))
        } else {
            Ok(())
        }
    }
    #[cfg(not(test))]
    fn boundary(&self, _: &'static str) -> Result<()> {
        Ok(())
    }
    fn commit(
        &mut self,
        bytes: Vec<u8>,
        sha: String,
        expected: Option<u64>,
        epoch: Option<u64>,
        recovery: bool,
    ) -> Result<Head> {
        if bytes.is_empty() || bytes.len() > MAX_BYTES || !hash_valid(&sha) || hash(&bytes) != sha {
            return Err(Error::new("CORRUPT"));
        }
        if expected != self.meta.head.as_ref().map(|h| h.generation) {
            return Err(Error::new("CONFLICT"));
        }
        let current = self.path("current.kdbx")?;
        let first_publication = !current.exists();
        if let Some(head) = &self.meta.head {
            let known = self
                .meta
                .blobs
                .iter()
                .find(|b| b.id == head.blob_id)
                .map(|b| &b.sha256);
            // A damaged/missing head can only be replaced via explicit recovery.
            // Normal editing never gets here with a damaged head; generation CAS
            // additionally protects against another successful managed save.
            if let Ok(existing) = io::read(&current, MAX_BYTES) {
                if !recovery && known != Some(&hash(&existing)) {
                    return Err(Error::new("CONFLICT"));
                }
            } else if !recovery {
                return Err(Error::new("CONFLICT"));
            } else if current.exists() {
                return Err(Error::new("CORRUPT"));
            }
        } else if current.exists() {
            return Err(Error::new("CONFLICT"));
        }
        self.boundary("before-write")?;
        let generation = expected
            .unwrap_or(0)
            .checked_add(1)
            .ok_or(Error::new("CORRUPT"))?;
        let blob = Blob {
            id: id(),
            sha256: sha.clone(),
            size: bytes.len(),
            generation,
            password_epoch: epoch
                .unwrap_or(self.meta.head.as_ref().map_or(0, |h| h.password_epoch)),
            committed_at: stamp(),
        };
        let immutable = self.blob_path(&blob.id)?;
        io::exclusive_write(&immutable, &bytes)?;
        self.boundary("after-immutable-flush")?;
        let candidate = self.path(&format!("candidate-{}.tmp", id()))?;
        io::exclusive_write(&candidate, &bytes)?;
        self.boundary("after-candidate-flush")?;
        let next_head = Self::head_of(&blob, self.meta.head.as_ref());
        let mut next = self.meta.clone();
        next.blobs.push(blob);
        next.head = Some(next_head.clone());
        if next.backup.folder.is_some() {
            next.backup.pending = Some(next_head.blob_id.clone());
            next.backup.status = "pending".into();
        }
        let journal = Journal {
            previous: self.meta.clone(),
            next: next.clone(),
        };
        io::atomic_json(&self.path("commit.json")?, &serde_json::to_vec(&journal)?)?;
        self.boundary("after-journal-flush")?;
        // The immutable prior blob already exists; Windows also writes a
        // separate replacement copy. Never delete current before replacement.
        let prior = self.path(&format!("replaced-{}.kdbx", id()))?;
        let outcome = io::replace(&candidate, &current, Some(&prior), first_publication);
        self.boundary("after-replace")?;
        if io::read(&current, MAX_BYTES)
            .ok()
            .is_none_or(|b| hash(&b) != sha)
        {
            self.reconcile()?;
            return Err(outcome.err().unwrap_or(Error::new("READBACK_FAILED")));
        }
        self.meta = next;
        self.persist().map_err(|_| Error::new("READBACK_FAILED"))?;
        self.boundary("after-state-flush")?;
        fs::remove_file(self.path("commit.json")?).map_err(|_| Error::new("READBACK_FAILED"))?;
        self.boundary("before-acknowledge")?;
        // Only verified success allows housekeeping. Replacement error files
        // remain intact until reconciliation succeeds.
        if prior.exists() && !recovery {
            let _ = fs::remove_file(prior);
        }
        let _ = self.prune(false);
        // Secondary-copy failure never converts an acknowledged local save into failure.
        Ok(next_head)
    }
    fn prune(&mut self, old_epoch: bool) -> Result<usize> {
        let Some(head) = self.meta.head.clone() else {
            return Ok(0);
        };
        let active = self.read_blob(&head.blob_id, true)?;
        if active.1.is_empty() {
            return Err(Error::new("CORRUPT"));
        }
        let mut rollback: Vec<_> = self
            .meta
            .blobs
            .iter()
            .filter(|b| b.id != head.blob_id)
            .cloned()
            .collect();
        rollback.sort_by_key(|b| std::cmp::Reverse(b.generation));
        let mut remove = Vec::new();
        let mut count = 0;
        let mut total = 0;
        for b in rollback {
            if old_epoch {
                if b.password_epoch < head.password_epoch {
                    remove.push(b.id);
                }
            } else if count < 5 && total + b.size <= 80 * 1024 * 1024 {
                count += 1;
                total += b.size;
            } else {
                remove.push(b.id);
            }
        }
        let mut removed = 0;
        for opaque in remove {
            if self.meta.backup.pending.as_deref() == Some(&opaque) {
                continue;
            }
            fs::remove_file(self.blob_path(&opaque)?)?;
            self.meta.blobs.retain(|b| b.id != opaque);
            removed += 1;
        }
        self.persist()?;
        Ok(removed)
    }
    fn preference_key(key: &str) -> Result<()> {
        if [
            "lockIntervalMs",
            "language",
            "theme",
            "onboardingBackupVerified",
            "biometricUnlock",
        ]
        .contains(&key)
        {
            Ok(())
        } else {
            Err(Error::new("INVALID_STATE"))
        }
    }
    fn preference(&mut self, args: &Value) -> Result<()> {
        let key: String = arg(args, "key")?;
        Self::preference_key(&key)?;
        let value = args
            .get("value")
            .cloned()
            .ok_or(Error::new("INVALID_STATE"))?;
        if let Some(expected) = args.get("expectedGeneration").and_then(Value::as_u64) {
            if self.meta.head.as_ref().map(|h| h.generation) != Some(expected) {
                return Err(Error::new("CONFLICT"));
            }
        }
        let valid = match key.as_str() {
            "lockIntervalMs" => value.as_u64().is_some_and(|v| {
                [30000, 60000, 120000, 300000, 600000, 1800000, 3600000].contains(&v)
            }),
            "language" => value
                .as_str()
                .is_some_and(|v| ["auto", "en", "ru"].contains(&v)),
            "theme" => value
                .as_str()
                .is_some_and(|v| ["auto", "color", "light", "dark"].contains(&v)),
            "onboardingBackupVerified" => value.is_boolean(),
            // Desktop does not accept browser password envelopes.
            "biometricUnlock" => value.is_null(),
            _ => false,
        };
        if !valid {
            return Err(Error::new("INVALID_STATE"));
        }
        if key == "lockIntervalMs" {
            self.interval = Duration::from_millis(value.as_u64().unwrap());
        }
        self.meta.preferences.insert(key, value);
        self.persist()
    }
    fn receipt(&mut self, args: &Value) -> Result<Value> {
        let kind: String = arg(args, "kind")?;
        let sha: String = arg(args, "sha256")?;
        if ![
            "export-prepared",
            "export-offered",
            "export-cancelled",
            "export-failed",
            "user-reported",
            "verified",
        ]
        .contains(&kind.as_str())
            || !hash_valid(&sha)
        {
            return Err(Error::new("INVALID_STATE"));
        }
        let found = self.meta.blobs.iter().find(|b| b.sha256 == sha);
        let generation = found.map(|b| b.generation);
        let receipt = json!({"id": id(), "kind": kind, "sha256": sha, "generation": generation, "at": stamp()});
        if kind == "verified" {
            if let (Some(blob), Some(head)) = (found, self.meta.head.as_mut()) {
                let is_head = blob.id == head.blob_id;
                head.verified_generation =
                    Some(head.verified_generation.unwrap_or(0).max(if is_head {
                        head.generation
                    } else {
                        blob.generation
                    }));
                if is_head {
                    head.unbacked_since = None;
                }
            }
        }
        self.meta.receipts.push(receipt.clone());
        if self.meta.receipts.len() > 64 {
            self.meta.receipts.remove(0);
        }
        self.persist()?;
        Ok(receipt)
    }
    /// Folder argument is supplied only by a native picker, never by IPC.
    pub fn configure_backup(&mut self, selected: &Path) -> Result<()> {
        let selected = io::user_path(selected)?;
        let _parent_pins = io::pin_directory(&selected)?;
        let folder = io::child(
            &selected,
            &format!("PassKeyLocal-{}", self.meta.backup.owner),
        )?;
        fs::create_dir(&folder).or_else(|e| {
            if e.kind() == std::io::ErrorKind::AlreadyExists {
                Ok(())
            } else {
                Err(e)
            }
        })?;
        io::secure_directory(&folder)?;
        io::pin_directory(&folder)?;
        if self.meta.backup.folder.as_ref() != Some(&folder) {
            self.meta.backup.tracked.clear();
        }
        self.meta.backup.folder_identity = Some(io::identity(&folder)?);
        self.meta.backup.folder = Some(folder);
        self.meta.backup.pending = self.meta.head.as_ref().map(|h| h.blob_id.clone());
        self.meta.backup.status = "pending".into();
        self.persist()?;
        Ok(())
    }
    pub fn pending_backup(&self) -> Result<Option<BackupJob>> {
        let Some(folder) = self.meta.backup.folder.clone() else {
            return Ok(None);
        };
        let Some(opaque) = self.meta.backup.pending.clone() else {
            return Ok(None);
        };
        let folder_identity = self
            .meta
            .backup
            .folder_identity
            .clone()
            .ok_or(Error::new("INVALID_STATE"))?;
        let blob = self
            .meta
            .blobs
            .iter()
            .find(|b| b.id == opaque)
            .ok_or(Error::new("NOT_FOUND"))?;
        let bytes = io::read(&self.blob_path(&opaque)?, MAX_BYTES)?;
        if hash(&bytes) != blob.sha256 {
            return Err(Error::new("CORRUPT"));
        }
        Ok(Some(BackupJob {
            folder,
            folder_identity,
            opaque,
            sha256: blob.sha256.clone(),
            bytes,
            tracked: self.meta.backup.tracked.clone(),
            retention: self.meta.backup.retention,
        }))
    }
    pub fn finish_backup(
        &mut self,
        job: &BackupJob,
        result: Result<BackupCompleted>,
    ) -> Result<()> {
        // A changed authorization cannot inherit status/tracking from an old folder.
        if self.meta.backup.folder.as_ref() != Some(&job.folder)
            || self.meta.backup.folder_identity.as_ref() != Some(&job.folder_identity)
        {
            return Ok(());
        }
        match result {
            Ok(completed) => {
                self.meta
                    .backup
                    .tracked
                    .retain(|b| !completed.removed.contains(&b.name));
                self.meta.backup.tracked.push(completed.written);
                if self.meta.backup.pending.as_ref() == Some(&job.opaque) {
                    self.meta.backup.pending = None;
                }
                self.meta.backup.status = if self.meta.backup.pending.is_none() {
                    "verified"
                } else {
                    "pending"
                }
                .into();
                self.persist()
            }
            Err(e) => {
                self.meta.backup.status = "failed".into();
                self.persist()?;
                Err(e)
            }
        }
    }
    pub fn retry_backup(&mut self) -> Result<()> {
        if let Some(job) = self.pending_backup()? {
            let outcome = job.run();
            self.finish_backup(&job, outcome)?;
        }
        Ok(())
    }
    pub fn set_backup_retention(&mut self, retention: usize) -> Result<()> {
        if !(1..=100).contains(&retention) {
            return Err(Error::new("INVALID_STATE"));
        }
        self.meta.backup.retention = retention;
        self.persist()
    }
    pub fn status(&self) -> Value {
        json!({"backup": self.meta.backup.status, "hello": "protected-key-proof-required", "helloReadiness": crate::hello::readiness(), "retention": self.meta.backup.retention})
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn save(s: &mut Store, token: &str, bytes: &[u8], generation: Option<u64>) -> Result<Value> {
        s.dispatch(
            token,
            "commit",
            json!({"bytes": bytes, "sha256": hash(bytes), "expectedGeneration": generation}),
        )
    }
    #[test]
    fn saved_bytes_survive_restart_and_external_change_conflicts() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        save(&mut s, &t, b"synthetic ciphertext 1", None).unwrap();
        drop(s);
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        assert_eq!(
            s.dispatch(&t, "readHead", json!({})).unwrap()["generation"],
            1
        );
        fs::write(dir.path().join("current.kdbx"), b"external edit").unwrap();
        assert_eq!(
            save(&mut s, &t, b"candidate", Some(1)).unwrap_err().code,
            "CONFLICT"
        );
        assert_eq!(
            fs::read(dir.path().join("current.kdbx")).unwrap(),
            b"external edit"
        );
    }
    #[test]
    fn stale_tokens_preferences_and_hostile_operations_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let old = s.begin();
        let t = s.begin();
        s.end(&old);
        assert!(save(&mut s, &t, b"synthetic", None).is_ok());
        assert_eq!(
            save(&mut s, &old, b"evil", Some(1)).unwrap_err().code,
            "INVALID_STATE"
        );
        for operation in [
            "readFile",
            "exec",
            "decrypt",
            "exportPrivateKey",
            "hello_unlock",
        ] {
            assert!(s.dispatch(&t, operation, json!({})).is_err());
        }
        for opaque in [
            "../current.kdbx",
            "C:\\secret",
            "CON",
            "x:stream",
            "\\\\host\\share",
        ] {
            assert!(s.dispatch(&t, "readBlob", json!({"id": opaque})).is_err());
        }
        assert!(s
            .dispatch(
                &t,
                "setPreference",
                json!({"key": "password", "value": "synthetic"})
            )
            .is_err());
        assert!(s
            .dispatch(
                &t,
                "setPreference",
                json!({"key": "biometricUnlock", "value": {"password":"synthetic"}})
            )
            .is_err());
        assert!(s
            .dispatch(
                &t,
                "setPreference",
                json!({"key": "theme", "value": "dark", "expectedGeneration": 0})
            )
            .is_err());
        s.invalidate();
        assert!(s.dispatch(&t, "readHead", json!({})).is_err());
    }
    #[test]
    fn every_write_boundary_keeps_current_or_recoverable_ciphertext() {
        for stage in [
            "before-write",
            "after-immutable-flush",
            "after-candidate-flush",
            "after-journal-flush",
            "after-replace",
            "after-state-flush",
            "before-acknowledge",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let mut s = Store::open(dir.path()).unwrap();
            let t = s.begin();
            save(&mut s, &t, b"previous synthetic", None).unwrap();
            s.fault = Some(stage);
            assert!(save(&mut s, &t, b"next synthetic", Some(1)).is_err());
            drop(s);
            let mut s = Store::open(dir.path()).unwrap();
            let t = s.begin();
            let current = fs::read(dir.path().join("current.kdbx")).unwrap();
            assert!(
                current == b"previous synthetic" || current == b"next synthetic",
                "{stage}"
            );
            let head = s.dispatch(&t, "readHead", json!({})).unwrap();
            let blob = s
                .dispatch(&t, "readBlob", json!({"id": head["blobId"]}))
                .unwrap();
            assert_eq!(blob["sha256"], hash(&current), "{stage}");
        }
    }
    #[test]
    fn backup_failure_is_separate_and_retention_ignores_unrelated_files() {
        let dir = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        save(&mut s, &t, b"first synthetic", None).unwrap();
        s.configure_backup(external.path()).unwrap();
        s.retry_backup().unwrap();
        let folder = s.meta.backup.folder.clone().unwrap();
        fs::write(folder.join("unrelated.kdbx"), b"keep").unwrap();
        let renamed = folder.join("manual-renamed.kdbx");
        fs::rename(folder.join(&s.meta.backup.tracked[0].name), &renamed).unwrap();
        s.meta.backup.retention = 2;
        for generation in 1..6 {
            save(
                &mut s,
                &t,
                format!("synthetic {generation}").as_bytes(),
                Some(generation),
            )
            .unwrap();
            s.retry_backup().unwrap();
        }
        s.retry_backup().unwrap();
        assert_eq!(s.meta.backup.tracked.len(), 2);
        assert!(renamed.exists());
        assert!(folder.join("unrelated.kdbx").exists());
        let moved = external.path().join("missing-drive");
        fs::rename(&folder, &moved).unwrap();
        save(&mut s, &t, b"offline drive synthetic", Some(6)).unwrap();
        assert!(s.retry_backup().is_err());
        assert_eq!(s.status()["backup"], "failed");
        fs::rename(moved, &folder).unwrap();
        s.retry_backup().unwrap();
        assert_eq!(s.status()["backup"], "verified");
        let latest = folder.join(&s.meta.backup.tracked.last().unwrap().name);
        assert_eq!(fs::read(latest).unwrap(), b"offline drive synthetic");
    }
    #[test]
    fn rollback_retention_rotation_and_single_writer() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        assert!(Store::open(dir.path()).is_err());
        for generation in 0..9 {
            save(
                &mut s,
                &t,
                format!("synthetic {generation}").as_bytes(),
                if generation == 0 {
                    None
                } else {
                    Some(generation)
                },
            )
            .unwrap();
        }
        assert_eq!(s.meta.blobs.len(), 6);
        s.dispatch(&t, "commit", json!({"bytes": b"rotated synthetic", "sha256": hash(b"rotated synthetic"), "expectedGeneration": 9, "passwordEpoch": 1})).unwrap();
        assert_eq!(
            s.dispatch(&t, "deleteOlderPasswordEpochs", json!({}))
                .unwrap(),
            5
        );
        assert_eq!(s.meta.blobs.len(), 1);
    }
    #[test]
    fn first_save_interruption_never_looks_like_an_empty_installation() {
        for stage in [
            "after-immutable-flush",
            "after-candidate-flush",
            "after-journal-flush",
            "after-replace",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let mut s = Store::open(dir.path()).unwrap();
            let token = s.begin();
            s.fault = Some(stage);
            assert!(save(&mut s, &token, b"synthetic first candidate", None).is_err());
            drop(s);
            let s = Store::open(dir.path()).unwrap();
            assert!(s.meta.head.is_some(), "{stage}");
            assert!(!s.meta.blobs.is_empty(), "{stage}");
            assert!(s
                .meta
                .blobs
                .iter()
                .any(
                    |b| io::read(&s.blob_path(&b.id).unwrap(), MAX_BYTES).unwrap()
                        == b"synthetic first candidate"
                ));
        }
    }
    #[test]
    fn queued_backup_has_immutable_bytes_and_cannot_verify_a_newer_revision() {
        let dir = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        save(&mut s, &t, b"synthetic original", None).unwrap();
        s.configure_backup(external.path()).unwrap();
        let job = s.pending_backup().unwrap().unwrap();
        save(&mut s, &t, b"synthetic later", Some(1)).unwrap();
        let copied = job.run().unwrap();
        assert_eq!(
            fs::read(job.folder.join(&copied.written.name)).unwrap(),
            b"synthetic original"
        );
        s.finish_backup(&job, Ok(copied)).unwrap();
        assert_eq!(s.status()["backup"], "pending");
        s.retry_backup().unwrap();
        assert_eq!(s.status()["backup"], "verified");
    }
    #[test]
    fn replaced_folder_and_modified_tracked_content_are_not_authorized() {
        let dir = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        save(&mut s, &t, b"synthetic original", None).unwrap();
        s.configure_backup(external.path()).unwrap();
        s.retry_backup().unwrap();
        let folder = s.meta.backup.folder.clone().unwrap();
        let original_name = s.meta.backup.tracked[0].name.clone();
        fs::write(
            folder.join(&original_name),
            b"user replaced this tracked name",
        )
        .unwrap();
        s.set_backup_retention(1).unwrap();
        save(&mut s, &t, b"synthetic next", Some(1)).unwrap();
        s.retry_backup().unwrap();
        assert_eq!(
            fs::read(folder.join(original_name)).unwrap(),
            b"user replaced this tracked name"
        );
        let moved = external.path().join("old-authorized-folder");
        fs::rename(&folder, moved).unwrap();
        fs::create_dir(&folder).unwrap();
        save(&mut s, &t, b"synthetic unauthorized folder", Some(2)).unwrap();
        assert!(s.retry_backup().is_err());
        assert_eq!(fs::read_dir(folder).unwrap().count(), 0);
    }
    #[test]
    fn snapshot_recovery_is_explicit_and_hash_errors_cannot_commit() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(dir.path()).unwrap();
        let t = s.begin();
        let first = save(&mut s, &t, b"synthetic recoverable", None).unwrap();
        save(&mut s, &t, b"synthetic current", Some(1)).unwrap();
        fs::write(s.path("current.kdbx").unwrap(), b"damaged external data").unwrap();
        assert!(save(&mut s, &t, b"normal overwrite", Some(2)).is_err());
        s.dispatch(
            &t,
            "restoreBlob",
            json!({"blobId":first["blobId"],"expectedGeneration":2}),
        )
        .unwrap();
        assert_eq!(
            fs::read(s.path("current.kdbx").unwrap()).unwrap(),
            b"synthetic recoverable"
        );
        assert!(s.dispatch(&t, "commit", json!({"bytes":b"synthetic bad hash","sha256":hash(b"different"),"expectedGeneration":3})).is_err());
        fs::write(
            s.path("current.kdbx").unwrap(),
            b"damaged external replacement",
        )
        .unwrap();
        s.dispatch(&t, "commit", json!({"bytes":b"authenticated synthetic adoption", "sha256":hash(b"authenticated synthetic adoption"), "expectedGeneration":3, "passwordEpoch":2, "confirmedReplacement":true})).unwrap();
        fs::remove_file(s.path("current.kdbx").unwrap()).unwrap();
        assert_eq!(
            save(&mut s, &t, b"unconfirmed missing head", Some(4))
                .unwrap_err()
                .code,
            "CONFLICT"
        );
    }
    #[cfg(windows)]
    #[test]
    fn actual_windows_replacement_errors_preserve_the_destination() {
        let dir = tempfile::tempdir().unwrap();
        let current = dir.path().join("current.kdbx");
        io::exclusive_write(&current, b"synthetic previous").unwrap();
        assert!(io::replace(&dir.path().join("missing.tmp"), &current, None, false).is_err());
        assert_eq!(fs::read(&current).unwrap(), b"synthetic previous");
        let candidate = dir.path().join("new.tmp");
        io::exclusive_write(&candidate, b"synthetic candidate").unwrap();
        assert!(io::replace(&candidate, &current, None, true).is_err());
        assert_eq!(fs::read(&current).unwrap(), b"synthetic previous");
        assert!(candidate.exists());
    }
    #[cfg(unix)]
    #[test]
    fn symlink_destinations_fail_closed() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        symlink(outside.path(), dir.path().join("linked")).unwrap();
        assert!(Store::open(&dir.path().join("linked")).is_err());
        let mut s = Store::open(&dir.path().join("managed")).unwrap();
        let t = s.begin();
        symlink(outside.path().join("secret"), s.root.join("current.kdbx")).unwrap();
        assert!(save(&mut s, &t, b"synthetic", None).is_err());
        assert!(!outside.path().join("secret").exists());
    }
}
