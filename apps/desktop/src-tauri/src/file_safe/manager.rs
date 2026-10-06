//! Independent token/epoch, deadline and one-transfer admission control.
use super::{
    backup::{BackupQueue, BackupStatus},
    format::{id, Folder},
    store::{open_read, Edit, FileView, SafeStore},
};
use crate::{
    filesystem as io,
    inactivity::Inactivity,
    storage::{Error, Result},
};
use serde::{Deserialize, Serialize};
use std::{
    fs::File,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use zeroize::Zeroizing;

pub struct SafeManager {
    store: Mutex<SafeStore>,
    active: Mutex<Option<String>>,
    epoch: AtomicU64,
    disposed: AtomicU64,
    cancel: AtomicU64,
    clock: Mutex<Inactivity>,
    interval: Mutex<Duration>,
    busy: AtomicBool,
    exists: AtomicBool,
    pub backups: BackupQueue,
    progress: Mutex<Progress>,
    results: Mutex<Vec<ImportItem>>,
    preference_path: PathBuf,
    candidate: Mutex<Option<Candidate>>,
}
struct Candidate {
    id: String,
    path: PathBuf,
    head_hash: String,
    identity: String,
    epoch: u64,
    _pins: Vec<File>,
}
#[derive(Clone, Serialize, Default)]
pub struct Progress {
    pub stage: String,
    pub done: usize,
    pub total: usize,
}
#[derive(Serialize)]
pub struct Status {
    pub exists: bool,
    pub unlocked: bool,
    pub token: Option<String>,
    pub generation: String,
    pub busy: bool,
    pub interval_ms: u64,
    pub progress: Progress,
    pub backup: BackupStatus,
    pub hello: &'static str,
    pub preview: &'static str,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Query {
    pub folder_id: Option<String>,
    pub mode: Mode,
    pub search: String,
    pub sort: Sort,
    pub offset: usize,
    #[serde(default)]
    pub folder_offset: usize,
    pub limit: usize,
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Files,
    Favorites,
    Trash,
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Sort {
    Name,
    Modified,
    Size,
}
#[derive(Serialize)]
pub struct Page {
    pub snapshot_id: String,
    pub sequence: String,
    pub root_id: String,
    pub folder_id: String,
    pub folders: Vec<Folder>,
    pub ancestors: Vec<Folder>,
    pub files: Vec<FileView>,
    pub total: usize,
    pub folders_total: usize,
    pub storage_bytes: String,
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Change {
    Folder {
        parent_id: String,
        name: String,
    },
    Edit {
        edit: Edit,
    },
    Trash {
        file_ids: Vec<String>,
        deleted: bool,
        permanent: bool,
        confirm: bool,
    },
    RestoreVersion {
        file_id: String,
        version_id: String,
    },
}
#[derive(Clone, Serialize, zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
pub struct ImportItem {
    pub index: usize,
    pub name: String,
    pub status: String,
    pub code: Option<String>,
}
#[derive(Serialize)]
pub struct ImportOutcome {
    pub imported: usize,
    pub failed: usize,
    pub skipped: usize,
    pub cancelled: bool,
    pub items: Vec<ImportItem>,
}
pub struct Source {
    pub file: File,
    pub name: String,
    pub folders: Vec<String>,
    pub _pins: Vec<File>,
}
struct Admission<'a>(&'a AtomicBool);
impl Drop for Admission<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl SafeManager {
    pub fn open(base: &Path) -> Result<Self> {
        let store = SafeStore::open(base)?;
        let exists = store.exists();
        let backups = BackupQueue::open(base)?;
        let preference_path = base.join("inactivity.json");
        let millis = if preference_path.exists() {
            let mut b = Vec::new();
            use std::io::Read;
            open_read(&preference_path)?.take(64).read_to_end(&mut b)?;
            serde_json::from_slice::<u64>(&b).map_err(|_| Error::new("CORRUPT"))?
        } else {
            120_000
        };
        if ![30_000, 60_000, 120_000, 300_000].contains(&millis) {
            return Err(Error::new("CORRUPT"));
        }
        let duration = Duration::from_millis(millis);
        Ok(Self {
            store: Mutex::new(store),
            active: Mutex::new(None),
            epoch: AtomicU64::new(0),
            disposed: AtomicU64::new(0),
            cancel: AtomicU64::new(0),
            clock: Mutex::new(Inactivity::new(duration)),
            interval: Mutex::new(duration),
            busy: AtomicBool::new(false),
            exists: AtomicBool::new(exists),
            backups,
            progress: Mutex::new(Progress::default()),
            results: Mutex::new(vec![]),
            preference_path,
            candidate: Mutex::new(None),
        })
    }
    fn admit(&self) -> Result<Admission<'_>> {
        self.busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| Error::new("BUSY"))?;
        Ok(Admission(&self.busy))
    }
    fn begin_revocation(&self, expected: Option<u64>) -> Result<u64> {
        let mut active = self.active.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        if expected.is_some_and(|e| e != self.epoch.load(Ordering::SeqCst)) {
            return Err(Error::new("CANCELLED"));
        }
        let epoch = self.epoch.fetch_add(1, Ordering::SeqCst) + 1;
        self.cancel.fetch_add(1, Ordering::SeqCst);
        *active = None;
        Ok(epoch)
    }
    pub fn revoke(&self) {
        let _ = self.begin_revocation(None);
    }
    pub fn dispose_locked(&self) {
        let Ok(active) = self.active.lock() else {
            return;
        };
        if active.is_some() {
            return;
        }
        let epoch = self.generation();
        if self.disposed.load(Ordering::SeqCst) == epoch {
            return;
        }
        let complete = if let Ok(mut s) = self.store.try_lock() {
            s.lock();
            true
        } else {
            false
        };
        if let Ok(mut r) = self.results.try_lock() {
            r.clear();
        }
        if let Ok(mut c) = self.candidate.try_lock() {
            if c.as_ref().is_some_and(|c| c.epoch != epoch) {
                *c = None;
            }
        }
        if let Ok(mut p) = self.progress.try_lock() {
            *p = Progress::default();
        }
        if complete {
            self.disposed.store(epoch, Ordering::SeqCst);
        }
    }
    pub fn lock(&self) {
        self.revoke();
        self.dispose_locked();
    }
    pub fn expire(&self) -> bool {
        let mut active = match self.active.lock() {
            Ok(v) => v,
            Err(_) => return true,
        };
        if active.is_some()
            && self
                .clock
                .lock()
                .map(|c| c.expired(Instant::now()))
                .unwrap_or(true)
        {
            self.epoch.fetch_add(1, Ordering::SeqCst);
            self.cancel.fetch_add(1, Ordering::SeqCst);
            *active = None;
            return true;
        }
        false
    }
    pub fn check(&self, token: &str) -> Result<()> {
        if token.len() != 32
            || self
                .active
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .as_deref()
                != Some(token)
            || self
                .clock
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .expired(Instant::now())
        {
            return Err(Error::new("LOCKED"));
        }
        Ok(())
    }
    pub fn activity(&self, token: &str) -> Result<()> {
        self.check(token)?;
        self.clock
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .activity(Instant::now());
        Ok(())
    }
    pub fn interval(&self, token: &str, millis: u64) -> Result<()> {
        self.check(token)?;
        if ![30_000, 60_000, 120_000, 300_000].contains(&millis) {
            return Err(Error::new("INVALID_INPUT"));
        }
        io::atomic_json(
            &self.preference_path,
            &serde_json::to_vec(&millis).map_err(|_| Error::new("CORRUPT"))?,
        )?;
        let duration = Duration::from_millis(millis);
        *self
            .interval
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))? = duration;
        self.clock
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .interval(Instant::now(), duration);
        Ok(())
    }
    pub fn status(&self) -> Result<Status> {
        self.expire();
        let active = self.active.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        let token = active.clone();
        let generation = self.generation().to_string();
        drop(active);
        let unlocked = token.is_some();
        Ok(Status {
            exists: self.exists.load(Ordering::Acquire),
            unlocked: token.is_some(),
            token,
            generation,
            busy: self.busy.load(Ordering::Acquire),
            interval_ms: self
                .interval
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .as_millis() as u64,
            progress: if unlocked {
                self.progress
                    .lock()
                    .map_err(|_| Error::new("UNAVAILABLE"))?
                    .clone()
            } else {
                Progress::default()
            },
            backup: self.backups.status()?,
            hello: "unavailable",
            preview: "unavailable",
        })
    }
    fn queue_backup(&self, store: &SafeStore) {
        if self.backups.status().is_ok_and(|s| s.configured)
            && store
                .backup_plan()
                .and_then(|plan| self.backups.enqueue(plan))
                .is_err()
        {
            self.backups.report_failure();
        }
    }
    pub fn generation(&self) -> u64 {
        self.epoch.load(Ordering::SeqCst)
    }
    pub fn access(&self, password: String, create: bool) -> Result<String> {
        self.access_at(password, create, self.generation())
    }
    pub fn access_at(&self, password: String, create: bool, expected: u64) -> Result<String> {
        let password = Zeroizing::new(password);
        let _admit = self.admit()?;
        let epoch = self.begin_revocation(Some(expected))?;
        self.dispose_locked();
        let check = || {
            if self.epoch.load(Ordering::SeqCst) == epoch {
                Ok(())
            } else {
                Err(Error::new("CANCELLED"))
            }
        };
        let mut s = self.store.try_lock().map_err(|_| Error::new("BUSY"))?;
        let result = if create {
            s.create(password.as_bytes(), &check)
        } else {
            s.unlock(password.as_bytes(), &check)
        };
        self.exists.store(s.exists(), Ordering::Release);
        if let Err(e) = result {
            s.lock();
            return Err(e);
        }
        let mut active = self.active.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        if check().is_err() {
            s.lock();
            return Err(Error::new("CANCELLED"));
        }
        let token = id();
        let interval = *self
            .interval
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?;
        self.clock
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .begin(Instant::now(), interval);
        *active = Some(token.clone());
        drop(active);
        // Resume the latest snapshot after a process stopped before its debounce.
        self.queue_backup(&s);
        Ok(token)
    }
    fn session<T>(
        &self,
        token: &str,
        f: impl FnOnce(&mut SafeStore, &dyn Fn() -> Result<()>) -> Result<T>,
    ) -> Result<T> {
        self.check(token)?;
        let epoch = self.epoch.load(Ordering::SeqCst);
        let cancel = self.cancel.load(Ordering::SeqCst);
        let check = || {
            self.check(token)?;
            if self.epoch.load(Ordering::SeqCst) != epoch
                || self.cancel.load(Ordering::SeqCst) != cancel
            {
                Err(Error::new("CANCELLED"))
            } else {
                Ok(())
            }
        };
        let mut s = self.store.try_lock().map_err(|_| Error::new("BUSY"))?;
        check()?;
        let result = f(&mut s, &check);
        let late = check();
        if late.is_err() {
            if self.epoch.load(Ordering::SeqCst) != epoch {
                s.lock();
                if let Ok(mut r) = self.results.try_lock() {
                    r.clear();
                }
                if let Ok(mut p) = self.progress.try_lock() {
                    *p = Progress::default();
                }
            }
            return Err(Error::new("CANCELLED"));
        }
        result
    }
    pub fn page(&self, token: &str, q: Query) -> Result<Page> {
        if q.limit == 0
            || q.limit > 200
            || q.search.len() > 256
            || q.offset > 50_000
            || q.folder_offset > 50_000
        {
            return Err(Error::new("INVALID_INPUT"));
        }
        self.session(token, |s, _| {
            let mut l = s.list()?;
            let root = l
                .folders
                .iter()
                .find(|f| f.parent_id.is_none())
                .ok_or(Error::new("CORRUPT"))?
                .id
                .clone();
            let folder = q.folder_id.clone().unwrap_or(root.clone());
            let mut node = l
                .folders
                .iter()
                .find(|f| f.id == folder)
                .ok_or(Error::new("NOT_FOUND"))?;
            let mut ancestors = vec![node.clone()];
            while let Some(p) = &node.parent_id {
                node = l
                    .folders
                    .iter()
                    .find(|f| &f.id == p)
                    .ok_or(Error::new("CORRUPT"))?;
                ancestors.push(node.clone());
            }
            ancestors.reverse();
            let mut folders: Vec<_> = l
                .folders
                .into_iter()
                .filter(|f| f.parent_id.as_deref() == Some(&folder))
                .collect();
            folders.sort_by(|a, b| a.name.cmp(&b.name));
            let folders_total = folders.len();
            let folders = folders
                .into_iter()
                .skip(q.folder_offset)
                .take(200)
                .collect();
            let search = q.search.to_lowercase();
            l.files.retain(|f| match q.mode {
                Mode::Trash => f.deleted,
                Mode::Favorites => !f.deleted && f.favorite,
                Mode::Files => !f.deleted && f.folder_id == folder,
            });
            l.files.retain(|f| {
                search.is_empty()
                    || f.name.to_lowercase().contains(&search)
                    || f.tags.iter().any(|t| t.to_lowercase().contains(&search))
                    || f.notes.to_lowercase().contains(&search)
            });
            match q.sort {
                Sort::Name => l
                    .files
                    .sort_by(|a, b| a.name.cmp(&b.name).then(a.id.cmp(&b.id))),
                Sort::Modified => l
                    .files
                    .sort_by(|a, b| b.modified_at.cmp(&a.modified_at).then(a.id.cmp(&b.id))),
                Sort::Size => l.files.sort_by(|a, b| {
                    b.size
                        .parse::<u64>()
                        .unwrap_or(0)
                        .cmp(&a.size.parse::<u64>().unwrap_or(0))
                        .then(a.id.cmp(&b.id))
                }),
            };
            let total = l.files.len();
            let files = l.files.into_iter().skip(q.offset).take(q.limit).collect();
            Ok(Page {
                snapshot_id: l.snapshot_id,
                sequence: l.sequence,
                root_id: root,
                folder_id: folder,
                folders,
                ancestors,
                files,
                total,
                folders_total,
                storage_bytes: l.storage_bytes,
            })
        })
    }
    pub fn change(&self, token: &str, expected: &str, change: Change) -> Result<()> {
        self.session(token, |s, check| {
            match change {
                Change::Folder { parent_id, name } => {
                    s.folder(expected, &parent_id, &name, &|| check())?;
                }
                Change::Edit { edit } => {
                    s.edit(expected, &edit, &|| check())?;
                }
                Change::RestoreVersion {
                    file_id,
                    version_id,
                } => s.restore_version(expected, &file_id, &version_id, &|| check())?,
                Change::Trash {
                    file_ids,
                    deleted,
                    permanent,
                    confirm,
                } => {
                    if file_ids.is_empty() || file_ids.len() > 200 || (permanent && !confirm) {
                        return Err(Error::new("INVALID_INPUT"));
                    }
                    s.trash_many(expected, &file_ids, deleted, permanent, &|| check())?;
                }
            }
            self.queue_backup(s);
            Ok(())
        })
    }
    pub fn cancel(&self, token: &str) -> Result<()> {
        self.check(token)?;
        self.cancel.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
    pub fn import(
        &self,
        token: &str,
        expected: &str,
        folder: &str,
        replace: Option<&str>,
        sources: Vec<Source>,
        skipped: usize,
    ) -> Result<ImportOutcome> {
        let _admit = self.admit()?;
        if sources.len() > 50_000 || replace.is_some() && sources.len() != 1 {
            return Err(Error::new("INVALID_INPUT"));
        }
        self.session(token, |s, check| {
            if s.snapshot().as_deref() != Some(expected) {
                return Err(Error::new("CONFLICT"));
            }
            let mut result = ImportOutcome {
                imported: 0,
                failed: 0,
                skipped,
                cancelled: false,
                items: vec![],
            };
            let mut snapshot = expected.to_owned();
            let mut folders = std::collections::HashMap::<Vec<String>, String>::new();
            folders.insert(vec![], folder.to_owned());
            self.results
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .clear();
            let total = sources.len();
            for (index, mut source) in sources.into_iter().enumerate() {
                if check().is_err() {
                    result.cancelled = true;
                    break;
                }
                *self
                    .progress
                    .lock()
                    .map_err(|_| Error::new("UNAVAILABLE"))? = Progress {
                    stage: "encrypt_and_verify".into(),
                    done: index,
                    total,
                };
                let operation: Result<()> = (|| {
                    let mut parts = Vec::new();
                    let mut parent = folder.to_owned();
                    for component in source.folders {
                        parts.push(component.clone());
                        parent = if let Some(id) = folders.get(&parts) {
                            id.clone()
                        } else {
                            let id = s.folder(&snapshot, &parent, &component, &|| check())?;
                            snapshot = s.snapshot().unwrap();
                            folders.insert(parts.clone(), id.clone());
                            id
                        };
                    }
                    s.import(
                        &snapshot,
                        &mut source.file,
                        &source.name,
                        &parent,
                        replace,
                        &|| check(),
                    )?;
                    snapshot = s.snapshot().unwrap();
                    Ok(())
                })();
                let item = ImportItem {
                    index,
                    name: source.name.clone(),
                    status: if operation.is_ok() {
                        "verified_and_saved"
                    } else {
                        "failed"
                    }
                    .into(),
                    code: operation.as_ref().err().map(|e| e.code.to_string()),
                };
                self.results
                    .lock()
                    .map_err(|_| Error::new("UNAVAILABLE"))?
                    .push(item);
                if operation.is_ok() {
                    result.imported += 1;
                } else {
                    result.failed += 1;
                }
            }
            self.queue_backup(s);
            *self
                .progress
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))? = Progress {
                stage: "completed".into(),
                done: result.imported,
                total,
            };
            Ok(result)
        })
    }
    pub fn import_results(&self, token: &str, offset: usize) -> Result<Vec<ImportItem>> {
        self.check(token)?;
        if offset > 50_000 {
            return Err(Error::new("INVALID_INPUT"));
        }
        let results = self
            .results
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .iter()
            .skip(offset)
            .take(200)
            .cloned()
            .collect();
        self.check(token)?;
        Ok(results)
    }
    pub fn export(
        &self,
        token: &str,
        file: &str,
        version: Option<&str>,
        destination: &Path,
    ) -> Result<()> {
        let _admit = self.admit()?;
        self.session(token, |s, c| s.export(file, version, destination, &|| c()))
    }
    pub fn rotate(&self, token: &str, expected: &str, current: String, next: String) -> Result<()> {
        let current = Zeroizing::new(current);
        let next = Zeroizing::new(next);
        let _admit = self.admit()?;
        self.session(token, |s, c| {
            s.rotate(expected, current.as_bytes(), next.as_bytes(), &|| c())?;
            self.queue_backup(s);
            Ok(())
        })
    }
    pub fn backup(&self, token: &str, destination: &Path) -> Result<PathBuf> {
        let _admit = self.admit()?;
        // A manual copy is never included in the managed retention journal.
        let plan = self.session(token, |s, _| s.backup_plan())?;
        plan.copy_to(destination, &|| self.check(token))
    }
    pub fn configure_backup(
        &self,
        token: &str,
        destination: &Path,
        retention: usize,
    ) -> Result<()> {
        self.check(token)?;
        self.backups.configure(destination, retention)?;
        self.session(token, |s, _| {
            self.queue_backup(s);
            Ok(())
        })
    }
    pub fn restore(&self, path: &Path, password: String, confirm: bool) -> Result<()> {
        self.restore_at(
            path,
            password,
            confirm,
            self.epoch.load(Ordering::SeqCst),
            None,
            &|| {},
        )
    }
    fn restore_at(
        &self,
        path: &Path,
        password: String,
        confirm: bool,
        expected: u64,
        expected_head_hash: Option<&str>,
        notice: &impl Fn(),
    ) -> Result<()> {
        let password = Zeroizing::new(password);
        let _admit = self.admit()?;
        let epoch = self.begin_revocation(Some(expected))?;
        notice();
        self.dispose_locked();
        let check = || {
            if self.epoch.load(Ordering::SeqCst) == epoch {
                Ok(())
            } else {
                Err(Error::new("CANCELLED"))
            }
        };
        let mut s = self.store.try_lock().map_err(|_| Error::new("BUSY"))?;
        check()?;
        let result = s.restore_head(
            path,
            password.as_bytes(),
            confirm,
            expected_head_hash,
            &check,
        );
        self.exists.store(s.exists(), Ordering::Release);
        if result.is_ok() {
            self.queue_backup(&s);
        }
        s.lock();
        result
    }
    pub fn verify_candidate(&self, path: &Path, password: String) -> Result<serde_json::Value> {
        let _admit = self.admit()?;
        let path = io::user_path(path)?;
        let pins = io::pin_directory(&path)?;
        let epoch = self.epoch.load(Ordering::SeqCst);
        let password = Zeroizing::new(password);
        let head_hash = hash_head(&path)?;
        let (head, c) =
            SafeStore::verify_package_head(&path, password.as_bytes(), Some(&head_hash), &|| {
                if self.epoch.load(Ordering::SeqCst) == epoch {
                    Ok(())
                } else {
                    Err(Error::new("CANCELLED"))
                }
            })?;
        let summary = serde_json::json!({"status":"verified","snapshot_id":head.snapshot_id,"files":c.files.len(),"versions":c.files.iter().map(|f|f.versions.len()).sum::<usize>()});
        if self.epoch.load(Ordering::SeqCst) != epoch {
            return Err(Error::new("CANCELLED"));
        }
        let id = id();
        if hash_head(&path)? != head_hash {
            return Err(Error::new("CONFLICT"));
        }
        let identity = io::identity(&path)?;
        let mut candidate = self
            .candidate
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?;
        if self.epoch.load(Ordering::SeqCst) != epoch {
            return Err(Error::new("CANCELLED"));
        }
        *candidate = Some(Candidate {
            id: id.clone(),
            path,
            head_hash,
            identity,
            epoch,
            _pins: pins,
        });
        let mut summary = summary;
        summary["candidate"] = serde_json::Value::String(id);
        Ok(summary)
    }
    pub fn restore_candidate(
        &self,
        id: &str,
        password: String,
        confirm: bool,
        notice: &impl Fn(),
    ) -> Result<()> {
        let c = self
            .candidate
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .take()
            .ok_or(Error::new("INVALID_STATE"))?;
        if c.id != id || hash_head(&c.path)? != c.head_hash || io::identity(&c.path)? != c.identity
        {
            return Err(Error::new("CONFLICT"));
        }
        self.restore_at(
            &c.path,
            password,
            confirm,
            c.epoch,
            Some(&c.head_hash),
            notice,
        )
    }
    pub fn verify(path: &Path, password: String) -> Result<serde_json::Value> {
        let password = Zeroizing::new(password);
        let (head, c) = SafeStore::verify_package(path, password.as_bytes(), &|| Ok(()))?;
        Ok(
            serde_json::json!({"status":"verified","snapshot_id":head.snapshot_id,"files":c.files.len(),"versions":c.files.iter().map(|f|f.versions.len()).sum::<usize>()}),
        )
    }
}

