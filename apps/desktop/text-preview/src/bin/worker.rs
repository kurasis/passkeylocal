#![cfg_attr(windows, windows_subsystem = "windows")]
#[cfg(windows)]
fn main() {
    std::process::exit(
        if passkey_text_preview::worker::serve(|data| {
            passkey_text_preview::decode(data).map(str::to_owned)
        })
        .is_ok()
        {
            0
        } else {
            1
        },
    );
}
#[cfg(not(windows))]
fn main() {
    std::process::exit(1);
}
