//! Main-window-only, typed commands. No renderer path or plaintext-byte API.
use super::manager::{collect_sources, Change, ImportOutcome, Page, Query, SafeHost, Status};
use crate::{
    host::{focused, trusted, WindowParent},
    storage::{Error, Result},
};
use tauri::{Emitter, Manager, State, WebviewWindow};
fn hwnd(window: &WebviewWindow) -> Result<usize> {
    focused(window)?;
    Ok(window.hwnd().map_err(|_| Error::new("UNAVAILABLE"))?.0 as usize)
}
#[tauri::command]
pub fn file_safe_status(window: WebviewWindow, state: State<'_, SafeHost>) -> Result<Status> {
    trusted(&window)?;
    state.get()?.status()
}
#[tauri::command]
pub async fn file_safe_access(
    window: WebviewWindow,
    app: tauri::AppHandle,
    password: String,
    create: bool,
    expected_generation: String,
) -> Result<String> {
    focused(&window)?;
    // Bind admission to the status observed before password submission, even
    // when the IPC message reaches Rust only after a native lock event.
    let epoch = expected_generation
        .parse::<u64>()
        .map_err(|_| Error::new("INVALID_STATE"))?;
    if epoch.to_string() != expected_generation {
        return Err(Error::new("INVALID_STATE"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<SafeHost>()
            .get()?
            .access_at(password, create, epoch)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub fn file_safe_lock(window: WebviewWindow, app: tauri::AppHandle) -> Result<()> {
    trusted(&window)?;
    app.state::<SafeHost>().get()?.revoke();
    let _ = app.emit_to("main", "file-safe-lock", ());
    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(s) = app.state::<SafeHost>().get() {
            s.dispose_locked();
        }
    });
    Ok(())
}
#[tauri::command]
pub fn lock_all(window: WebviewWindow, app: tauri::AppHandle) -> Result<()> {
    trusted(&window)?;
    crate::host::lock_native(&app);
    Ok(())
}
#[tauri::command]
pub fn file_safe_activity(
    window: WebviewWindow,
    state: State<'_, SafeHost>,
    token: String,
) -> Result<()> {
    focused(&window)?;
    state.get()?.activity(&token)
}
#[tauri::command]
pub fn file_safe_interval(
    window: WebviewWindow,
    state: State<'_, SafeHost>,
    token: String,
    millis: u64,
) -> Result<()> {
    focused(&window)?;
    state.get()?.interval(&token, millis)
}
#[tauri::command]
pub async fn file_safe_page(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    query: Query,
) -> Result<Page> {
    trusted(&window)?;
    tauri::async_runtime::spawn_blocking(move || app.state::<SafeHost>().get()?.page(&token, query))
        .await
        .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub async fn file_safe_change(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    snapshot: String,
    change: Change,
) -> Result<()> {
    focused(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<SafeHost>()
            .get()?
            .change(&token, &snapshot, change)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub async fn file_safe_import(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    snapshot: String,
    folder: String,
    recursive: bool,
    replace: Option<String>,
) -> Result<Option<ImportOutcome>> {
    let hwnd = hwnd(&window)?;
    app.state::<SafeHost>().get()?.check(&token)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SafeHost>().get()?;
        state.check(&token)?;
        let parent = WindowParent(hwnd);
        let dialog = rfd::FileDialog::new()
            .set_parent(&parent)
            .set_title("Copy files into the encrypted file safe");
        let paths = if recursive {
            dialog.pick_folder().map(|p| vec![p])
        } else {
            dialog.pick_files()
        };
        let Some(paths) = paths else {
            return Ok(None);
        };
        state.check(&token)?;
        let (sources, skipped) = collect_sources(paths, recursive)?;
        state
            .import(
                &token,
                &snapshot,
                &folder,
                replace.as_deref(),
                sources,
                skipped,
            )
            .map(Some)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub fn file_safe_cancel(
    window: WebviewWindow,
    state: State<'_, SafeHost>,
    token: String,
) -> Result<()> {
    trusted(&window)?;
    state.get()?.cancel(&token)
}
#[tauri::command]
pub async fn file_safe_export(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    file: String,
    version: Option<String>,
    acknowledge_plaintext: bool,
) -> Result<bool> {
    let hwnd = hwnd(&window)?;
    if !acknowledge_plaintext {
        return Err(Error::new("INVALID_INPUT"));
    }
    app.state::<SafeHost>().get()?.check(&token)?;
    tauri::async_runtime::spawn_blocking(move || {
        let parent = WindowParent(hwnd);
        let Some(path) = rfd::FileDialog::new()
            .set_parent(&parent)
            .set_title("Export unencrypted copy — choose a new filename")
            .save_file()
        else {
            return Ok(false);
        };
        app.state::<SafeHost>()
            .get()?
            .export(&token, &file, version.as_deref(), &path)?;
        Ok(true)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub async fn file_safe_rotate(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    snapshot: String,
    current: String,
    next: String,
) -> Result<()> {
    focused(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<SafeHost>()
            .get()?
            .rotate(&token, &snapshot, current, next)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub async fn file_safe_backup(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    configure: bool,
    retention: usize,
) -> Result<bool> {
    let hwnd = hwnd(&window)?;
    app.state::<SafeHost>().get()?.check(&token)?;
    tauri::async_runtime::spawn_blocking(move || {
        let parent = WindowParent(hwnd);
        let Some(path) = rfd::FileDialog::new()
            .set_parent(&parent)
            .set_title("Select external folder for encrypted file-safe copies")
            .pick_folder()
        else {
            return Ok(false);
        };
        let state = app.state::<SafeHost>().get()?;
        if configure {
            state.configure_backup(&token, &path, retention)?;
        } else {
            state.backup(&token, &path)?;
        }
        Ok(true)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub async fn file_safe_recover(
    window: WebviewWindow,
    app: tauri::AppHandle,
    password: String,
    candidate: Option<String>,
    confirm: bool,
) -> Result<Option<serde_json::Value>> {
    let hwnd = hwnd(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(candidate) = candidate {
            if !confirm {
                return Err(Error::new("INVALID_INPUT"));
            }
            app.state::<SafeHost>().get()?.restore_candidate(
                &candidate,
                password,
                confirm,
                &|| {
                    let _ = app.emit_to("main", "file-safe-lock", ());
                },
            )?;
            return Ok(Some(serde_json::json!({"status":"restored_locked"})));
        }
        let password = zeroize::Zeroizing::new(password);
        let parent = WindowParent(hwnd);
        let Some(path) = rfd::FileDialog::new()
            .set_parent(&parent)
            .set_title("Select a complete encrypted file-safe backup package")
            .pick_folder()
        else {
            return Ok(None);
        };
        app.state::<SafeHost>()
            .get()?
            .verify_candidate(&path, password.to_string())
            .map(Some)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
pub fn file_safe_retry_backup(
    window: WebviewWindow,
    state: State<'_, SafeHost>,
    token: String,
) -> Result<()> {
    focused(&window)?;
    state.get()?.check(&token)?;
    state.get()?.backups.retry()
}

#[tauri::command]
pub fn file_safe_import_results(
    window: WebviewWindow,
    state: State<'_, SafeHost>,
    token: String,
    offset: usize,
) -> Result<Vec<super::manager::ImportItem>> {
    trusted(&window)?;
    state.get()?.import_results(&token, offset)
}