pub fn collect_sources(paths: Vec<PathBuf>, recursive: bool) -> Result<(Vec<Source>, usize)> {
    let mut sources = Vec::new();
    let mut skipped = 0usize;
    fn walk(
        path: &Path,
        folders: Vec<String>,
        sources: &mut Vec<Source>,
        skipped: &mut usize,
    ) -> Result<()> {
        if sources.len() >= 50_000 || folders.len() > 64 {
            return Err(Error::new("LIMIT_EXCEEDED"));
        }
        if io::reject_links(path).is_err() {
            *skipped += 1;
            return Ok(());
        }
        let metadata = std::fs::symlink_metadata(path)?;
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or(Error::new("INVALID_INPUT"))?
            .to_owned();
        if metadata.is_dir() {
            let _pins = io::pin_directory(path)?;
            let mut parts = folders;
            parts.push(name);
            for entry in std::fs::read_dir(path)? {
                walk(&entry?.path(), parts.clone(), sources, skipped)?;
            }
        } else if metadata.is_file() {
            let pins = io::pin_directory(path.parent().ok_or(Error::new("INVALID_INPUT"))?)?;
            match open_read(path) {
                Ok(file) => sources.push(Source {
                    file,
                    name,
                    folders,
                    _pins: pins,
                }),
                Err(_) => *skipped += 1,
            };
        } else {
            *skipped += 1;
        }
        Ok(())
    }
    for path in paths {
        let path = io::user_path(&path)?;
        if recursive {
            walk(&path, vec![], &mut sources, &mut skipped)?;
        } else {
            let pins = io::pin_directory(path.parent().ok_or(Error::new("INVALID_INPUT"))?)?;
            match open_read(&path) {
                Ok(file) => sources.push(Source {
                    file,
                    name: path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .ok_or(Error::new("INVALID_INPUT"))?
                        .to_owned(),
                    folders: vec![],
                    _pins: pins,
                }),
                Err(_) => skipped += 1,
            };
        }
    }
    Ok((sources, skipped))
}

