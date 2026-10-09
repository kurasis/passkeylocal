//! Native streaming store. The password-vault worker never sees file-safe keys.
use super::format::*;
use crate::{
    filesystem as io,
    storage::{Error, Result},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};
use zeroize::Zeroizing;

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Active {
    format_version: u8,
    store_id: String,
    vault_id: String,
}
struct Session {
    root: RootKey,
    catalog: Catalog,
    head_bytes: Vec<u8>,
    catalog_hash: String,
    _pins: Vec<File>,
}
pub struct SafeStore {
    base: PathBuf,
    active: Option<Active>,
    active_bytes: Option<Vec<u8>>,
    session: Option<Session>,
    _lock: File,
    _pins: Vec<File>,
    #[cfg(test)]
    fault: Option<&'static str>,
}
#[derive(Serialize)]
pub struct FileView {
    pub id: String,
    pub folder_id: String,
    pub name: String,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
    pub deleted: bool,
    pub size: String,
    pub modified_at: String,
    pub current_version_id: String,
    pub versions: Vec<VersionView>,
}
#[derive(Serialize)]
pub struct VersionView {
    pub id: String,
    pub size: String,
    pub created_at: String,
    pub current: bool,
}
#[derive(Serialize)]
pub struct Listing {
    pub snapshot_id: String,
    pub sequence: String,
    pub folders: Vec<Folder>,
    pub files: Vec<FileView>,
    pub storage_bytes: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Edit {
    pub file_id: String,
    pub folder_id: String,
    pub name: String,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
}

pub fn directory(path: &Path) -> Result<()> {
    io::reject_links(path)?;
    fs::create_dir_all(path)?;
    io::secure_directory(path)
}
pub fn open_read(path: &Path) -> Result<File> {
    io::reject_links(path)?;
    let mut o = OpenOptions::new();
    o.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        o.share_mode(1).custom_flags(0x00200000);
    }
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::OpenOptionsExt;
        o.custom_flags(0x20000);
    }
    let f = o.open(path)?;
    let m = f.metadata()?;
    if !m.is_file() || m.len() > MAX_FILE + MAX_FILE / CHUNK as u64 * 21 + 128 {
        return Err(Error::new("CORRUPT"));
    }
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Storage::FileSystem::{
            GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
        };
        let mut info = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
        if unsafe { GetFileInformationByHandle(f.as_raw_handle() as _, &mut info) } == 0
            || info.dwFileAttributes & 0x400 != 0
            || info.nNumberOfLinks != 1
        {
            return Err(Error::new("UNAVAILABLE"));
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if m.nlink() != 1 {
            return Err(Error::new("UNAVAILABLE"));
        }
    }
    Ok(f)
}
pub fn new_file(path: &Path) -> Result<File> {
    io::reject_links(path)?;
    let mut o = OpenOptions::new();
    o.write(true).create_new(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        o.share_mode(0)
            .access_mode(0x40000000 | 0x00040000 | 0x00020000)
            .custom_flags(0x00200000);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        o.mode(0o600);
    }
    let f = o.open(path)?;
    #[cfg(windows)]
    io::secure_file_handle(&f, false)?;
    Ok(f)
}
fn read_small(path: &Path, max: usize) -> Result<Vec<u8>> {
    let f = open_read(path)?;
    if f.metadata()?.len() > max as u64 {
        return Err(Error::new("CORRUPT"));
    }
    let mut b = Vec::new();
    f.take(max as u64 + 1).read_to_end(&mut b)?;
    if b.len() > max {
        return Err(Error::new("CORRUPT"));
    }
    Ok(b)
}
fn immutable(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut f = new_file(path)?;
    f.write_all(bytes)?;
    f.sync_all()?;
    drop(f);
    if read_small(path, bytes.len())? != bytes {
        return Err(Error::new("READBACK_FAILED"));
    }
    Ok(())
}
fn encoded<T: Serialize>(v: &T) -> Result<Vec<u8>> {
    serde_json::to_vec(v).map_err(|_| Error::new("CORRUPT"))
}
fn hash(b: &[u8]) -> String {
    hex(&Sha256::digest(b))
}
impl SafeStore {
    pub fn open(base: &Path) -> Result<Self> {
        init()?;
        directory(base)?;
        directory(&base.join("stores"))?;
        let pins = io::pin_directory(base)?;
        let lock_path = base.join("safe.lock");
        if !lock_path.exists() {
            match new_file(&lock_path) {
                Ok(f) => {
                    f.sync_all()?;
                }
                Err(_) if lock_path.exists() => {}
                Err(e) => return Err(e),
            }
        }
        io::reject_links(&lock_path)?;
        let mut options = OpenOptions::new();
        options.read(true).write(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(3).custom_flags(0x00200000);
        }
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.custom_flags(0x20000);
        }
        let lock = options.open(&lock_path)?;
        let metadata = lock.metadata()?;
        if !metadata.is_file() {
            return Err(Error::new("UNAVAILABLE"));
        }
        #[cfg(windows)]
        {
            use std::os::windows::{fs::MetadataExt, io::AsRawHandle};
            use windows_sys::Win32::Storage::FileSystem::{
                GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
            };
            let mut info = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
            if metadata.file_attributes() & 0x400 != 0
                || unsafe { GetFileInformationByHandle(lock.as_raw_handle().cast(), &mut info) }
                    == 0
                || info.nNumberOfLinks != 1
            {
                return Err(Error::new("UNAVAILABLE"));
            }
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if metadata.nlink() != 1 {
                return Err(Error::new("UNAVAILABLE"));
            }
        }
        lock.try_lock_exclusive()
            .map_err(|_| Error::new("CONFLICT"))?;
        let mut s = Self {
            base: base.to_owned(),
            active: None,
            active_bytes: None,
            session: None,
            _lock: lock,
            _pins: pins,
            #[cfg(test)]
            fault: None,
        };
        if s.base.join("ACTIVE.json").exists() {
            let _ = s.reload_active();
        }
        Ok(s)
    }
    #[cfg(test)]
    pub fn fail_at(&mut self, stage: &'static str) {
        self.fault = Some(stage);
    }
    fn boundary(&self, stage: &str) -> Result<()> {
        #[cfg(test)]
        if self.fault == Some(stage) {
            return Err(Error::new("INJECTED_FAILURE"));
        }
        let _ = stage;
        Ok(())
    }
    fn reload_active(&mut self) -> Result<()> {
        let bytes = read_small(&self.base.join("ACTIVE.json"), 1024)?;
        let a: Active = serde_json::from_slice(&bytes).map_err(|_| Error::new("CORRUPT"))?;
        if a.format_version != 1 || !valid_id(&a.store_id) || !valid_id(&a.vault_id) {
            return Err(Error::new("CORRUPT"));
        }
        self.active = Some(a);
        self.active_bytes = Some(bytes);
        Ok(())
    }
    fn root_for(&self, a: &Active) -> Result<PathBuf> {
        if !valid_id(&a.store_id) || !valid_id(&a.vault_id) {
            return Err(Error::new("CORRUPT"));
        }
        let p = self.base.join("stores").join(&a.store_id).join(&a.vault_id);
        io::reject_links(&p)?;
        Ok(p)
    }
    fn path(&self) -> Result<PathBuf> {
        self.root_for(self.active.as_ref().ok_or(Error::new("INVALID_STATE"))?)
    }
    pub fn exists(&self) -> bool {
        self.base.join("ACTIVE.json").exists()
            || fs::read_dir(self.base.join("stores"))
                .map(|mut entries| entries.next().is_some())
                .unwrap_or(true)
    }
    pub fn unlocked(&self) -> bool {
        self.session.is_some()
    }
    pub fn damaged(&self) -> bool {
        self.exists() && self.active.is_none()
    }
    pub fn lock(&mut self) {
        self.session = None;
    }
    pub fn snapshot(&self) -> Option<String> {
        self.session.as_ref().map(|s| s.catalog.snapshot_id.clone())
    }
    pub fn create(&mut self, password: &[u8], check: &impl Fn() -> Result<()>) -> Result<()> {
        validate_password(password)?;
        if self.exists() || fs::read_dir(self.base.join("stores"))?.next().is_some() {
            return Err(Error::new("CONFLICT"));
        }
        check()?;
        let a = Active {
            format_version: 1,
            store_id: id(),
            vault_id: id(),
        };
        let path = self.root_for(&a)?;
        Self::layout(&path)?;
        let root = Zeroizing::new(random::<32>());
        let c = Catalog {
            schema_version: 1,
            vault_id: a.vault_id.clone(),
            key_epoch_id: id(),
            snapshot_id: id(),
            commit_sequence: 1,
            prior_snapshot_id: None,
            folders: vec![Folder {
                id: id(),
                parent_id: None,
                name: String::new(),
            }],
            files: vec![],
            policy: Policy {
                history_previous_versions: 10,
            },
        };
        let h = c.head();
        let keys = write_key(&h, &root, password)?;
        check()?;
        immutable(
            &path.join("keys").join(format!("{}.key", h.key_epoch_id)),
            &keys,
        )?;
        self.boundary("initial-key")?;
        let cat = write_catalog(&c, &root)?;
        immutable(
            &path.join("catalogs").join(format!("{}.cat", h.snapshot_id)),
            &cat,
        )?;
        self.boundary("initial-catalog")?;
        let head = encoded(&h)?;
        immutable(&path.join("HEAD.json"), &head)?;
        self.boundary("initial-head")?;
        check()?;
        let active_bytes = encoded(&a)?;
        io::atomic_json(&self.base.join("ACTIVE.json"), &active_bytes)?;
        self.active_bytes = Some(active_bytes);
        self.boundary("initial-active")?;
        self.active = Some(a);
        self.session = Some(Session {
            root,
            catalog: c,
            head_bytes: head,
            catalog_hash: hash(&cat),
            _pins: Self::pins(&path)?,
        });
        check()?;
        Ok(())
    }
    fn pins(path: &Path) -> Result<Vec<File>> {
        let mut pins = io::pin_directory(path)?;
        for d in ["keys", "catalogs", "objects", "staging"] {
            if path.join(d).exists() {
                pins.extend(io::pin_directory(&path.join(d))?);
            }
        }
        Ok(pins)
    }
    fn layout(path: &Path) -> Result<()> {
        directory(path)?;
        for n in ["keys", "catalogs", "objects", "staging"] {
            directory(&path.join(n))?;
        }
        Ok(())
    }
    pub fn unlock(&mut self, password: &[u8], check: &impl Fn() -> Result<()>) -> Result<()> {
        self.lock();
        self.reload_active()?;
        let p = self.path()?;
        let _pins = io::pin_directory(&p)?;
        let hb = read_small(&p.join("HEAD.json"), 1024)?;
        let h = Head::parse(&hb)?;
        if self.active.as_ref().unwrap().vault_id != h.vault_id {
            return Err(Error::new("CORRUPT"));
        }
        let root = read_key(
            &read_small(&p.join("keys").join(format!("{}.key", h.key_epoch_id)), 140)?,
            &h,
            password,
        )?;
        check()?;
        let cb = read_small(
            &p.join("catalogs").join(format!("{}.cat", h.snapshot_id)),
            MAX_CATALOG + 104,
        )?;
        let catalog = read_catalog(&cb, &h, &root)?;
        Self::references(&p, &catalog)?;
        check()?;
        self.session = Some(Session {
            root,
            catalog,
            head_bytes: hb,
            catalog_hash: hash(&cb),
            _pins: Self::pins(&p)?,
        });
        Ok(())
    }
    #[cfg(any(windows, test))]
    pub(super) fn hello_binding(&mut self) -> Result<crate::hello::enrollment::Binding> {
        use crate::hello::enrollment::{Binding, SafeBinding};
        self.reload_active()?;
        let p = self.path()?;
        let _pins = io::pin_directory(&p)?;
        let hb = read_small(&p.join("HEAD.json"), 1024)?;
        let h = Head::parse(&hb)?;
        let active = self.active.as_ref().ok_or(Error::new("CORRUPT"))?;
        if h.vault_id != active.vault_id {
            return Err(Error::new("CORRUPT"));
        }
        // Include the exact selected locator and HEAD; this is not a root verifier.
        let digest = hash(
            &[
                self.active_bytes.as_ref().unwrap().as_slice(),
                hb.as_slice(),
            ]
            .concat(),
        );
        if read_small(&self.base.join("ACTIVE.json"), 1024)? != *self.active_bytes.as_ref().unwrap()
        {
            return Err(Error::new("CONFLICT"));
        }
        Ok(Binding {
            vault: h.vault_id,
            password_epoch: 0,
            generation: 0,
            sha256: digest,
            safe: Some(SafeBinding {
                store_id: active.store_id.clone(),
                key_epoch_id: h.key_epoch_id,
            }),
        })
    }
    #[cfg(any(windows, test))]
    pub(super) fn verified_hello_root(
        &mut self,
        password: &[u8],
    ) -> Result<(crate::hello::enrollment::Binding, RootKey)> {
        let snapshot = self.session()?.catalog.snapshot_id.clone();
        self.checked(&snapshot)?;
        let binding = self.hello_binding()?;
        let p = self.path()?;
        let h = Head::parse(&self.session()?.head_bytes)?;
        let root = read_key(
            &read_small(&p.join("keys").join(format!("{}.key", h.key_epoch_id)), 140)?,
            &h,
            password,
        )?;
        if !libsodium_rs::utils::memcmp(root.as_ref(), self.session()?.root.as_ref()) {
            return Err(Error::new("AUTH_FAILED"));
        }
        self.checked(&snapshot)?;
        if self.hello_binding()? != binding {
            return Err(Error::new("CONFLICT"));
        }
        Ok((binding, root))
    }
    #[cfg(any(windows, test))]
    pub(super) fn unlock_with_root(
        &mut self,
        root: RootKey,
        binding: &crate::hello::enrollment::Binding,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.lock();
        check()?;
        if &self.hello_binding()? != binding {
            return Err(Error::new("CONFLICT"));
        }
        let p = self.path()?;
        let pins = Self::pins(&p)?;
        let hb = read_small(&p.join("HEAD.json"), 1024)?;
        let h = Head::parse(&hb)?;
        let cb = read_small(
            &p.join("catalogs").join(format!("{}.cat", h.snapshot_id)),
            MAX_CATALOG + 104,
        )?;
        let catalog = read_catalog(&cb, &h, &root)?;
        Self::references(&p, &catalog)?;
        check()?;
        if &self.hello_binding()? != binding {
            return Err(Error::new("CONFLICT"));
        }
        self.session = Some(Session {
            root,
            catalog,
            head_bytes: hb,
            catalog_hash: hash(&cb),
            _pins: pins,
        });
        Ok(())
    }
    fn session(&self) -> Result<&Session> {
        self.session.as_ref().ok_or(Error::new("LOCKED"))
    }
    fn checked(&self, expected: &str) -> Result<()> {
        let s = self.session()?;
        if s.catalog.snapshot_id != expected {
            return Err(Error::new("CONFLICT"));
        }
        let p = self.path()?;
        let a = read_small(&self.base.join("ACTIVE.json"), 1024)?;
        if Some(&a) != self.active_bytes.as_ref()
            || read_small(&p.join("HEAD.json"), 1024)? != s.head_bytes
            || hash(&read_small(
                &p.join("catalogs").join(format!("{}.cat", expected)),
                MAX_CATALOG + 104,
            )?) != s.catalog_hash
        {
            return Err(Error::new("CONFLICT"));
        }
        Ok(())
    }
    fn references(path: &Path, c: &Catalog) -> Result<()> {
        for f in &c.files {
            for v in &f.versions {
                if open_read(&path.join("objects").join(format!("{}.obj", v.object_id)))?
                    .metadata()?
                    .len()
                    < 85
                {
                    return Err(Error::new("CORRUPT"));
                }
            }
        }
        Ok(())
    }
    fn commit(
        &mut self,
        mut c: Catalog,
        expected: &str,
        rotated: Option<(RootKey, Vec<u8>)>,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        check()?;
        self.checked(expected)?;
        let p = self.path()?;
        let _pins = io::pin_directory(&p)?;
        c.prior_snapshot_id = Some(expected.to_owned());
        c.snapshot_id = id();
        c.commit_sequence = c
            .commit_sequence
            .checked_add(1)
            .ok_or(Error::new("LIMIT_EXCEEDED"))?;
        let root = rotated
            .as_ref()
            .map(|v| &v.0)
            .unwrap_or(&self.session()?.root);
        let head = c.head();
        c.validate(&head)?;
        Self::references(&p, &c)?;
        if let Some((_, key)) = &rotated {
            immutable(
                &p.join("keys").join(format!("{}.key", head.key_epoch_id)),
                key,
            )?;
        }
        self.boundary("rotated-key")?;
        let bytes = write_catalog(&c, root)?;
        let cat = p.join("catalogs").join(format!("{}.cat", head.snapshot_id));
        immutable(&cat, &bytes)?;
        self.boundary("catalog")?;
        read_catalog(&read_small(&cat, MAX_CATALOG + 104)?, &head, root)?;
        // A bounded opaque locator ledger preserves five prior committed heads.
        let recovery = p.join("RECOVERY.json");
        let mut previous: Vec<Head> = if recovery.exists() {
            serde_json::from_slice(&read_small(&recovery, 8192)?)
                .map_err(|_| Error::new("CORRUPT"))?
        } else {
            vec![]
        };
        if previous.len() > 5 {
            return Err(Error::new("CORRUPT"));
        }
        previous.insert(0, self.session()?.catalog.head());
        previous.truncate(5);
        io::atomic_json(&recovery, &encoded(&previous)?)?;
        self.boundary("recovery-ledger")?;
        check()?;
        self.checked(expected)?;
        let hb = encoded(&head)?;
        io::atomic_json(&p.join("HEAD.json"), &hb)?;
        self.boundary("head")?;
        let root = Zeroizing::new(**root);
        self.session = Some(Session {
            root,
            catalog: c,
            head_bytes: hb,
            catalog_hash: hash(&bytes),
            _pins: Self::pins(&p)?,
        });
        check()?;
        Ok(())
    }
    pub fn list(&self) -> Result<Listing> {
        let c = &self.session()?.catalog;
        self.checked(&c.snapshot_id)?;
        let mut storage = 0u64;
        let files = c
            .files
            .iter()
            .map(|f| {
                let v = f
                    .versions
                    .iter()
                    .find(|v| v.id == f.current_version_id)
                    .unwrap();
                for version in &f.versions {
                    storage = storage.saturating_add(version.plaintext_size);
                }
                FileView {
                    id: f.id.clone(),
                    folder_id: f.folder_id.clone(),
                    name: f.name.clone(),
                    tags: f.tags.clone(),
                    notes: f.notes.clone(),
                    favorite: f.favorite,
                    deleted: f.deleted,
                    size: v.plaintext_size.to_string(),
                    modified_at: f.modified_at.clone(),
                    current_version_id: f.current_version_id.clone(),
                    versions: f
                        .versions
                        .iter()
                        .map(|v| VersionView {
                            id: v.id.clone(),
                            size: v.plaintext_size.to_string(),
                            created_at: v.created_at.clone(),
                            current: v.id == f.current_version_id,
                        })
                        .collect(),
                }
            })
            .collect();
        Ok(Listing {
            snapshot_id: c.snapshot_id.clone(),
            sequence: c.commit_sequence.to_string(),
            folders: c.folders.clone(),
            files,
            storage_bytes: storage.to_string(),
        })
    }
    pub fn folder(
        &mut self,
        expected: &str,
        parent: &str,
        name: &str,
        check: &impl Fn() -> Result<()>,
    ) -> Result<String> {
        self.checked(expected)?;
        let mut c = self.session()?.catalog.clone();
        if !c.folders.iter().any(|f| f.id == parent) {
            return Err(Error::new("NOT_FOUND"));
        }
        let uuid = id();
        c.folders.push(Folder {
            id: uuid.clone(),
            parent_id: Some(parent.to_owned()),
            name: name.to_owned(),
        });
        self.commit(c, expected, None, check)?;
        Ok(uuid)
    }
    pub fn edit(
        &mut self,
        expected: &str,
        edit: &Edit,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.checked(expected)?;
        let mut c = self.session()?.catalog.clone();
        let f = c
            .files
            .iter_mut()
            .find(|f| f.id == edit.file_id)
            .ok_or(Error::new("NOT_FOUND"))?;
        f.folder_id = edit.folder_id.clone();
        f.name = edit.name.clone();
        f.tags = edit.tags.clone();
        f.notes = edit.notes.clone();
        f.favorite = edit.favorite;
        f.modified_at = stamp();
        self.commit(c, expected, None, check)
    }
    pub fn trash(
        &mut self,
        expected: &str,
        file: &str,
        deleted: bool,
        permanent: bool,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.checked(expected)?;
        let mut c = self.session()?.catalog.clone();
        let f = c
            .files
            .iter_mut()
            .find(|f| f.id == file)
            .ok_or(Error::new("NOT_FOUND"))?;
        if permanent && !f.deleted {
            return Err(Error::new("INVALID_STATE"));
        }
        f.deleted = deleted;
        f.modified_at = stamp();
        if permanent {
            c.files.retain(|f| f.id != file);
        }
        self.commit(c, expected, None, check)
    }
    pub fn trash_many(
        &mut self,
        expected: &str,
        files: &[String],
        deleted: bool,
        permanent: bool,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.checked(expected)?;
        let mut c = self.session()?.catalog.clone();
        let ids: HashSet<_> = files.iter().collect();
        if ids.len() != files.len() {
            return Err(Error::new("INVALID_INPUT"));
        }
        for id in &ids {
            let f = c
                .files
                .iter()
                .find(|f| &f.id == *id)
                .ok_or(Error::new("NOT_FOUND"))?;
            if permanent && !f.deleted {
                return Err(Error::new("INVALID_STATE"));
            }
        }
        for f in &mut c.files {
            if ids.contains(&f.id) {
                f.deleted = deleted;
                f.modified_at = stamp();
            }
        }
        if permanent {
            c.files.retain(|f| !ids.contains(&f.id));
        }
        self.commit(c, expected, None, check)
    }
    pub fn restore_version(
        &mut self,
        expected: &str,
        file: &str,
        version: &str,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.checked(expected)?;
        let mut c = self.session()?.catalog.clone();
        let f = c
            .files
            .iter_mut()
            .find(|f| f.id == file)
            .ok_or(Error::new("NOT_FOUND"))?;
        if !f.versions.iter().any(|v| v.id == version) {
            return Err(Error::new("NOT_FOUND"));
        }
        f.current_version_id = version.to_owned();
        f.modified_at = stamp();
        self.commit(c, expected, None, check)
    }
    pub fn import(
        &mut self,
        expected: &str,
        source: &mut File,
        name: &str,
        folder: &str,
        replace: Option<&str>,
        check: &impl Fn() -> Result<()>,
    ) -> Result<String> {
        self.checked(expected)?;
        let before = source.metadata()?;
        if before.len() > MAX_FILE {
            return Err(Error::new("LIMIT_EXCEEDED"));
        }
        let mut c = self.session()?.catalog.clone();
        if !c.folders.iter().any(|f| f.id == folder) {
            return Err(Error::new("NOT_FOUND"));
        }
        if replace.is_some_and(|id| !c.files.iter().any(|f| f.id == id && !f.deleted)) {
            return Err(Error::new("NOT_FOUND"));
        }
        let object = id();
        let key = Zeroizing::new(random::<32>());
        let p = self.path()?;
        let part = p.join("staging").join(format!("{}.part", id()));
        struct Part(PathBuf);
        impl Drop for Part {
            fn drop(&mut self) {
                let _ = fs::remove_file(&self.0);
            }
        }
        let _cleanup = Part(part.clone());
        let required = before
            .len()
            .saturating_add(before.len() / CHUNK as u64 * 21)
            .saturating_add(128)
            .saturating_add(MAX_CATALOG as u64 + 104);
        if fs2::available_space(&p)? < required {
            return Err(Error::new("SPACE_REQUIRED"));
        }
        let mut out = new_file(&part)?;
        let (size, digest) =
            encrypt_object(source, &mut out, &c.vault_id, &object, key.as_ref(), check)?;
        out.sync_all()?;
        drop(out);
        self.boundary("object-part")?;
        let after = source.metadata()?;
        if size != before.len()
            || before.len() != after.len()
            || before.modified()? != after.modified()?
        {
            return Err(Error::new("CONFLICT"));
        }
        let v = Version {
            id: id(),
            object_id: object.clone(),
            object_key: STANDARD.encode(key.as_ref()),
            plaintext_size: size,
            sha256: digest,
            created_at: stamp(),
            media_hint: String::new(),
        };
        decrypt_object(
            &mut open_read(&part)?,
            &mut std::io::sink(),
            &c.vault_id,
            &v,
            check,
        )?;
        check()?;
        io::replace(
            &part,
            &p.join("objects").join(format!("{object}.obj")),
            None,
            true,
        )?;
        self.boundary("object-published")?;
        let file_id = if let Some(fid) = replace {
            let f = c.files.iter_mut().find(|f| f.id == fid).unwrap();
            f.versions.push(v.clone());
            while f.versions.len() > 11 {
                f.versions.remove(0);
            }
            f.current_version_id = v.id.clone();
            f.modified_at = stamp();
            fid.to_owned()
        } else {
            let fid = id();
            c.files.push(SafeFile {
                id: fid.clone(),
                folder_id: folder.to_owned(),
                name: name.to_owned(),
                tags: vec![],
                notes: String::new(),
                favorite: false,
                created_at: stamp(),
                modified_at: stamp(),
                deleted: false,
                current_version_id: v.id.clone(),
                versions: vec![v],
            });
            fid
        };
        self.commit(c, expected, None, check)?;
        Ok(file_id)
    }
    pub fn rotate(
        &mut self,
        expected: &str,
        current: &[u8],
        next: &[u8],
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.checked(expected)?;
        let p = self.path()?;
        let c = &self.session()?.catalog;
        read_key(
            &read_small(&p.join("keys").join(format!("{}.key", c.key_epoch_id)), 140)?,
            &c.head(),
            current,
        )?;
        check()?;
        let mut c = c.clone();
        c.key_epoch_id = id();
        let root = Zeroizing::new(random::<32>());
        let key = write_key(&c.head(), &root, next)?;
        check()?;
        self.commit(c, expected, Some((root, key)), check)
    }
    pub fn export(
        &self,
        file: &str,
        version: Option<&str>,
        destination: &Path,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        let c = &self.session()?.catalog;
        let f = c
            .files
            .iter()
            .find(|f| f.id == file)
            .ok_or(Error::new("NOT_FOUND"))?;
        let v = f
            .versions
            .iter()
            .find(|v| v.id == version.unwrap_or(&f.current_version_id))
            .ok_or(Error::new("NOT_FOUND"))?;
        let destination = io::user_path(destination)?;
        let parent = destination.parent().ok_or(Error::new("INVALID_INPUT"))?;
        let _pins = io::pin_directory(parent)?;
        if fs2::available_space(parent)? < v.plaintext_size.saturating_add(65536) {
            return Err(Error::new("SPACE_REQUIRED"));
        }
        if destination.exists() {
            return Err(Error::new("CONFLICT"));
        }
        let part = parent.join(format!("file-safe-export-{}.part", id()));
        let result = (|| {
            let mut out = new_file(&part)?;
            decrypt_object(
                &mut open_read(
                    &self
                        .path()?
                        .join("objects")
                        .join(format!("{}.obj", v.object_id)),
                )?,
                &mut out,
                &c.vault_id,
                v,
                check,
            )?;
            out.sync_all()?;
            drop(out);
            check()?;
            io::replace(&part, &destination, None, true)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&part);
        }
        result
    }
    pub fn backup_plan(&self) -> Result<BackupPlan> {
        let s = self.session()?;
        self.checked(&s.catalog.snapshot_id)?;
        let p = self.path()?;
        let mut names = vec![
            format!("keys/{}.key", s.catalog.key_epoch_id),
            format!("catalogs/{}.cat", s.catalog.snapshot_id),
        ];
        let mut seen = HashSet::new();
        for f in &s.catalog.files {
            for v in &f.versions {
                if seen.insert(&v.object_id) {
                    names.push(format!("objects/{}.obj", v.object_id));
                }
            }
        }
        let files = names
            .into_iter()
            .map(|name| {
                let f = open_read(&p.join(&name))?;
                Ok((name, f))
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(BackupPlan {
            head: s.head_bytes.clone(),
            vault_id: s.catalog.vault_id.clone(),
            snapshot: s.catalog.snapshot_id.clone(),
            files,
            _pins: io::pin_directory(&p)?,
        })
    }
    pub fn verify_package(
        path: &Path,
        password: &[u8],
        check: &impl Fn() -> Result<()>,
    ) -> Result<(Head, Catalog)> {
        Self::verify_package_head(path, password, None, check)
    }
    pub fn verify_package_head(
        path: &Path,
        password: &[u8],
        expected_head_hash: Option<&str>,
        check: &impl Fn() -> Result<()>,
    ) -> Result<(Head, Catalog)> {
        let _pins = io::pin_directory(path)?;
        let head_bytes = read_small(&path.join("HEAD.json"), 1024)?;
        if expected_head_hash.is_some_and(|expected| hex(&Sha256::digest(&head_bytes)) != expected)
        {
            return Err(Error::new("CONFLICT"));
        }
        let h = Head::parse(&head_bytes)?;
        let root = read_key(
            &read_small(
                &path.join("keys").join(format!("{}.key", h.key_epoch_id)),
                140,
            )?,
            &h,
            password,
        )?;
        check()?;
        let c = read_catalog(
            &read_small(
                &path.join("catalogs").join(format!("{}.cat", h.snapshot_id)),
                MAX_CATALOG + 104,
            )?,
            &h,
            &root,
        )?;
        for f in &c.files {
            for v in &f.versions {
                decrypt_object(
                    &mut open_read(&path.join("objects").join(format!("{}.obj", v.object_id)))?,
                    &mut std::io::sink(),
                    &h.vault_id,
                    v,
                    check,
                )?;
            }
        }
        check()?;
        if read_small(&path.join("HEAD.json"), 1024)? != head_bytes {
            return Err(Error::new("CONFLICT"));
        }
        Ok((h, c))
    }
    pub fn restore(
        &mut self,
        source: &Path,
        password: &[u8],
        confirm: bool,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        self.restore_head(source, password, confirm, None, check)
    }
    pub fn restore_head(
        &mut self,
        source: &Path,
        password: &[u8],
        confirm: bool,
        expected_head_hash: Option<&str>,
        check: &impl Fn() -> Result<()>,
    ) -> Result<()> {
        if self.exists() && !confirm {
            return Err(Error::new("INVALID_STATE"));
        }
        let source = io::user_path(source)?;
        let _source_pins = io::pin_directory(&source)?;
        let (h, c) = Self::verify_package_head(&source, password, expected_head_hash, check)?;
        let prior = if self.base.join("ACTIVE.json").exists() {
            Some(read_small(&self.base.join("ACTIVE.json"), 1024)?)
        } else {
            None
        };
        if let Some(bytes) = &prior {
            // Preserve even a locked/corrupt current generation. Its ciphertext
            // remains under stores; the saved selector permits manual recovery.
            let root = self.base.join("before-restore");
            directory(&root)?;
            immutable(&root.join(format!("{}.active", id())), bytes)?;
            if self.session.is_some() {
                self.backup_plan()?.copy_to(&root, check)?;
            }
        }
        let a = Active {
            format_version: 1,
            store_id: id(),
            vault_id: h.vault_id.clone(),
        };
        let p = self.root_for(&a)?;
        Self::layout(&p)?;
        let mut names = vec![
            format!("keys/{}.key", h.key_epoch_id),
            format!("catalogs/{}.cat", h.snapshot_id),
        ];
        for f in &c.files {
            for v in &f.versions {
                names.push(format!("objects/{}.obj", v.object_id));
            }
        }
        for name in names {
            copy_verified(&mut open_read(&source.join(&name))?, &p.join(&name), check)?;
        }
        immutable(&p.join("HEAD.json"), &encoded(&h)?)?;
        Self::verify_package(&p, password, check)?;
        check()?;
        let now = if self.base.join("ACTIVE.json").exists() {
            Some(read_small(&self.base.join("ACTIVE.json"), 1024)?)
        } else {
            None
        };
        if prior != now {
            return Err(Error::new("CONFLICT"));
        }
        let active_bytes = encoded(&a)?;
        io::atomic_json(&self.base.join("ACTIVE.json"), &active_bytes)?;
        self.active_bytes = Some(active_bytes);
        self.lock();
        self.active = Some(a);
        self.unlock(password, check)
    }
}
/// This plan contains ciphertext handles and opaque bookkeeping only, no keys/catalog.
pub struct BackupPlan {
    head: Vec<u8>,
    pub vault_id: String,
    pub snapshot: String,
    files: Vec<(String, File)>,
    _pins: Vec<File>,
}
fn copy_verified(source: &mut File, dest: &Path, check: &impl Fn() -> Result<()>) -> Result<()> {
    let mut out = new_file(dest)?;
    let mut b = vec![0; CHUNK];
    let mut digest = Sha256::new();
    let mut size = 0u64;
    loop {
        check()?;
        let n = source.read(&mut b)?;
        if n == 0 {
            break;
        }
        out.write_all(&b[..n])?;
        digest.update(&b[..n]);
        size += n as u64;
    }
    out.sync_all()?;
    drop(out);
    let mut verify = open_read(dest)?;
    let mut dh = Sha256::new();
    let mut ds = 0u64;
    loop {
        check()?;
        let n = verify.read(&mut b)?;
        if n == 0 {
            break;
        }
        dh.update(&b[..n]);
        ds += n as u64;
    }
    if size != ds || digest.finalize() != dh.finalize() {
        return Err(Error::new("READBACK_FAILED"));
    }
    Ok(())
}
impl BackupPlan {
    pub fn duplicate(&self) -> Result<Self> {
        Ok(Self {
            head: self.head.clone(),
            vault_id: self.vault_id.clone(),
            snapshot: self.snapshot.clone(),
            files: self
                .files
                .iter()
                .map(|(name, f)| Ok((name.clone(), f.try_clone()?)))
                .collect::<Result<Vec<_>>>()?,
            _pins: self
                ._pins
                .iter()
                .map(|f| f.try_clone().map_err(Into::into))
                .collect::<Result<Vec<_>>>()?,
        })
    }
    pub fn copy_to(
        mut self,
        destination: &Path,
        check: &impl Fn() -> Result<()>,
    ) -> Result<PathBuf> {
        let destination = io::user_path(destination)?;
        let _pins = io::pin_directory(&destination)?;
        let required = self
            .files
            .iter()
            .try_fold(65536u64, |size, (_, f)| -> Result<u64> {
                size.checked_add(f.metadata()?.len())
                    .ok_or(Error::new("LIMIT_EXCEEDED"))
            })?;
        if fs2::available_space(&destination)? < required {
            return Err(Error::new("SPACE_REQUIRED"));
        }
        let suffix = id();
        let part = destination.join(format!("file-safe-incomplete-{suffix}"));
        directory(&part)?;
        for d in ["keys", "catalogs", "objects"] {
            directory(&part.join(d))?;
        }
        for (name, f) in &mut self.files {
            use std::io::{Seek, SeekFrom};
            f.seek(SeekFrom::Start(0))?;
            copy_verified(f, &part.join(name), check)?;
        }
        immutable(&part.join("HEAD.json"), &self.head)?;
        check()?;
        let final_path = destination.join(format!(
            "file-safe-{}-{}-{suffix}",
            self.vault_id,
            chrono::Utc::now().format("%Y%m%dT%H%M%SZ")
        ));
        #[cfg(windows)]
        io::replace(&part, &final_path, None, true)?;
        #[cfg(not(windows))]
        {
            if final_path.exists() {
                return Err(Error::new("CONFLICT"));
            }
            fs::rename(&part, &final_path)?;
            File::open(&destination)?.sync_all()?;
        }
        Ok(final_path)
    }
}
