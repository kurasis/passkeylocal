fn main() {
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
            "hello_unlock",
            "hello_revoke",
        ]),
    ))
    .expect("desktop permission manifest must compile");
}
