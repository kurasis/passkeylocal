//! Root-key enrollment stays native and is independent of the KDBX worker.
use super::manager::SafeManager;
use crate::{
    hello::enrollment::{Action, Binding, Manager, Mode, Reply, Status},
    storage::{Error, Result},
};
use serde::{Deserialize, Serialize};
use std::{sync::atomic::Ordering, time::Instant};
use zeroize::{Zeroize, Zeroizing};

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Request {
    Status {},
    Enroll {
        token: String,
        password: String,
        mode: Mode,
    },
    Unlock {
        expected_generation: String,
    },
    Revoke {
        expected_generation: String,
    },
}
impl Drop for Request {
    fn drop(&mut self) {
        if let Self::Enroll { password, .. } = self {
            password.zeroize();
        }
    }
}
#[derive(Serialize, Debug)]
pub struct Response {
    pub status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}
type Context<'a> = dyn Fn() -> Result<(Binding, i64)> + 'a;
impl SafeManager {
    pub(super) fn invalidate_hello(&self) -> Result<()> {
        self.hello_serial.fetch_add(1, Ordering::SeqCst);
        self.hello
            .try_lock()
            .map_err(|_| Error::new("BUSY"))?
            .invalidate(&self.hello_root)
    }
    pub(super) fn hello_with(
        &self,
        request: &Request,
        run: &mut impl FnMut(
            &mut Manager,
            &(dyn Fn() -> bool + Sync),
            &Context<'_>,
            &Action,
        ) -> Result<Reply>,
    ) -> Result<Response> {
        if matches!(request, Request::Status {}) {
            let epoch = self.generation();
            let current = || self.generation() == epoch;
            let context = || {
                if !current() {
                    return Err(Error::new("STALE"));
                }
                let binding = self
                    .store
                    .try_lock()
                    .map_err(|_| Error::new("BUSY"))?
                    .hello_binding()?;
                Ok((binding, chrono::Utc::now().timestamp_millis()))
            };
            let reply = run(
                &mut *self.hello.try_lock().map_err(|_| Error::new("BUSY"))?,
                &current,
                &context,
                &Action::Status {},
            )?;
            return Ok(Response {
                status: reply.status.clone(),
                token: None,
            });
        }
        // Admission serializes Hello against create/import/export/rotation/restore.
        let _admit = self.admit()?;
        let observed = match request {
            Request::Unlock {
                expected_generation,
            }
            | Request::Revoke {
                expected_generation,
            } => {
                let epoch = expected_generation
                    .parse::<u64>()
                    .map_err(|_| Error::new("INVALID_STATE"))?;
                if epoch.to_string() != *expected_generation || self.generation() != epoch {
                    return Err(Error::new("STALE"));
                }
                epoch
            }
            Request::Enroll { token, .. } => {
                self.check(token)?;
                self.generation()
            }
            Request::Status {} => unreachable!(),
        };
        let epoch = if matches!(request, Request::Unlock { .. }) {
            let epoch = self.begin_revocation(Some(observed))?;
            self.dispose_locked();
            epoch
        } else {
            observed
        };
        if matches!(request, Request::Revoke { .. }) {
            self.hello_serial.fetch_add(1, Ordering::SeqCst);
        }
        let serial = self.hello_serial.load(Ordering::SeqCst);
        let current = || {
            self.generation() == epoch
                && self.hello_serial.load(Ordering::SeqCst) == serial
                && match request {
                    Request::Enroll { token, .. } => self.check(token).is_ok(),
                    _ => true,
                }
        };
        let check = || {
            if current() {
                Ok(())
            } else {
                Err(Error::new("STALE"))
            }
        };
        let context = || {
            check()?;
            let binding = self
                .store
                .try_lock()
                .map_err(|_| Error::new("BUSY"))?
                .hello_binding()?;
            Ok((binding, chrono::Utc::now().timestamp_millis()))
        };
        let action = match request {
            Request::Enroll { password, mode, .. } => {
                if password.len() > 1024 {
                    return Err(Error::new("INVALID_INPUT"));
                }
                let (binding, root) = self
                    .store
                    .try_lock()
                    .map_err(|_| Error::new("BUSY"))?
                    .verified_hello_root(password.as_bytes())?;
                check()?;
                Action::Enroll {
                    mode: *mode,
                    generation: binding.generation,
                    sha256: binding.sha256,
                    component: *root,
                }
            }
            Request::Unlock { .. } => Action::Unlock {},
            Request::Revoke { .. } => Action::Revoke {},
            Request::Status {} => unreachable!(),
        };
        let reply = run(
            &mut *self.hello.try_lock().map_err(|_| Error::new("BUSY"))?,
            &current,
            &context,
            &action,
        )?;
        check()?;
        let token = if matches!(request, Request::Unlock { .. }) {
            let secret = reply
                .component
                .as_ref()
                .ok_or(Error::new("INVALID_STATE"))?;
            let root = Zeroizing::new(
                <[u8; 32]>::try_from(secret.as_slice()).map_err(|_| Error::new("INVALID_STATE"))?,
            );
            let binding = reply.binding.as_ref().ok_or(Error::new("INVALID_STATE"))?;
            let mut store = self.store.try_lock().map_err(|_| Error::new("BUSY"))?;
            if let Err(e) = store.unlock_with_root(root, binding, &check) {
                store.lock();
                return Err(e);
            }
            let mut active = self.active.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
            if check().is_err() {
                store.lock();
                return Err(Error::new("STALE"));
            }
            let token = super::format::id();
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
            self.queue_backup(&store);
            Some(token)
        } else {
            None
        };
        // The root/component never appears in a serialized file-safe response.
        Ok(Response {
            status: reply.status.clone(),
            token,
        })
    }
    #[cfg(windows)]
    pub fn hello_run(&self, hwnd: usize, request: &Request) -> Result<Response> {
        self.hello_with(request, &mut |manager, current, context, action| {
            manager.run(&self.hello_root, hwnd, current, context, action)
        })
    }
}

#[cfg(test)]
mod tests;
