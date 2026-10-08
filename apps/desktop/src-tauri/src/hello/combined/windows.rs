use super::*;
use crate::hello::{prf::windows::combined::Credential, tpm::windows::combined::Key};
use std::sync::OnceLock;
struct Native<'a> {
    credential: Credential<'a>,
    key: Key<'a>,
}
impl Backend for Native<'_> {
    fn initialize(&mut self) -> ProofResult<()> {
        self.credential.initialize()
    }
    fn create_tpm(&mut self) -> ProofResult<(Vec<u8>, Vec<u8>)> {
        self.key.prepare()
    }
    fn create_prf(&mut self) -> ProofResult<(Vec<u8>, Zeroizing<[u8; 32]>)> {
        self.credential.create()
    }
    fn reopen(&mut self, h: &Header) -> ProofResult<()> {
        self.key.reopen(&h.public, &h.name)?;
        self.credential.reopen(&h.credential)
    }
    fn wrap(&mut self, secret: &[u8; 32]) -> ProofResult<Vec<u8>> {
        self.key.wrap(secret)
    }
    fn authorize(&mut self) -> ProofResult<Zeroizing<[u8; 32]>> {
        self.credential.authorize()
    }
    fn unwrap(&mut self, cipher: &[u8]) -> ProofResult<Zeroizing<Vec<u8>>> {
        self.key.unwrap(cipher)
    }
    fn cleanup_prf(&mut self) -> ProofResult<()> {
        self.credential.cleanup()
    }
    fn cleanup_tpm(&mut self) -> ProofResult<()> {
        self.key.cleanup()
    }
}
pub fn run(
    root: &Path,
    hwnd: usize,
    current: impl Fn() -> bool + Sync,
    action: Action,
) -> Result<Report> {
    let _attempt = crate::hello::Attempt::begin()?;
    libsodium_rs::ensure_init().map_err(|_| Error::new("UNAVAILABLE"))?;
    static PROCESS: OnceLock<String> = OnceLock::new();
    let process = PROCESS.get_or_init(|| uuid::Uuid::new_v4().to_string());
    let j = Journal::open(root)?;
    let record = j.read()?;
    let observed = state(record.as_ref(), process);
    if matches!(action, Action::Status)
        || (record.is_some() && matches!(action, Action::Prepare))
        || (record.is_none() && !matches!(action, Action::Prepare))
    {
        return Ok(Report::new(observed));
    }
    if !current() && !matches!(action, Action::Cleanup) {
        return Err(Error::new("STALE"));
    }
    let mut r = record.unwrap_or_else(|| Record::new(process));
    let mut backend = Native {
        credential: Credential::new(hwnd, &current, r.header.salt, r.header.user()),
        key: Key::new(&r.header.key_name(), &current),
    };
    Ok(execute(&j, &mut r, &mut backend, action, process, &current))
}
