//! Frozen portable format. All untrusted bounds precede allocation/KDF work.
use crate::storage::{Error, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use hkdf::Hkdf;
use libsodium_rs::{
    crypto_aead::xchacha20poly1305 as aead, crypto_pwhash::argon2id,
    crypto_secretstream::xchacha20poly1305 as stream,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    io::{Read, Write},
};
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

pub const CHUNK: usize = 1_048_576;
pub const MAX_CATALOG: usize = 64 * CHUNK;
pub const MAX_FILE: u64 = 1_099_511_627_776;
pub type RootKey = Zeroizing<[u8; 32]>;
pub fn init() -> Result<()> {
    libsodium_rs::ensure_init().map_err(|_| Error::new("UNAVAILABLE"))
}
pub fn random<const N: usize>() -> [u8; N] {
    let mut value = [0; N];
    libsodium_rs::random::fill_bytes(&mut value);
    value
}
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|v| format!("{v:02x}")).collect()
}
pub fn id() -> String {
    hex(&random::<16>())
}
pub fn valid_id(s: &str) -> bool {
    s.len() == 32
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub fn raw_id(s: &str) -> Result<[u8; 16]> {
    if !valid_id(s) {
        return Err(Error::new("CORRUPT"));
    }
    let mut out = [0; 16];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).map_err(|_| Error::new("CORRUPT"))?;
    }
    Ok(out)
}
pub fn stamp() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
fn valid_stamp(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 24
        && b.iter().enumerate().all(|(i, v)| match i {
            4 | 7 => *v == b'-',
            10 => *v == b'T',
            13 | 16 => *v == b':',
            19 => *v == b'.',
            23 => *v == b'Z',
            _ => v.is_ascii_digit(),
        })
        && &b[..4] != b"0000"
        && &b[17..19] != b"60"
        && chrono::DateTime::parse_from_rfc3339(s).is_ok()
}

fn text(s: &str, max: usize, empty: bool) -> bool {
    (empty || !s.is_empty()) && s.len() <= max && !s.chars().any(char::is_control)
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Head {
    pub format_version: u8,
    pub vault_id: String,
    pub key_epoch_id: String,
    pub snapshot_id: String,
}
impl Head {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > 1024 {
            return Err(Error::new("CORRUPT"));
        }
        let h: Self = serde_json::from_slice(bytes).map_err(|_| Error::new("CORRUPT"))?;
        if h.format_version != 1
            || ![&h.vault_id, &h.key_epoch_id, &h.snapshot_id]
                .into_iter()
                .all(|s| valid_id(s))
        {
            return Err(Error::new("CORRUPT"));
        }
        Ok(h)
    }
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(deny_unknown_fields)]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(deny_unknown_fields)]
pub struct Version {
    pub id: String,
    pub object_id: String,
    pub object_key: String,
    pub plaintext_size: u64,
    pub sha256: String,
    pub created_at: String,
    pub media_hint: String,
}
impl Version {
    pub fn key(&self) -> Result<Zeroizing<Vec<u8>>> {
        let k = Zeroizing::new(
            STANDARD
                .decode(&self.object_key)
                .map_err(|_| Error::new("CORRUPT"))?,
        );
        if k.len() != 32 || STANDARD.encode(&*k) != self.object_key {
            return Err(Error::new("CORRUPT"));
        }
        Ok(k)
    }
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(deny_unknown_fields)]
pub struct SafeFile {
    pub id: String,
    pub folder_id: String,
    pub name: String,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
    pub created_at: String,
    pub modified_at: String,
    pub deleted: bool,
    pub current_version_id: String,
    pub versions: Vec<Version>,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(deny_unknown_fields)]
