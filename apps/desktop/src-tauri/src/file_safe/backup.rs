//! Coalesced ciphertext-only snapshots; no unlock capability enters this queue.
use super::{
    format::{hex, CHUNK},
    store::{open_read, BackupPlan},
};
use crate::{
    filesystem as io,
    storage::{Error, Result},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Owned {
    name: String,
    identity: String,
    manifest_hash: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    destination: Option<PathBuf>,
    identity: Option<String>,
    retention: usize,
    owned: Vec<Owned>,
}
struct State {
    config: Config,
    pending: Option<BackupPlan>,
    due: Option<Instant>,
    copying: bool,
    status: &'static str,
    completed_snapshot: Option<String>,
}
pub struct BackupQueue {
    path: PathBuf,
    state: Mutex<State>,
}
#[derive(Serialize)]
pub struct BackupStatus {
    pub status: String,
    pub configured: bool,
    pub retention: usize,
    pub completed_snapshot: Option<String>,
    pub pending_snapshot: Option<String>,
    pub retained_packages: usize,
}
impl BackupQueue {
    pub fn open(base: &Path) -> Result<Self> {
        let path = base.join("backup-settings.json");
        let config = if path.exists() {
            let mut bytes = Vec::new();
            open_read(&path)?
                .take(64 * 1024 * 1024 + 1)
                .read_to_end(&mut bytes)?;
            if bytes.len() > 64 * 1024 * 1024 {
                return Err(Error::new("CORRUPT"));
            }
            let c: Config = serde_json::from_slice(&bytes).map_err(|_| Error::new("CORRUPT"))?;
            if !(1..=100).contains(&c.retention)
                || c.owned.len() > 1000
                || c.destination.is_some() != c.identity.is_some()
            {
                return Err(Error::new("CORRUPT"));
            }
            c
        } else {
            Config {
                destination: None,
                identity: None,
                retention: 10,
                owned: vec![],
            }
        };
        let initial_status = if config.destination.is_some() {
            "ready"
        } else {
            "unconfigured"
        };
        Ok(Self {
            path,
            state: Mutex::new(State {
                config,
                pending: None,
                due: None,
                copying: false,
                status: initial_status,
                completed_snapshot: None,
            }),
        })
    }
    fn save(&self, c: &Config) -> Result<()> {
        io::atomic_json(
            &self.path,
            &serde_json::to_vec(c).map_err(|_| Error::new("CORRUPT"))?,
        )
    }
    pub fn configure(&self, path: &Path, retention: usize) -> Result<()> {
        if !(1..=100).contains(&retention) {
            return Err(Error::new("INVALID_INPUT"));
        }
        let path = io::user_path(path)?;
        let _pins = io::pin_directory(&path)?;
        let identity = io::identity(&path)?;
        let mut s = self.state.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        if s.copying {
            return Err(Error::new("BUSY"));
        }
        let mut c = s.config.clone();
        if c.destination.as_ref() != Some(&path) || c.identity.as_ref() != Some(&identity) {
            c.owned.clear();
        }
        c.destination = Some(path);
        c.identity = Some(identity);
        c.retention = retention;
        self.save(&c)?;
        s.config = c;
        s.status = "ready";
        Ok(())
    }
    pub fn enqueue(&self, plan: BackupPlan) -> Result<()> {
        let mut s = self.state.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        if s.config.destination.is_some() {
            s.pending = Some(plan);
            s.due = Some(Instant::now() + Duration::from_secs(30));
            s.status = "pending";
        }
        Ok(())
    }
    pub fn status(&self) -> Result<BackupStatus> {
        let s = self.state.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        Ok(BackupStatus {
            status: s.status.to_owned(),
            configured: s.config.destination.is_some(),
            retention: s.config.retention,
            completed_snapshot: s.completed_snapshot.clone(),
            pending_snapshot: s.pending.as_ref().map(|p| p.snapshot.clone()),
            retained_packages: s.config.owned.len(),
        })
    }
    pub fn report_failure(&self) {
        if let Ok(mut s) = self.state.lock() {
            s.status = "failed";
        }
    }
    pub fn retry(&self) -> Result<()> {
        let mut s = self.state.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        s.due = Some(Instant::now());
        Ok(())
    }
    pub fn run_due(&self) {
        let job = self.state.lock().ok().and_then(|mut s| {
            if s.copying || s.due.is_none_or(|d| Instant::now() < d) {
                return None;
            }
            let p = s.pending.take()?;
            s.copying = true;
            s.status = "copying";
            Some((p, s.config.clone()))
        });
        let Some((plan, mut config)) = job else {
            return;
        };
        let snapshot = plan.snapshot.clone();
        let mut copy_complete = false;
        let result = (|| {
            let destination = config
                .destination
                .as_ref()
                .ok_or(Error::new("UNAVAILABLE"))?;
            let _pins = io::pin_directory(destination)?;
            if Some(io::identity(destination)?) != config.identity {
                return Err(Error::new("CONFLICT"));
            }
            if config.owned.len() >= 1000 {
                return Err(Error::new("RETENTION_BLOCKED"));
            }
            let package = plan.duplicate()?.copy_to(destination, &|| Ok(()))?;
            let owned = Owned {
                name: package
                    .file_name()
                    .unwrap()
                    .to_str()
                    .ok_or(Error::new("CORRUPT"))?
                    .to_owned(),
                identity: io::identity(&package)?,
                manifest_hash: manifest_hash(&manifest(&package)?)?,
            };
            config.owned.push(owned);
            // Persist ownership before considering retention. Manual exports are
            // absent from this journal and can never become prune candidates.
            self.save(&config)?;
            copy_complete = true;
            while config.owned.len() > config.retention {
                let old = &config.owned[0];
                let candidate = io::child(destination, &old.name)?;
                let entries = manifest(&candidate)?;
                if !old.name.starts_with("file-safe-")
                    || io::identity(&candidate)? != old.identity
                    || manifest_hash(&entries)? != old.manifest_hash
                {
                    return Err(Error::new("RETENTION_BLOCKED"));
                }
                prune(&candidate, &entries)?;
                config.owned.remove(0);
                self.save(&config)?;
            }
            Ok(())
        })();
        if let Ok(mut s) = self.state.lock() {
            s.copying = false;
            s.config = config;
            if result.is_ok() {
                s.completed_snapshot = Some(snapshot);
                s.status = if s.pending.is_some() {
                    "pending"
                } else {
                    "ciphertext_copy_verified"
                };
            } else {
                // Preserve one pinned retry capability; a newer queued commit
                // already supersedes it and must not be displaced.
                if copy_complete {
                    s.completed_snapshot = Some(snapshot);
                    s.status = "retention_blocked";
                } else {
                    if s.pending.is_none() {
                        s.pending = Some(plan);
                        s.due = None;
                    }
                    s.status = "failed";
                }
            }
        }
    }
}
fn digest(mut f: File) -> Result<String> {
    let mut h = Sha256::new();
    let mut b = vec![0; CHUNK];
    loop {
        let n = f.read(&mut b)?;
        if n == 0 {
            break;
        }
        h.update(&b[..n]);
    }
    Ok(hex(&h.finalize()))
}
fn manifest(path: &Path) -> Result<BTreeMap<String, String>> {
    let _pins = io::pin_directory(path)?;
    let mut entries = BTreeMap::new();
    for entry in fs::read_dir(path)? {
        let e = entry?;
        let name = e
            .file_name()
            .into_string()
            .map_err(|_| Error::new("CORRUPT"))?;
        if name == "HEAD.json" {
            entries.insert(name, digest(open_read(&e.path())?)?);
        } else if ["keys", "catalogs", "objects"].contains(&name.as_str()) {
            let _pins = io::pin_directory(&e.path())?;
            for child in fs::read_dir(e.path())? {
                let child = child?;
                let component = child
                    .file_name()
                    .into_string()
                    .map_err(|_| Error::new("CORRUPT"))?;
                if component.len() > 40
                    || !component
                        .bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.')
                {
                    return Err(Error::new("CORRUPT"));
                }
                entries.insert(
                    format!("{name}/{component}"),
                    digest(open_read(&child.path())?)?,
                );
                if entries.len() > 100003 {
                    return Err(Error::new("LIMIT_EXCEEDED"));
                }
            }
        } else {
            return Err(Error::new("RETENTION_BLOCKED"));
        }
    }
    if !entries.contains_key("HEAD.json") {
        return Err(Error::new("CORRUPT"));
    }
    Ok(entries)
}
fn prune(path: &Path, entries: &BTreeMap<String, String>) -> Result<()> {
    let root_pins = io::pin_directory(path)?;
    let mut pins = Vec::new();
    for d in ["keys", "catalogs", "objects"] {
        pins.extend(io::pin_directory(&path.join(d))?);
    }
    #[cfg(windows)]
    {
        use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
        use windows_sys::Win32::Storage::FileSystem::{
            FileDispositionInfo, SetFileInformationByHandle, FILE_DISPOSITION_INFO,
        };
        let mut handles = Vec::new();
        for (name, hash) in entries {
            let p = path.join(name);
            io::reject_links(&p)?;
            let f = std::fs::OpenOptions::new()
                .read(true)
                .access_mode(0x80000000 | 0x10000)
                .share_mode(1)
                .custom_flags(0x00200000)
                .open(&p)?;
            use std::os::windows::fs::MetadataExt;
            if !f.metadata()?.is_file()
                || f.metadata()?.file_attributes() & 0x400 != 0
                || digest(f.try_clone()?)? != *hash
            {
                return Err(Error::new("RETENTION_BLOCKED"));
            }
            handles.push(f);
        }
        for f in handles {
            let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
            if unsafe {
                SetFileInformationByHandle(
                    f.as_raw_handle().cast(),
                    FileDispositionInfo,
                    (&disposition as *const FILE_DISPOSITION_INFO).cast(),
                    std::mem::size_of::<FILE_DISPOSITION_INFO>() as u32,
                )
            } == 0
            {
                return Err(std::io::Error::last_os_error().into());
            }
        }
    }
    #[cfg(not(windows))]
    for (name, hash) in entries {
        if digest(open_read(&path.join(name))?)? != *hash {
            return Err(Error::new("RETENTION_BLOCKED"));
        }
        fs::remove_file(path.join(name))?;
    }
    drop(pins);
    for d in ["keys", "catalogs", "objects"] {
        fs::remove_dir(path.join(d))?;
    }
    drop(root_pins);
    fs::remove_dir(path)?;
    Ok(())
}

fn manifest_hash(entries: &BTreeMap<String, String>) -> Result<String> {
    Ok(hex(&Sha256::digest(
        serde_json::to_vec(entries).map_err(|_| Error::new("CORRUPT"))?,
    )))
}
