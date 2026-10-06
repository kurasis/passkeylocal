//! Developer-only fixture harness, never included in the installer.
//! The production host has no arbitrary directory command or stdin bridge.
use passkey_local_desktop::storage::Store;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
fn main() {
    let root = std::env::args_os()
        .nth(1)
        .expect("synthetic test data directory required");
    let mut store = Store::open(std::path::Path::new(&root)).expect("fixture store must open");
    let token = store.begin();
    for line in io::stdin().lock().lines() {
        let request: Value =
            serde_json::from_str(&line.expect("fixture input")).expect("fixture JSON");
        let result = store.dispatch(
            &token,
            request["operation"].as_str().unwrap(),
            request["args"].clone(),
        );
        println!(
            "{}",
            match result {
                Ok(v) => json!({"ok":true,"result":v}),
                Err(e) => json!({"ok":false,"error":e}),
            }
        );
        io::stdout().flush().unwrap();
    }
}
