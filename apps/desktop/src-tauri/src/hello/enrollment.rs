//! Application-owned vault envelopes. No plaintext or password verifier is persisted.
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
#[cfg(test)]
pub(crate) mod tests;
#[cfg(windows)]
pub mod windows;
pub fn credential_write(operation: &str, args: &serde_json::Value) -> bool {
    operation == "restoreBlob"
        || operation == "commit"
            && (args.get("passwordEpoch").is_some_and(|v| !v.is_null())
                || args.get("confirmedReplacement") == Some(&serde_json::Value::Bool(true)))
}
const DOMAIN: &str = "PassKeyLocal.VaultHello.v1";
const MAX_RECORD: usize = 16384;
#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub(crate) enum Purpose {
    #[default]
    Vault,
    FileSafe,
}
impl Purpose {
    fn domain(self) -> &'static str {
        match self {
            Self::Vault => DOMAIN,
            Self::FileSafe => "PassKeyLocal.FileSafeHello.v1",
        }
    }
    fn directory(self) -> &'static str {
        match self {
            Self::Vault => "hello-vault",
            Self::FileSafe => "hello-file-safe",
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SafeBinding {
    pub store_id: String,
    pub key_epoch_id: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Binding {
    pub vault: String,
    pub password_epoch: u64,
    pub generation: u64,
    pub sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub safe: Option<SafeBinding>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Mode {
    Session,
    Remember6,
    Remember12,
    Remember24,
}
impl Mode {
    fn duration(self) -> i64 {
        (match self {
            Self::Remember6 => 6,
            Self::Remember12 => 12,
            _ => 24,
        }) * 3_600_000
    }
}
#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Action {
    Status {},
    Enroll {
        mode: Mode,
        generation: u64,
        sha256: String,
        component: [u8; 32],
    },
    Unlock {},
    Revoke {},
}
impl Drop for Action {
    fn drop(&mut self) {
        if let Self::Enroll { component, .. } = self {
            use zeroize::Zeroize;
            component.zeroize()
        }
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Header {
    domain: String,
    version: u32,
    id: String,
    vault: String,
    epoch: u64,
    mode: Mode,
    created: i64,
    expires: i64,
    salt: [u8; 32],
    credential: Vec<u8>,
    public: Vec<u8>,
    name: Vec<u8>,
    // Omitted for Vault: its existing serialized AAD remains byte compatible.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    safe: Option<SafeBinding>,
}
impl Header {
    fn purpose(&self) -> Result<Purpose> {
        match self.domain.as_str() {
            DOMAIN => Ok(Purpose::Vault),
            "PassKeyLocal.FileSafeHello.v1" => Ok(Purpose::FileSafe),
            _ => Err(invalid()),
        }
    }
    fn key_name(&self) -> String {
        let prefix = if self.domain == DOMAIN {
            "PassKeyLocal.VaultHello"
        } else {
            "PassKeyLocal.FileSafeHello"
        };
        format!("{prefix}.{}", self.id)
    }
    fn user(&self) -> [u8; 32] {
        Sha256::digest(format!("{}:{}", self.domain, self.id)).into()
    }
    fn aad(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("fixed metadata")
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    header: Header,
    ready: bool,
    last_seen: i64,
    nonce: [u8; 12],
    ciphertext: Vec<u8>,
}
fn uuid(s: &str) -> bool {
    uuid::Uuid::parse_str(s).is_ok_and(|v| v.get_version_num() == 4 && v.to_string() == s)
}
fn invalid() -> Error {
    Error::new("INVALID_STATE")
}
impl Record {
    fn new(b: &Binding, mode: Mode, now: i64, purpose: Purpose) -> Self {
        let mut salt = [0; 32];
        libsodium_rs::random::fill_bytes(&mut salt);
        Self {
            header: Header {
                domain: purpose.domain().into(),
                version: 1,
                id: uuid::Uuid::new_v4().to_string(),
                vault: b.vault.clone(),
                epoch: b.password_epoch,
                mode,
                created: now,
                expires: now + mode.duration(),
                salt,
                credential: vec![],
                public: vec![],
                name: vec![],
                safe: b.safe.clone(),
            },
            ready: false,
            last_seen: now,
            nonce: [0; 12],
            ciphertext: vec![],
        }
    }
    fn validate(&self) -> Result<()> {
        let h = &self.header;
        let identity = match h.purpose()? {
            Purpose::Vault => uuid(&h.vault) && h.safe.is_none(),
            Purpose::FileSafe => {
                crate::file_safe::format::valid_id(&h.vault)
                    && h.epoch == 0
                    && h.safe.as_ref().is_some_and(|s| {
                        crate::file_safe::format::valid_id(&s.store_id)
                            && crate::file_safe::format::valid_id(&s.key_epoch_id)
                    })
            }
        };
        if !identity
            || h.version != 1
            || !uuid(&h.id)
            || h.created < 0
            || h.expires.checked_sub(h.created) != Some(h.mode.duration())
            || self.last_seen < h.created
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
            return Err(invalid());
        }
        Ok(())
    }
    fn permitted(&self, b: &Binding, now: i64) -> bool {
        self.ready
            && self.header.vault == b.vault
            && self.header.epoch == b.password_epoch
            && self.header.safe == b.safe
            && now >= self.last_seen
            && now >= self.header.created
            && now < self.header.expires
    }
    fn key(&self, prf: &[u8; 32]) -> Result<aes::Key> {
        let mut key = Zeroizing::new([0; 32]);
        hkdf::Hkdf::<Sha256>::new(Some(&self.header.salt), prf)
            .expand(self.header.domain.as_bytes(), key.as_mut_slice())
            .map_err(|_| invalid())?;
        aes::Key::from_bytes(key.as_slice()).map_err(|_| invalid())
    }
    fn seal(&mut self, inner: &[u8], prf: &[u8; 32]) -> Result<()> {
        if inner.len() != 256 {
            return Err(invalid());
        }
        let nonce = aes::Nonce::generate();
        self.nonce.copy_from_slice(nonce.as_ref());
        self.ciphertext = aes::encrypt(inner, Some(&self.header.aad()), &nonce, &self.key(prf)?)
            .map_err(|_| invalid())?;
        Ok(())
    }
    fn open(&self, prf: &[u8; 32]) -> Result<Zeroizing<Vec<u8>>> {
        let inner = Zeroizing::new(
            aes::decrypt(
                &self.ciphertext,
                Some(&self.header.aad()),
                &aes::Nonce::from_bytes(self.nonce),
                &self.key(prf)?,
            )
            .map_err(|_| invalid())?,
        );
        if inner.len() != 256 {
            return Err(invalid());
        }
        Ok(inner)
    }
}
struct Journal {
    path: PathBuf,
    _pins: Vec<fs::File>,
    purpose: Purpose,
}
impl Journal {
    #[cfg(test)]
    fn open(root: &Path) -> Result<Self> {
        Self::for_purpose(root, Purpose::Vault)
    }
    fn for_purpose(root: &Path, purpose: Purpose) -> Result<Self> {
        let root = io::child(root, purpose.directory())?;
        io::reject_links(&root)?;
        fs::create_dir_all(&root)?;
        io::secure_directory(&root)?;
        Ok(Self {
            path: io::child(&root, "enrollment.json")?,
            _pins: io::pin_directory(&root)?,
            purpose,
        })
    }
    fn read(&self) -> Result<Option<Record>> {
        match fs::symlink_metadata(&self.path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
            Ok(_) => {}
        }
        let r: Record = serde_json::from_slice(&io::read(&self.path, MAX_RECORD)?)?;
        r.validate()?;
        if r.header.purpose()? != self.purpose {
            return Err(invalid());
        }
        if r.header.mode == Mode::Session && r.ready {
            return Err(invalid());
        }
        Ok(Some(r))
    }
    fn save(&self, r: &Record) -> Result<()> {
        r.validate()?;
        if r.header.purpose()? != self.purpose {
            return Err(invalid());
        }
        let bytes = serde_json::to_vec(r)?;
        if bytes.len() > MAX_RECORD {
            return Err(invalid());
        }
        io::atomic_json(&self.path, &bytes)
    }
    fn remove(&self) -> Result<()> {
        let bytes = io::read(&self.path, MAX_RECORD)?;
        if io::remove_verified(&self.path, &crate::storage::hash(&bytes))? {
            Ok(())
        } else {
            Err(invalid())
        }
    }
}
// Fixed native objects only. Test doubles exist only under cfg(test).
pub(crate) trait Protection {
    fn create(&mut self, h: &mut Header) -> Result<Zeroizing<[u8; 32]>>;
    fn reopen(&mut self, h: &Header) -> Result<()>;
    fn authorize(&mut self) -> Result<Zeroizing<[u8; 32]>>;
    fn wrap(&mut self, component: &[u8; 32]) -> Result<Vec<u8>>;
    fn unwrap(&mut self, cipher: &[u8]) -> Result<Zeroizing<Vec<u8>>>;
    fn delete(&mut self, header: &Header) -> Result<()>;
}
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub state: &'static str,
    pub mode: Option<Mode>,
    pub expires_at: Option<i64>,
}
impl Status {
    pub(crate) fn off() -> Self {
        Self {
            state: "off",
            mode: None,
            expires_at: None,
        }
    }
}
#[derive(Default)]
pub struct Manager {
    session: Option<Record>,
    purpose: Purpose,
}
impl Manager {
    pub(crate) fn file_safe() -> Self {
        Self {
            session: None,
            purpose: Purpose::FileSafe,
        }
    }
    // Used before root rotation/restore, independent of OS cleanup availability.
    pub(crate) fn invalidate(&mut self, root: &Path) -> Result<()> {
        let j = Journal::for_purpose(root, self.purpose)?;
        if let Some(r) = self.read(&j)? {
            self.invalidate_record(&j, r)?;
        }
        Ok(())
    }
    fn read(&self, j: &Journal) -> Result<Option<Record>> {
        let disk = j.read()?;
        Ok(match (&self.session, disk) {
            (Some(s), Some(d)) if s.header.id == d.header.id && !d.ready => Some(s.clone()),
            (_, d) => d,
        })
    }
    fn persist(&self, j: &Journal, r: &Record) -> Result<()> {
        let mut disk = r.clone();
        if disk.header.mode == Mode::Session {
            disk.ready = false;
            disk.ciphertext.clear();
            disk.nonce = [0; 12];
        }
        j.save(&disk)
    }
    fn revoke(&mut self, j: &Journal, b: &mut impl Protection, mut r: Record) -> Result<()> {
        self.session = None;
        r.ready = false;
        r.ciphertext.clear();
        r.nonce = [0; 12];
        // Durable invalidation precedes deletion. Failed deletion remains retryable.
        j.save(&r)?;
        b.delete(&r.header)
            .map_err(|_| Error::new("HELLO_CLEANUP_REQUIRED"))?;
        j.remove()
    }
    fn invalidate_record(&mut self, j: &Journal, mut r: Record) -> Result<()> {
        self.session = None;
        r.ready = false;
        r.ciphertext.clear();
        r.nonce = [0; 12];
        j.save(&r)
    }
    fn status(&mut self, j: &Journal, binding: &Binding, now: i64) -> Result<Status> {
        let Some(r) = self.read(j)? else {
            return Ok(Status::off());
        };
        let enabled = r.permitted(binding, now);
        let status = Status {
            state: if enabled {
                "enabled"
            } else {
                "cleanup-required"
            },
            mode: Some(r.header.mode),
            expires_at: Some(r.header.expires),
        };
        if !enabled && r.ready {
            self.invalidate_record(j, r)?;
        }
        Ok(status)
    }
    fn enroll(
        &mut self,
        j: &Journal,
        b: &mut impl Protection,
        binding: &Binding,
        mode: Mode,
        component: &[u8; 32],
        context: &dyn Fn() -> Result<(Binding, i64)>,
    ) -> Result<Status> {
        if self.read(j)?.is_some() {
            return Err(Error::new("HELLO_CLEANUP_REQUIRED"));
        }
        let (observed, now) = context()?;
        if &observed != binding {
            return Err(Error::new("CONFLICT"));
        }
        let mut r = Record::new(binding, mode, now, self.purpose);
        j.save(&r)?;
        // Backend object identity is chosen from the durable record, before creation.
        let result = (|| {
            let prf = b.create(&mut r.header)?;
            j.save(&r)?;
            let inner = b.wrap(component)?;
            r.seal(&inner, &prf)?;
            drop(prf);
            let prf = b.authorize()?;
            let inner = r.open(&prf)?;
            drop(prf);
            let recovered = b.unwrap(&inner)?;
            if recovered.len() != 32 || !libsodium_rs::utils::memcmp(&recovered, component) {
                return Err(invalid());
            }
            let (next, time) = context()?;
            if next != *binding || time < now || time >= r.header.expires {
                return Err(Error::new("STALE"));
            }
            r.ready = true;
            r.last_seen = time;
            self.persist(j, &r)?;
            if mode == Mode::Session {
                self.session = Some(r.clone());
            }
            self.status(j, binding, time)
        })();
        if result.is_err() && self.revoke(j, b, r).is_err() {
            return Err(Error::new("HELLO_CLEANUP_REQUIRED"));
        }
        result
    }
    fn unlock(
        &mut self,
        j: &Journal,
        b: &mut impl Protection,
        binding: &Binding,
        context: &dyn Fn() -> Result<(Binding, i64)>,
    ) -> Result<Zeroizing<Vec<u8>>> {
        let mut r = self.read(j)?.ok_or_else(invalid)?;
        let (next, now) = context()?;
        if next != *binding {
            return Err(Error::new("STALE"));
        }
        if !r.permitted(binding, now) {
            self.invalidate_record(j, r)?;
            return Err(Error::new("HELLO_EXPIRED"));
        }
        r.last_seen = now;
        self.persist(j, &r)?;
        if r.header.mode == Mode::Session {
            self.session = Some(r.clone())
        }
        b.reopen(&r.header)?;
        let prf = b.authorize()?;
        let inner = r.open(&prf)?;
        drop(prf);
        let secret = b.unwrap(&inner)?;
        let (next, time) = context()?;
        if secret.len() != 32 || next != *binding {
            return Err(Error::new("STALE"));
        }
        if !r.permitted(binding, time) {
            self.invalidate_record(j, r)?;
            return Err(Error::new("HELLO_EXPIRED"));
        }
        r.last_seen = time;
        self.persist(j, &r)?;
        if r.header.mode == Mode::Session {
            self.session = Some(r)
        }
        Ok(secret)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reply {
    pub status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding: Option<Binding>,
}
impl Drop for Reply {
    fn drop(&mut self) {
        use zeroize::Zeroize;
        if let Some(c) = &mut self.component {
            c.zeroize()
        }
    }
}

impl Manager {
    pub(crate) fn run_with(
        &mut self,
        root: &Path,
        b: &mut impl Protection,
        context: &dyn Fn() -> Result<(Binding, i64)>,
        action: &Action,
    ) -> Result<Reply> {
        libsodium_rs::ensure_init().map_err(|_| Error::new("UNAVAILABLE"))?;
        let j = Journal::for_purpose(root, self.purpose)?;
        if matches!(action, Action::Status {}) && self.read(&j)?.is_none() {
            return Ok(Reply {
                status: Status::off(),
                component: None,
                binding: None,
            });
        }
        if matches!(action, Action::Revoke {}) {
            if let Some(r) = self.read(&j)? {
                self.revoke(&j, b, r)?;
            }
            return Ok(Reply {
                status: Status::off(),
                component: None,
                binding: None,
            });
        }
        let (binding, now) = context()?;
        let mut reply = Reply {
            status: self.status(&j, &binding, now)?,
            component: None,
            binding: None,
        };
        match action {
            Action::Status {} => {}
            Action::Revoke {} => unreachable!(),
            Action::Enroll {
                mode,
                generation,
                sha256,
                component,
            } => {
                if *generation != binding.generation || *sha256 != binding.sha256 {
                    return Err(Error::new("CONFLICT"));
                }
                let mut secret = Zeroizing::new([0; 32]);
                secret.copy_from_slice(component);
                reply.status = self.enroll(&j, b, &binding, *mode, &secret, context)?;
            }
            Action::Unlock {} => {
                reply.component = Some(self.unlock(&j, b, &binding, context)?.to_vec());
                reply.binding = Some(binding);
            }
        }
        Ok(reply)
    }
}
