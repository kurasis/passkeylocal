fn main() {
    // Public build provenance only. Never embed arbitrary environment values.
    println!("cargo:rerun-if-env-changed=GITHUB_SHA");
    if let Ok(source) = std::env::var("GITHUB_SHA") {
        if source.len() == 40 && source.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            println!("cargo:rustc-env=PASSKEY_SOURCE_COMMIT={source}");
        }
    }
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "session_begin",
            "session_end",
            "storage",
            "pick_import",
            "export_backup",
            "native_status",
            "configure_backup",
            "retry_backup",
            "backup_retention",
            "open_external",
            "native_activity",
            "hello_enroll",
            "hello_status",
            "hello_verify",
            "hello_key_proof",
            "hello_settings",
            "hello_unlock",
            "hello_revoke",
            "file_safe_status",
            "file_safe_access",
            "file_safe_lock",
            "lock_all",
            "file_safe_activity",
            "file_safe_interval",
            "file_safe_page",
            "file_safe_change",
            "file_safe_import",
            "file_safe_cancel",
            "file_safe_export",
            "file_safe_rotate",
            "file_safe_backup",
            "file_safe_recover",
            "file_safe_retry_backup",
            "file_safe_import_results",
        ]),
    ))
    .expect("desktop permission manifest must compile");
}