pub struct Policy {
    pub history_previous_versions: u8,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub schema_version: u8,
    pub vault_id: String,
    pub key_epoch_id: String,
    pub snapshot_id: String,
    pub commit_sequence: u64,
    pub prior_snapshot_id: Option<String>,
    pub folders: Vec<Folder>,
    pub files: Vec<SafeFile>,
    pub policy: Policy,
}
impl Catalog {
    pub fn head(&self) -> Head {
        Head {
            format_version: 1,
            vault_id: self.vault_id.clone(),
            key_epoch_id: self.key_epoch_id.clone(),
            snapshot_id: self.snapshot_id.clone(),
        }
    }
    pub fn validate(&self, head: &Head) -> Result<()> {
        let bad = || Error::new("CORRUPT");
        if self.schema_version != 1
            || self.head() != *head
            || self.commit_sequence == 0
            || self.policy.history_previous_versions != 10
            || self.folders.is_empty()
            || self.folders.len() > 50_000
            || self.files.len() > 50_000
            || self
                .prior_snapshot_id
                .as_ref()
                .is_some_and(|s| !valid_id(s) || s == &self.snapshot_id)
        {
            return Err(bad());
        }
        let mut all = HashSet::new();
        let mut objects = HashSet::new();
        let mut map = HashMap::new();
        let mut roots = 0;
        for f in &self.folders {
            if !valid_id(&f.id)
                || !all.insert(f.id.as_str())
                || !text(&f.name, 255, f.parent_id.is_none())
            {
                return Err(bad());
            }
            if f.parent_id.is_none() {
                roots += 1;
                if !f.name.is_empty() {
                    return Err(bad());
                }
            }
            map.insert(f.id.as_str(), f);
        }
        if roots != 1 {
            return Err(bad());
        }
        for f in &self.folders {
            let mut seen = HashSet::new();
            let mut node = Some(f.id.as_str());
            while let Some(i) = node {
                if seen.len() >= 64 || !seen.insert(i) {
                    return Err(bad());
                }
                let p = map.get(i).ok_or_else(bad)?;
                node = p.parent_id.as_deref();
            }
        }
        let mut count = 0;
        for f in &self.files {
            if !valid_id(&f.id)
                || !all.insert(f.id.as_str())
                || !map.contains_key(f.folder_id.as_str())
                || !text(&f.name, 255, false)
                || f.notes.len() > 4096
                || f.notes.contains('\0')
                || f.tags.len() > 32
                || !valid_stamp(&f.created_at)
                || !valid_stamp(&f.modified_at)
                || f.versions.is_empty()
                || f.versions.len() > 11
            {
                return Err(bad());
            }
            let mut tags = HashSet::new();
            for t in &f.tags {
                if !text(t, 64, false) || !tags.insert(t) {
                    return Err(bad());
                }
            }
            if !f.versions.iter().any(|v| v.id == f.current_version_id) {
                return Err(bad());
            }
            count += f.versions.len();
            if count > 100_000 {
                return Err(bad());
            }
            for v in &f.versions {
                if !valid_id(&v.id)
                    || !all.insert(v.id.as_str())
                    || !valid_id(&v.object_id)
                    || !objects.insert(v.object_id.as_str())
                    || v.plaintext_size > MAX_FILE
                    || v.sha256.len() != 64
                    || !v
                        .sha256
                        .bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                    || !valid_stamp(&v.created_at)
                    || !text(&v.media_hint, 128, true)
                {
                    return Err(bad());
                }
                v.key()?;
            }
        }
        Ok(())
    }
}
pub fn validate_password(password: &[u8]) -> Result<()> {
    if password.is_empty() || password.len() > 1024 || std::str::from_utf8(password).is_err() {
        return Err(Error::new("INVALID_INPUT"));
    }
    Ok(())
}
fn password_key(
    password: &[u8],
    salt: &[u8; 16],
    ops: u64,
    mem: u64,
) -> Result<Zeroizing<Vec<u8>>> {
    validate_password(password)?;
    if !(3..=10).contains(&ops)
        || !(64 * CHUNK as u64..=256 * CHUNK as u64).contains(&mem)
        || !mem.is_multiple_of(CHUNK as u64)
    {
        return Err(Error::new("CORRUPT"));
    }
    argon2id::pwhash(32, password, salt, ops, mem as usize)
        .map(Zeroizing::new)
        .map_err(|_| Error::new("UNAVAILABLE"))
}
pub fn write_key(head: &Head, root: &RootKey, password: &[u8]) -> Result<Vec<u8>> {
    let mut h = b"FVKEY001".to_vec();
    h.extend(raw_id(&head.vault_id)?);
    h.extend(raw_id(&head.key_epoch_id)?);
    h.extend(3u32.to_le_bytes());
    h.extend((64 * CHUNK as u64).to_le_bytes());
    let salt = random::<16>();
    h.extend(salt);
    let nonce = aead::Nonce::generate();
    h.extend(nonce.as_bytes());
    let key = password_key(password, &salt, 3, 64 * CHUNK as u64)?;
    let encrypted = aead::encrypt(
        root.as_ref(),
        Some(&h),
        &nonce,
        &aead::Key::from_bytes(&key).map_err(|_| Error::new("INTERNAL"))?,
    )
    .map_err(|_| Error::new("INTERNAL"))?;
    h.extend(encrypted);
    Ok(h)
}
pub fn read_key(bytes: &[u8], head: &Head, password: &[u8]) -> Result<RootKey> {
    if bytes.len() != 140
        || &bytes[..8] != b"FVKEY001"
        || bytes[8..24] != raw_id(&head.vault_id)?
        || bytes[24..40] != raw_id(&head.key_epoch_id)?
    {
        return Err(Error::new("CORRUPT"));
    }
    let ops = u32::from_le_bytes(bytes[40..44].try_into().unwrap()) as u64;
    let mem = u64::from_le_bytes(bytes[44..52].try_into().unwrap());
    let key = password_key(password, bytes[52..68].try_into().unwrap(), ops, mem)?;
    let clear = Zeroizing::new(
        aead::decrypt(
            &bytes[92..],
            Some(&bytes[..92]),
            &aead::Nonce::from_bytes(bytes[68..92].try_into().unwrap()),
            &aead::Key::from_bytes(&key).map_err(|_| Error::new("INTERNAL"))?,
        )
        .map_err(|_| Error::new("AUTH_FAILED"))?,
    );
    if clear.len() != 32 {
        return Err(Error::new("CORRUPT"));
    }
    Ok(Zeroizing::new(clear.as_slice().try_into().unwrap()))
}
fn catalog_key(root: &RootKey, vault: &str) -> Result<RootKey> {
    let mut out = Zeroizing::new([0; 32]);
    Hkdf::<Sha256>::new(Some(&raw_id(vault)?), root.as_ref())
        .expand(b"file-safe/catalog/v1", out.as_mut())
        .map_err(|_| Error::new("INTERNAL"))?;
    Ok(out)
}
pub fn write_catalog(c: &Catalog, root: &RootKey) -> Result<Vec<u8>> {
    c.validate(&c.head())?;
    let clear = Zeroizing::new(serde_json::to_vec(c).map_err(|_| Error::new("CORRUPT"))?);
    if clear.len() > MAX_CATALOG {
        return Err(Error::new("LIMIT_EXCEEDED"));
    }
    let mut h = b"FVCAT001".to_vec();
    h.extend(raw_id(&c.vault_id)?);
    h.extend(raw_id(&c.key_epoch_id)?);
    h.extend(raw_id(&c.snapshot_id)?);
    let nonce = aead::Nonce::generate();
    h.extend(nonce.as_bytes());
    h.extend((clear.len() as u64 + 16).to_le_bytes());
    let key = catalog_key(root, &c.vault_id)?;
    let ciphertext = aead::encrypt(
        &clear,
        Some(&h),
        &nonce,
        &aead::Key::from_bytes(key.as_ref()).map_err(|_| Error::new("INTERNAL"))?,
    )
    .map_err(|_| Error::new("INTERNAL"))?;
    h.extend(ciphertext);
    Ok(h)
}
pub fn read_catalog(bytes: &[u8], head: &Head, root: &RootKey) -> Result<Catalog> {
    if bytes.len() < 104
        || bytes.len() > MAX_CATALOG + 104
        || &bytes[..8] != b"FVCAT001"
        || bytes[8..24] != raw_id(&head.vault_id)?
        || bytes[24..40] != raw_id(&head.key_epoch_id)?
        || bytes[40..56] != raw_id(&head.snapshot_id)?
    {
        return Err(Error::new("CORRUPT"));
    }
    let len = u64::from_le_bytes(bytes[80..88].try_into().unwrap());
    if len != bytes.len() as u64 - 88 || !(16..=MAX_CATALOG as u64 + 16).contains(&len) {
        return Err(Error::new("CORRUPT"));
    }
    let key = catalog_key(root, &head.vault_id)?;
    let clear = Zeroizing::new(
        aead::decrypt(
            &bytes[88..],
            Some(&bytes[..88]),
            &aead::Nonce::from_bytes(bytes[56..80].try_into().unwrap()),
            &aead::Key::from_bytes(key.as_ref()).map_err(|_| Error::new("INTERNAL"))?,
        )
        .map_err(|_| Error::new("AUTH_FAILED"))?,
    );
    let c: Catalog = serde_json::from_slice(&clear).map_err(|_| Error::new("CORRUPT"))?;
    c.validate(head)?;
    Ok(c)
}
fn frame_ad(h: &[u8], i: u64, len: u32) -> Vec<u8> {
    let mut ad = h.to_vec();
    ad.extend(i.to_le_bytes());
    ad.extend(len.to_le_bytes());
    ad
}
/// Never retains a whole source; cancellation is checked at every frame.
pub fn encrypt_object<R: Read, W: Write>(
    input: &mut R,
    out: &mut W,
    vault: &str,
    object: &str,
    key: &[u8],
    check: &impl Fn() -> Result<()>,
) -> Result<(u64, String)> {
    let (mut state, header) = stream::PushState::init_push(
        &stream::Key::from_bytes(key).map_err(|_| Error::new("CORRUPT"))?,
    )
    .map_err(|_| Error::new("INTERNAL"))?;
    let mut h = b"FVOBJ001".to_vec();
    h.extend(raw_id(vault)?);
    h.extend(raw_id(object)?);
    h.extend(header);
    out.write_all(&h)?;
    let mut buffer = Zeroizing::new(vec![0; CHUNK]);
    let mut hash = Sha256::new();
    let mut size = 0u64;
    let mut i = 0u64;
    loop {
        check()?;
        let mut n = 0;
        while n < CHUNK {
            check()?;
            let got = input.read(&mut buffer[n..])?;
            if got == 0 {
                break;
            }
            n += got;
        }
        size = size
            .checked_add(n as u64)
            .filter(|v| *v <= MAX_FILE)
            .ok_or(Error::new("LIMIT_EXCEEDED"))?;
        hash.update(&buffer[..n]);
        let final_frame = n < CHUNK;
        let len = (n + stream::ABYTES) as u32;
        let cipher = state
            .push(
                &buffer[..n],
                Some(&frame_ad(&h, i, len)),
                if final_frame {
                    stream::TAG_FINAL
                } else {
                    stream::TAG_MESSAGE
                },
            )
            .map_err(|_| Error::new("INTERNAL"))?;
        out.write_all(&len.to_le_bytes())?;
        out.write_all(&cipher)?;
        buffer.as_mut_slice().zeroize();
        i += 1;
        if final_frame {
            break;
        }
    }
    check()?;
    Ok((size, hex(&hash.finalize())))
}
/// Plaintext is streamed only to an explicitly authorized unpublished output.
/// Preview must use whole-object verification before exposing bytes to a parser.
pub fn decrypt_object<R: Read, W: Write>(
    input: &mut R,
    out: &mut W,
    vault: &str,
    v: &Version,
    check: &impl Fn() -> Result<()>,
) -> Result<()> {
    let mut h = [0; 64];
    input.read_exact(&mut h)?;
    if &h[..8] != b"FVOBJ001" || h[8..24] != raw_id(vault)? || h[24..40] != raw_id(&v.object_id)? {
        return Err(Error::new("CORRUPT"));
    }
    let key = v.key()?;
    let mut state = stream::PullState::init_pull(
        h[40..64].try_into().unwrap(),
        &stream::Key::from_bytes(&key).map_err(|_| Error::new("CORRUPT"))?,
    )
    .map_err(|_| Error::new("CORRUPT"))?;
    let mut i = 0;
    let mut size = 0u64;
    let mut hash = Sha256::new();
    loop {
        check()?;
        let mut len = [0; 4];
        input.read_exact(&mut len)?;
        let n = u32::from_le_bytes(len);
        if !(17..=CHUNK as u32 + 17).contains(&n) {
            return Err(Error::new("CORRUPT"));
        }
        let mut cipher = vec![0; n as usize];
        input.read_exact(&mut cipher)?;
        let (clear, tag) = state
            .pull(&cipher, Some(&frame_ad(&h, i, n)))
            .map_err(|_| Error::new("AUTH_FAILED"))?;
        let clear = Zeroizing::new(clear);
        if tag != stream::TAG_FINAL && (tag != stream::TAG_MESSAGE || clear.len() != CHUNK) {
            return Err(Error::new("CORRUPT"));
        }
        size = size
            .checked_add(clear.len() as u64)
            .filter(|s| *s <= v.plaintext_size)
            .ok_or(Error::new("CORRUPT"))?;
        hash.update(&clear);
        out.write_all(&clear)?;
        i += 1;
        if tag == stream::TAG_FINAL {
            let mut trailing = [0; 1];
            if input.read(&mut trailing)? != 0
                || size != v.plaintext_size
                || hex(&hash.finalize()) != v.sha256
            {
                return Err(Error::new("CORRUPT"));
            }
            break;
        }
    }
    check()?;
    Ok(())
}