fn hash_head(path: &Path) -> Result<String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut b = Vec::new();
    open_read(&path.join("HEAD.json"))?
        .take(1025)
        .read_to_end(&mut b)?;
    if b.len() > 1024 {
        return Err(Error::new("CORRUPT"));
    }
    Ok(super::format::hex(&Sha256::digest(b)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lock_revokes_without_waiting_for_a_busy_store_and_discards_late_result() {
        let temp = tempfile::tempdir().unwrap();
        let manager = std::sync::Arc::new(SafeManager::open(&temp.path().join("safe")).unwrap());
        let token = manager.access("password".into(), true).unwrap();
        let (entered, ready) = std::sync::mpsc::channel();
        let (release, resume) = std::sync::mpsc::channel();
        let copy = manager.clone();
        let t = token.clone();
        let worker = std::thread::spawn(move || {
            copy.session(&t, |_, _| {
                entered.send(()).unwrap();
                resume.recv().unwrap();
                Ok("late sensitive result")
            })
        });
        ready.recv().unwrap();
        let start = Instant::now();
        manager.lock();
        assert!(start.elapsed() < Duration::from_secs(1));
        assert!(manager.check(&token).is_err());
        assert!(!manager.status().unwrap().unlocked);
        release.send(()).unwrap();
        assert!(worker.join().unwrap().is_err());
        assert!(!manager.store.lock().unwrap().unlocked());
    }
}

#[cfg(test)]
mod stale_tests {
    use super::*;
    #[test]
    fn queued_password_and_candidate_cannot_outlive_native_revocation() {
        let temp = tempfile::tempdir().unwrap();
        let manager = SafeManager::open(&temp.path().join("safe")).unwrap();
        let epoch = manager.status().unwrap().generation.parse::<u64>().unwrap();
        manager.lock();
        assert!(manager.access_at("password".into(), true, epoch).is_err());
        assert!(!manager.status().unwrap().exists);
        let fresh = manager.status().unwrap().generation.parse::<u64>().unwrap();
        assert_ne!(epoch, fresh);
        manager.access_at("password".into(), true, fresh).unwrap();
    }
}

#[cfg(windows)]
pub struct SafeHost {
    pub manager: Option<std::sync::Arc<SafeManager>>,
}
#[cfg(windows)]
impl SafeHost {
    pub fn get(&self) -> Result<std::sync::Arc<SafeManager>> {
        self.manager.clone().ok_or(Error::new("UNAVAILABLE"))
    }
}
