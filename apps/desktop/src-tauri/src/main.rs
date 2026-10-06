#[cfg(windows)]
fn main() {
    passkey_local_desktop::host::run();
}
#[cfg(not(windows))]
fn main() {
    eprintln!("PassKey Local desktop is supported on Windows 11 x64 only.");
}
