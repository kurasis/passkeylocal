//! Microsoft Passport CNG capability experiment using maintained SDK bindings.
//! No OS/account Hello keys are opened, enumerated or changed.
use super::{exercise, Failure, Outcome, Provider, Report, Stage};
use crate::storage::{Error, Result};
use ::windows::Win32::{
    Foundation::{NTE_BAD_KEYSET, NTE_PERM, NTE_SILENT_CONTEXT, NTE_USER_CANCELLED},
    Security::Cryptography::*,
};
use std::sync::Mutex;
use windows_core::{w, PCWSTR};
use zeroize::Zeroizing;

// Provider-specific property used by existing Passport CNG clients. It is not
// present in the current public ncrypt.h. It must set AND read back; no alias,
// guessed fallback or supported-policy claim when the provider rejects it.
const CACHE_TYPE: PCWSTR = w!("NgcCacheType");
static PENDING_DELETE: Mutex<Option<Vec<u16>>> = Mutex::new(None);

struct Handle(usize);
impl Drop for Handle {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe {
                let _ = NCryptFreeObject(NCRYPT_HANDLE(self.0));
            }
        }
    }
}
struct Probe {
    provider: Handle,
    key: Handle,
    name: Vec<u16>,
    hwnd: usize,
    secret: Zeroizing<[u8; 32]>,
    ciphertext: Vec<u8>,
}
fn failed(error: windows_core::Error) -> Failure {
    Failure {
        status: if error.code() == NTE_USER_CANCELLED {
            Outcome::Cancelled
        } else {
            Outcome::Failed
        },
        code: Some(error.code().0 as u32),
        operation: None,
    }
}
impl Probe {
    fn delete_pending(&self) -> std::result::Result<(), Failure> {
        let mut pending = PENDING_DELETE.lock().map_err(|_| Failure::failed())?;
        if let Some(name) = pending.as_ref() {
            let mut provider = NCRYPT_PROV_HANDLE(0);
            unsafe { NCryptOpenStorageProvider(&mut provider, MS_NGC_KEY_STORAGE_PROVIDER, 0) }
                .map_err(failed)?;
            let _provider = Handle(provider.0);
            let mut key = NCRYPT_KEY_HANDLE(0);
            unsafe {
                match NCryptOpenKey(
                    provider,
                    &mut key,
                    PCWSTR(name.as_ptr()),
                    CERT_KEY_SPEC(0),
                    NCRYPT_SILENT_FLAG,
                ) {
                    Ok(()) => {
                        let mut owned = Handle(key.0);
                        NCryptDeleteKey(key, NCRYPT_SILENT_FLAG.0).map_err(failed)?;
                        owned.0 = 0;
                    }
                    Err(error) if error.code() == NTE_BAD_KEYSET => {}
                    Err(error) => return Err(failed(error)),
                }
            }
            *pending = None;
        }
        Ok(())
    }
    fn set(&self, property: PCWSTR, bytes: &[u8]) -> std::result::Result<(), Failure> {
        unsafe { NCryptSetProperty(NCRYPT_HANDLE(self.key.0), property, bytes, NCRYPT_FLAGS(0)) }
            .map_err(failed)
    }
    fn number(&self, property: PCWSTR) -> std::result::Result<u32, Failure> {
        let mut bytes = [0; 4];
        let mut length = 0;
        unsafe {
            NCryptGetProperty(
                NCRYPT_HANDLE(self.key.0),
                property,
                Some(&mut bytes),
                &mut length,
                windows::Win32::Security::OBJECT_SECURITY_INFORMATION(0),
            )
        }
        .map_err(failed)?;
        if length != 4 {
            return Err(Failure::failed());
        }
        Ok(u32::from_le_bytes(bytes))
    }
    fn open(&self) -> std::result::Result<Handle, Failure> {
        let mut key = NCRYPT_KEY_HANDLE(0);
        unsafe {
            NCryptOpenKey(
                NCRYPT_PROV_HANDLE(self.provider.0),
                &mut key,
                PCWSTR(self.name.as_ptr()),
                CERT_KEY_SPEC(0),
                NCRYPT_SILENT_FLAG,
            )
        }
        .map_err(failed)?;
        Ok(Handle(key.0))
    }
    fn context(&self, key: &Handle) -> std::result::Result<(), Failure> {
        let message: Vec<u8> =
            "PassKey Local: decrypt a test secret only. / Расшифровка тестового ключа."
                .encode_utf16()
                .chain(Some(0))
                .flat_map(u16::to_le_bytes)
                .collect();
        unsafe {
            NCryptSetProperty(
                NCRYPT_HANDLE(key.0),
                NCRYPT_WINDOW_HANDLE_PROPERTY,
                &self.hwnd.to_le_bytes(),
                NCRYPT_FLAGS(0),
            )
            .map_err(failed)?;
            NCryptSetProperty(
                NCRYPT_HANDLE(key.0),
                NCRYPT_USE_CONTEXT_PROPERTY,
                &message,
                NCRYPT_FLAGS(0),
            )
            .map_err(failed)?;
        }
        Ok(())
    }
    fn padding() -> BCRYPT_OAEP_PADDING_INFO {
        BCRYPT_OAEP_PADDING_INFO {
            pszAlgId: BCRYPT_SHA256_ALGORITHM,
            ..Default::default()
        }
    }
    fn decrypt(&self, silent: bool) -> std::result::Result<(), Failure> {
        let key = self.open()?;
        // Check stored policy again on the reopened key; a handle flag alone
        // is not a durable authorization policy. No secret key leaves CNG.
        let mut cache = [0; 4];
        let mut length = 0;
        unsafe {
            NCryptGetProperty(
                NCRYPT_HANDLE(key.0),
                CACHE_TYPE,
                Some(&mut cache),
                &mut length,
                windows::Win32::Security::OBJECT_SECURITY_INFORMATION(0),
            )
        }
        .map_err(failed)?;
        if length != 4 || u32::from_le_bytes(cache) != 1 {
            return Err(Failure::failed());
        }
        if !silent {
            self.context(&key)?;
            unsafe {
                NCryptSetProperty(
                    NCRYPT_HANDLE(key.0),
                    NCRYPT_PIN_CACHE_IS_GESTURE_REQUIRED_PROPERTY,
                    &NCRYPT_PIN_CACHE_REQUIRE_GESTURE_FLAG.to_le_bytes(),
                    NCRYPT_FLAGS(0),
                )
            }
            .map_err(failed)?;
        }
        // Use an actual output buffer. A size-only query can succeed without
        // authorizing a private-key operation and is not an unwrap proof.
        let padding = Self::padding();
        let mut plaintext = Zeroizing::new([0u8; 256]);
        let mut actual = 0;
        let flags = if silent {
            NCRYPT_PAD_OAEP_FLAG | NCRYPT_SILENT_FLAG
        } else {
            NCRYPT_PAD_OAEP_FLAG
        };
        let result = unsafe {
            NCryptDecrypt(
                NCRYPT_KEY_HANDLE(key.0),
                Some(&self.ciphertext),
                Some((&padding as *const BCRYPT_OAEP_PADDING_INFO).cast()),
                Some(plaintext.as_mut_slice()),
                &mut actual,
                flags,
            )
        };
        if silent {
            return match result {
                Err(error) if error.code() == NTE_SILENT_CONTEXT => Ok(()),
                Err(error) => Err(failed(error)),
                Ok(()) => Err(Failure::failed()),
            };
        }
        result.map_err(failed)?;
        if actual != 32 || !libsodium_rs::utils::memcmp(&plaintext[..32], self.secret.as_slice()) {
            return Err(Failure::failed());
        }
        Ok(())
    }
    fn export_denied(&self) -> std::result::Result<(), Failure> {
        for format in [
            BCRYPT_RSAPRIVATE_BLOB,
            BCRYPT_RSAFULLPRIVATE_BLOB,
            NCRYPT_PKCS8_PRIVATE_KEY_BLOB,
        ] {
            // Bounded real buffer; unsupported format/errors are not promoted
            // to evidence of non-exportability. Only NTE_PERM is accepted.
            let mut output = Zeroizing::new([0u8; 16_384]);
            let mut actual = 0;
            let result = unsafe {
                NCryptExportKey(
                    NCRYPT_KEY_HANDLE(self.key.0),
                    None,
                    format,
                    None,
                    Some(output.as_mut_slice()),
                    &mut actual,
                    NCRYPT_SILENT_FLAG,
                )
            };
            match result {
                Err(error) if error.code() == NTE_PERM => {}
                Err(error) => return Err(failed(error)),
                Ok(()) => return Err(Failure::failed()),
            }
        }
        Ok(())
    }
}
impl Provider for Probe {
    fn step(&mut self, stage: Stage) -> std::result::Result<(), Failure> {
        match stage {
            Stage::HelloConfiguration => {
                if crate::hello::diagnostics::check()["helloConfiguration"] != "available" {
                    return Err(Failure::failed());
                }
            }
            Stage::ProviderOpen => {
                let mut provider = NCRYPT_PROV_HANDLE(0);
                unsafe { NCryptOpenStorageProvider(&mut provider, MS_NGC_KEY_STORAGE_PROVIDER, 0) }
                    .map_err(failed)?;
                self.provider = Handle(provider.0);
                // Retry only the exact app-created key whose deletion failed
                // in this process. Never enumerate or delete OS-owned keys.
                self.delete_pending()?;
            }
            Stage::KeyCreate => {
                let mut key = NCRYPT_KEY_HANDLE(0);
                unsafe {
                    NCryptCreatePersistedKey(
                        NCRYPT_PROV_HANDLE(self.provider.0),
                        &mut key,
                        BCRYPT_RSA_ALGORITHM,
                        PCWSTR(self.name.as_ptr()),
                        CERT_KEY_SPEC(0),
                        NCRYPT_FLAGS(0),
                    )
                }
                .map_err(failed)?;
                self.key = Handle(key.0);
            }
            Stage::KeyPolicy => {
                self.set(NCRYPT_LENGTH_PROPERTY, &2048u32.to_le_bytes())
                    .map_err(|e| e.at("set-rsa-length"))?;
                self.set(
                    NCRYPT_KEY_USAGE_PROPERTY,
                    &NCRYPT_ALLOW_DECRYPT_FLAG.to_le_bytes(),
                )
                .map_err(|e| e.at("set-decrypt-only-usage"))?;
                self.set(NCRYPT_EXPORT_POLICY_PROPERTY, &0u32.to_le_bytes())
                    .map_err(|e| e.at("set-no-export-policy"))?;
                self.set(CACHE_TYPE, &1u32.to_le_bytes())
                    .map_err(|e| e.at("set-mandatory-authorization-policy"))?;
                self.context(&self.key)
                    .map_err(|e| e.at("set-owned-window-context"))?;
                unsafe { NCryptFinalizeKey(NCRYPT_KEY_HANDLE(self.key.0), NCRYPT_FLAGS(0)) }
                    .map_err(|e| failed(e).at("finalize-test-key"))?;
            }
            Stage::PolicyReadback => {
                if self.number(NCRYPT_LENGTH_PROPERTY)? != 2048
                    || self.number(NCRYPT_KEY_USAGE_PROPERTY)? != NCRYPT_ALLOW_DECRYPT_FLAG
                    || self.number(NCRYPT_EXPORT_POLICY_PROPERTY)? != 0
                    || self.number(CACHE_TYPE)? != 1
                {
                    return Err(Failure::failed());
                }
            }
            Stage::PublicWrap => {
                let padding = Self::padding();
                let mut ciphertext = vec![0; 256];
                let mut actual = 0;
                unsafe {
                    NCryptEncrypt(
                        NCRYPT_KEY_HANDLE(self.key.0),
                        Some(self.secret.as_slice()),
                        Some((&padding as *const BCRYPT_OAEP_PADDING_INFO).cast()),
                        Some(&mut ciphertext),
                        &mut actual,
                        NCRYPT_PAD_OAEP_FLAG | NCRYPT_SILENT_FLAG,
                    )
                }
                .map_err(failed)?;
                if actual != 256 {
                    return Err(Failure::failed());
                }
                self.ciphertext = ciphertext;
            }
            Stage::PrivateExport => self.export_denied()?,
            Stage::SilentBefore | Stage::SilentAfterFirst | Stage::SilentAfterSecond => {
                self.decrypt(true)?
            }
            Stage::UnwrapFirst | Stage::UnwrapSecond => self.decrypt(false)?,
            Stage::TestKeyDelete => return Err(Failure::failed()),
        }
        Ok(())
    }
    fn cleanup(&mut self) -> std::result::Result<(), Failure> {
        if self.key.0 == 0 {
            // Cleanup is allowed even if Hello became unavailable. Do not
            // report deletion success while a previous app key remains.
            return self.delete_pending();
        }
        let result =
            unsafe { NCryptDeleteKey(NCRYPT_KEY_HANDLE(self.key.0), NCRYPT_SILENT_FLAG.0) };
        match result {
            Ok(()) => {
                self.key.0 = 0;
                Ok(())
            }
            Err(error) => {
                if self
                    .open()
                    .is_err_and(|error| error.code == Some(NTE_BAD_KEYSET.0 as u32))
                {
                    // Failure before finalization may leave only a live
                    // handle. Confirm the named persisted key is absent.
                    self.key = Handle(0);
                    return Ok(());
                }
                if let Ok(mut pending) = PENDING_DELETE.lock() {
                    *pending = Some(self.name.clone());
                }
                Err(failed(error))
            }
        }
    }
}

pub fn run(hwnd: usize, current: impl Fn() -> bool) -> Result<Report> {
    let _attempt = crate::hello::Attempt::begin()?;
    libsodium_rs::ensure_init().map_err(|_| Error::new("UNAVAILABLE"))?;
    let mut secret = Zeroizing::new([0u8; 32]);
    libsodium_rs::random::fill_bytes(secret.as_mut_slice());
    let name = format!("PassKeyLocal.Proof.v1.{}", uuid::Uuid::new_v4())
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let mut probe = Probe {
        provider: Handle(0),
        key: Handle(0),
        name,
        hwnd,
        secret,
        ciphertext: Vec::new(),
    };
    Ok(exercise(&mut probe, current))
}
