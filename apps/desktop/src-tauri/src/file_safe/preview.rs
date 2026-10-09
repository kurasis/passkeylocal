//! One selected authenticated TXT version, no plaintext file or parser fallback.
use super::{
    format::{random, raw_id},
    manager::SafeManager,
};
use crate::storage::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
#[derive(Default)]
pub(super) struct State {
    active: Option<String>,
    cancelled: VecDeque<String>,
}
#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Read {
        token: String,
        snapshot: String,
        file: String,
        version: Option<String>,
        request_id: String,
    },
    Cancel {
        token: String,
        request_id: String,
    },
}
#[derive(Serialize)]
pub struct Response {
    pub request_id: String,
    pub text: String,
}
impl SafeManager {
    pub fn preview_cancel(&self, token: &str, request: &str) -> Result<()> {
        self.check(token)?;
        raw_id(request)?;
        let mut state = self
            .preview_state
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?;
        if state.active.as_deref() == Some(request) {
            state.active = None;
        }
        if !state.cancelled.iter().any(|id| id == request) {
            state.cancelled.push_back(request.to_owned());
        }
        while state.cancelled.len() > 100 {
            state.cancelled.pop_front();
        }
        Ok(())
    }
    pub fn preview_begin(&self, token: &str, request: &str) -> Result<()> {
        self.check(token)?;
        raw_id(request)?;
        let mut state = self
            .preview_state
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?;
        if state.cancelled.iter().any(|id| id == request) {
            return Err(Error::new("CANCELLED"));
        }
        if state.active.is_some() {
            return Err(Error::new("BUSY"));
        }
        state.active = Some(request.to_owned());
        Ok(())
    }
    pub fn preview_text(
        &self,
        token: &str,
        snapshot: &str,
        file: &str,
        version: Option<&str>,
        request: &str,
    ) -> Result<Response> {
        struct Clear<'a>(&'a SafeManager, &'a str);
        impl Drop for Clear<'_> {
            fn drop(&mut self) {
                if let Ok(mut state) = self.0.preview_state.lock() {
                    if state.active.as_deref() == Some(self.1) {
                        state.active = None;
                    }
                }
            }
        }
        let _clear = Clear(self, request);
        raw_id(snapshot)?;
        raw_id(file)?;
        if let Some(version) = version {
            raw_id(version)?;
        }
        let _admit = self.admit()?;
        self.session(token, |store, epoch_check| {
            let check = || {
                epoch_check()?;
                let state = self
                    .preview_state
                    .lock()
                    .map_err(|_| Error::new("UNAVAILABLE"))?;
                if state.active.as_deref() != Some(request) {
                    return Err(Error::new("CANCELLED"));
                }
                Ok(())
            };
            check()?;
            let bytes = store.text_input(snapshot, file, version, &check)?;
            #[cfg(windows)]
            {
                let executable = std::env::current_exe()?
                    .parent()
                    .ok_or(Error::new("UNAVAILABLE"))?
                    .join("passkey-text-worker.exe");
                crate::filesystem::reject_links(&executable)?;
                let text =
                    passkey_text_preview::windows::run(&executable, &bytes, random::<16>(), || {
                        check().is_ok()
                    })
                    .map_err(|error| {
                        Error::new(match error {
                            passkey_text_preview::Error::Unsupported => "PREVIEW_UNSUPPORTED",
                            passkey_text_preview::Error::Limit => "LIMIT_EXCEEDED",
                            passkey_text_preview::Error::Cancelled => "CANCELLED",
                            passkey_text_preview::Error::Timeout => "PREVIEW_TIMEOUT",
                            _ => "PREVIEW_ISOLATION",
                        })
                    })?;
                check()?;
                Ok(Response {
                    request_id: request.to_owned(),
                    text: text.to_string(),
                })
            }
            #[cfg(not(windows))]
            {
                let _ = bytes;
                let _ = random::<16>;
                Err(Error::new("PREVIEW_ISOLATION"))
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancelled_admission_and_stale_sessions_cannot_start_a_preview() {
        let temp = tempfile::tempdir().unwrap();
        let manager = SafeManager::open(temp.path()).unwrap();
        let token = manager
            .access("synthetic password".to_owned(), true)
            .unwrap();
        let cancelled = super::super::format::id();
        let active = super::super::format::id();
        manager.preview_cancel(&token, &cancelled).unwrap();
        assert_eq!(
            manager.preview_begin(&token, &cancelled).unwrap_err().code,
            "CANCELLED"
        );
        manager.preview_begin(&token, &active).unwrap();
        assert_eq!(
            manager
                .preview_begin(&token, &super::super::format::id())
                .unwrap_err()
                .code,
            "BUSY"
        );
        manager.preview_cancel(&token, &active).unwrap();
        let fresh = super::super::format::id();
        manager.preview_begin(&token, &fresh).unwrap();
        manager.lock();
        assert_eq!(
            manager
                .preview_begin(&token, &super::super::format::id())
                .unwrap_err()
                .code,
            "LOCKED"
        );
        let token = manager
            .access("synthetic password".to_owned(), false)
            .unwrap();
        manager
            .preview_begin(&token, &super::super::format::id())
            .unwrap();
    }
}
