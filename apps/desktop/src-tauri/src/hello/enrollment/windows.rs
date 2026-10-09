use super::*;
use crate::hello::{
    prf::windows::combined::Credential,
    proof::{Failure, Outcome},
    tpm::windows::combined::Key,
};
fn mapped(f: Failure) -> Error {
    Error::new(match f.status {
        Outcome::Cancelled => "HELLO_CANCELLED",
        Outcome::Interrupted => "STALE",
        _ => "HELLO_UNAVAILABLE",
    })
}
pub(crate) struct Native<'a> {
    hwnd: usize,
    current: &'a (dyn Fn() -> bool + Sync),
    credential: Option<Credential<'a>>,
    key: Option<Key<'a>>,
}
impl<'a> Native<'a> {
    pub(crate) fn new(hwnd: usize, current: &'a (dyn Fn() -> bool + Sync)) -> Self {
        Self {
            hwnd,
            current,
            credential: None,
            key: None,
        }
    }
    fn configure(&mut self, h: &Header) {
        let create = if h.purpose().expect("validated header") == Purpose::Vault {
            Credential::enrollment
        } else {
            Credential::file_safe
        };
        self.credential = Some(create(self.hwnd, self.current, h.salt, h.user()));
        self.key = Some(Key::new(&h.key_name(), self.current));
    }
}
impl Protection for Native<'_> {
    fn create(&mut self, h: &mut Header) -> Result<Zeroizing<[u8; 32]>> {
        self.configure(h);
        self.credential
            .as_mut()
            .unwrap()
            .initialize()
            .map_err(mapped)?;
        (h.public, h.name) = self.key.as_mut().unwrap().prepare().map_err(mapped)?;
        let (id, prf) = self.credential.as_mut().unwrap().create().map_err(mapped)?;
        h.credential = id;
        Ok(prf)
    }
    fn reopen(&mut self, h: &Header) -> Result<()> {
        self.configure(h);
        self.key
            .as_mut()
            .unwrap()
            .reopen(&h.public, &h.name)
            .map_err(mapped)?;
        self.credential
            .as_mut()
            .unwrap()
            .reopen(&h.credential)
            .map_err(mapped)
    }
    fn authorize(&mut self) -> Result<Zeroizing<[u8; 32]>> {
        self.credential
            .as_mut()
            .ok_or_else(invalid)?
            .authorize()
            .map_err(mapped)
    }
    fn wrap(&mut self, c: &[u8; 32]) -> Result<Vec<u8>> {
        self.key
            .as_mut()
            .ok_or_else(invalid)?
            .wrap(c)
            .map_err(mapped)
    }
    fn unwrap(&mut self, c: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
        self.key
            .as_mut()
            .ok_or_else(invalid)?
            .unwrap(c)
            .map_err(mapped)
    }
    fn delete(&mut self, h: &Header) -> Result<()> {
        self.configure(h);
        let a = self
            .credential
            .as_mut()
            .ok_or_else(invalid)?
            .cleanup()
            .map_err(mapped);
        let b = self
            .key
            .as_mut()
            .ok_or_else(invalid)?
            .cleanup()
            .map_err(mapped);
        a?;
        b
    }
}
impl Manager {
    pub fn run(
        &mut self,
        root: &Path,
        hwnd: usize,
        current: &(dyn Fn() -> bool + Sync),
        context: &dyn Fn() -> Result<(Binding, i64)>,
        action: &Action,
    ) -> Result<Reply> {
        let _attempt = crate::hello::Attempt::begin()?;
        self.run_with(root, &mut Native::new(hwnd, current), context, action)
    }
}
