use crate::{
    filesystem as io, hello,
    inactivity::Inactivity,
    storage::{Error, Result, Store, MAX_BYTES},
};
use serde_json::Value;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, SyncSender},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager, State, WebviewWindow};

struct NativeState {
    store: Mutex<Store>,
    active: Mutex<Option<String>>,
    serial: AtomicU64,
    inactivity: Mutex<Inactivity>,
    backup: SyncSender<()>,
}
impl NativeState {
    fn check(&self, token: &str) -> Result<()> {
        if self
            .active
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .as_deref()
            == Some(token)
            && !self
                .inactivity
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .expired(Instant::now())
        {
            Ok(())
        } else {
            Err(Error::new("INVALID_STATE"))
        }
    }
    fn wake_backup(&self) {
        let _ = self.backup.try_send(());
    }
}
fn trusted(window: &WebviewWindow) -> Result<()> {
    if window.label() != "main" {
        return Err(Error::new("INVALID_STATE"));
    }
    // Capabilities additionally deny remote origins and unknown windows.
    Ok(())
}
fn focused(window: &WebviewWindow) -> Result<()> {
    trusted(window)?;
    if window.is_focused().unwrap_or(false) {
        Ok(())
    } else {
        Err(Error::new("INVALID_STATE"))
    }
}
fn store<'a>(state: &'a State<'_, NativeState>) -> Result<std::sync::MutexGuard<'a, Store>> {
    state.store.lock().map_err(|_| Error::new("UNAVAILABLE"))
}
#[tauri::command]
async fn session_begin(window: WebviewWindow, app: tauri::AppHandle) -> Result<String> {
    trusted(&window)?;
    let serial = app.state::<NativeState>().serial.load(Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<NativeState>();
        let mut storage = store(&state)?;
        let token = storage.begin();
        let mut active = state.active.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        if serial != state.serial.load(Ordering::SeqCst) {
            storage.end(&token);
            return Err(Error::new("INVALID_STATE"));
        }
        state
            .inactivity
            .lock()
            .map_err(|_| Error::new("UNAVAILABLE"))?
            .begin(Instant::now(), storage.lock_interval());
        *active = Some(token.clone());
        Ok(token)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
async fn session_end(window: WebviewWindow, app: tauri::AppHandle, token: String) -> Result<()> {
    trusted(&window)?;
    let state = app.state::<NativeState>();
    {
        let mut active = state.active.lock().map_err(|_| Error::new("UNAVAILABLE"))?;
        if active.as_deref() == Some(&token) {
            *active = None;
        }
    }
    tauri::async_runtime::spawn_blocking(move || {
        store(&app.state::<NativeState>())?.end(&token);
        Ok(())
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
async fn storage(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    operation: String,
    args: Value,
) -> Result<Value> {
    trusted(&window)?;
    if token.len() > 64 || operation.len() > 64 {
        return Err(Error::new("INVALID_STATE"));
    }
    if args
        .get("bytes")
        .and_then(Value::as_array)
        .is_some_and(|a| a.len() > MAX_BYTES)
    {
        return Err(Error::new("CORRUPT"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<NativeState>();
        state.check(&token)?;
        let mut managed = store(&state)?;
        state.check(&token)?;
        managed.native_deadline(
            state
                .inactivity
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .deadline(),
        );
        let result = managed.dispatch(&token, &operation, args);
        if result.is_ok() && operation == "setPreference" {
            state
                .inactivity
                .lock()
                .map_err(|_| Error::new("UNAVAILABLE"))?
                .interval(managed.lock_interval());
        }
        drop(managed);
        if result.is_ok() && ["commit", "restoreBlob"].contains(&operation.as_str()) {
            state.wake_backup();
        }
        result
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
fn native_activity(window: WebviewWindow, state: State<'_, NativeState>) -> Result<()> {
    focused(&window)?;
    state
        .inactivity
        .lock()
        .map_err(|_| Error::new("UNAVAILABLE"))?
        .activity(Instant::now());
    Ok(())
}
#[tauri::command]
async fn native_status(window: WebviewWindow, app: tauri::AppHandle) -> Result<Value> {
    trusted(&window)?;
    tauri::async_runtime::spawn_blocking(move || Ok(store(&app.state::<NativeState>())?.status()))
        .await
        .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
async fn pick_import(window: WebviewWindow) -> Result<Option<Vec<u8>>> {
    focused(&window)?;
    let hwnd = window.hwnd().map_err(|_| Error::new("UNAVAILABLE"))?.0 as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let dialog = rfd::FileDialog::new()
            .set_title("Choose encrypted KDBX backup")
            .add_filter("Encrypted vault", &["kdbx"]);
        let parent = WindowParent(hwnd);
        let dialog = dialog.set_parent(&parent);
        dialog
            .pick_file()
            .map(|path| io::read_import(&path))
            .transpose()
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
async fn export_backup(window: WebviewWindow, bytes: Vec<u8>) -> Result<bool> {
    focused(&window)?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err(Error::new("CORRUPT"));
    }
    let hwnd = window.hwnd().map_err(|_| Error::new("UNAVAILABLE"))?.0 as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let parent = WindowParent(hwnd);
        let Some(path) = rfd::FileDialog::new()
            .set_parent(&parent)
            .set_title("Save encrypted backup (choose a new filename)")
            .set_file_name("vault-backup.kdbx")
            .add_filter("Encrypted vault", &["kdbx"])
            .save_file()
        else {
            return Ok(false);
        };
        let path = io::user_path(&path)?;
        let _pins = io::pin_directory(path.parent().ok_or(Error::new("INVALID_STATE"))?)?;
        // Exports never overwrite another backup, even if the OS dialog offers it.
        io::exclusive_write(&path, &bytes)?;
        Ok(true)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
async fn configure_backup(window: WebviewWindow, app: tauri::AppHandle) -> Result<()> {
    focused(&window)?;
    let hwnd = window.hwnd().map_err(|_| Error::new("UNAVAILABLE"))?.0 as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let parent = WindowParent(hwnd);
        let selected = rfd::FileDialog::new()
            .set_parent(&parent)
            .set_title("Choose an external backup folder")
            .pick_folder();
        if let Some(path) = selected {
            let state = app.state::<NativeState>();
            store(&state)?.configure_backup(&path)?;
            state.wake_backup();
        }
        Ok(())
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
fn retry_backup(window: WebviewWindow, state: State<'_, NativeState>) -> Result<()> {
    focused(&window)?;
    state.wake_backup();
    Ok(())
}
#[tauri::command]
async fn backup_retention(
    window: WebviewWindow,
    app: tauri::AppHandle,
    retention: usize,
) -> Result<()> {
    focused(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        store(&app.state::<NativeState>())?.set_backup_retention(retention)
    })
    .await
    .map_err(|_| Error::new("UNAVAILABLE"))?
}
#[tauri::command]
fn hello_enroll(window: WebviewWindow) -> Result<Value> {
    focused(&window)?;
    hello::enroll()
}
#[tauri::command]
fn hello_unlock(window: WebviewWindow) -> Result<Value> {
    focused(&window)?;
    hello::unlock()
}
#[tauri::command]
fn hello_revoke(window: WebviewWindow) -> Result<Value> {
    focused(&window)?;
    hello::revoke()
}
#[tauri::command]
fn open_external(window: WebviewWindow, url: String) -> Result<()> {
    focused(&window)?;
    if url.len() > 4096 {
        return Err(Error::new("INVALID_STATE"));
    }
    let parsed = tauri::Url::parse(&url).map_err(|_| Error::new("INVALID_STATE"))?;
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.host_str().is_none()
    {
        return Err(Error::new("INVALID_STATE"));
    }
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    let verb: Vec<_> = "open".encode_utf16().chain(Some(0)).collect();
    let target: Vec<_> = parsed.as_str().encode_utf16().chain(Some(0)).collect();
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as usize <= 32 {
        Err(Error::new("UNAVAILABLE"))
    } else {
        Ok(())
    }
}

// Only HWND identity crosses into the blocking picker thread. It is not IPC.
struct WindowParent(usize);
impl raw_window_handle::HasWindowHandle for WindowParent {
    fn window_handle(
        &self,
    ) -> std::result::Result<raw_window_handle::WindowHandle<'_>, raw_window_handle::HandleError>
    {
        let raw = raw_window_handle::Win32WindowHandle::new(
            std::num::NonZeroIsize::new(self.0 as isize)
                .ok_or(raw_window_handle::HandleError::Unavailable)?,
        );
        Ok(unsafe {
            raw_window_handle::WindowHandle::borrow_raw(raw_window_handle::RawWindowHandle::Win32(
                raw,
            ))
        })
    }
}
impl raw_window_handle::HasDisplayHandle for WindowParent {
    fn display_handle(
        &self,
    ) -> std::result::Result<raw_window_handle::DisplayHandle<'_>, raw_window_handle::HandleError>
    {
        Ok(raw_window_handle::DisplayHandle::windows())
    }
}

fn lock_native(app: &tauri::AppHandle) {
    let state = app.state::<NativeState>();
    if let Ok(mut active) = state.active.lock() {
        state.serial.fetch_add(1, Ordering::SeqCst);
        *active = None;
    }
    // No filesystem mutex is needed to revoke access/redact immediately.
    // Already-authorized ciphertext writes may finish without revealing UI.
    let _ = app.emit_to("main", "native-lock", ());
}

unsafe extern "system" fn windows_events(
    hwnd: windows_sys::Win32::Foundation::HWND,
    message: u32,
    wparam: usize,
    lparam: isize,
    _subclass: usize,
    data: usize,
) -> isize {
    use windows_sys::Win32::UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass},
        WindowsAndMessaging::{WM_NCDESTROY, WM_POWERBROADCAST, WM_WTSSESSION_CHANGE},
    };
    let app = &*(data as *const tauri::AppHandle);
    // Lock, logoff, user switching/disconnect and *all* suspend/resume changes
    // invalidate native tokens before notifying the renderer.
    if message == WM_WTSSESSION_CHANGE
        || message == WM_POWERBROADCAST && [4, 7, 18].contains(&wparam)
    {
        lock_native(app);
    }
    if message == WM_NCDESTROY {
        RemoveWindowSubclass(hwnd, Some(windows_events), 1);
        windows_sys::Win32::System::RemoteDesktop::WTSUnRegisterSessionNotification(hwnd);
        drop(Box::from_raw(data as *mut tauri::AppHandle));
    }
    DefSubclassProc(hwnd, message, wparam, lparam)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            session_begin,
            session_end,
            storage,
            native_activity,
            native_status,
            pick_import,
            export_backup,
            configure_backup,
            retry_backup,
            backup_retention,
            open_external,
            hello_enroll,
            hello_unlock,
            hello_revoke
        ])
        .setup(|app| {
            let root: PathBuf = app.path().app_local_data_dir()?;
            let state = Store::open(&root).map_err(|e| std::io::Error::other(e.code))?;
            let inactivity = Inactivity::new(state.lock_interval());
            let (wake, jobs) = mpsc::sync_channel(1);
            app.manage(NativeState {
                store: Mutex::new(state),
                active: Mutex::new(None),
                serial: AtomicU64::new(0),
                inactivity: Mutex::new(inactivity),
                backup: wake,
            });
            let backup_app = app.handle().clone();
            std::thread::spawn(move || loop {
                let _ = jobs.recv_timeout(Duration::from_secs(30));
                let state = backup_app.state::<NativeState>();
                let job = state
                    .store
                    .lock()
                    .ok()
                    .and_then(|s| s.pending_backup().ok().flatten());
                if let Some(job) = job {
                    let outcome = job.run(); // external I/O without the vault lock
                    if let Ok(mut s) = state.store.lock() {
                        let _ = s.finish_backup(&job, outcome);
                    }
                }
            });
            let config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("main window configuration unavailable")?;
            let window = tauri::WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(|url| {
                    // Initial packaged load and dev server only. No record URL
                    // can navigate the privileged WebView or open a popup.
                    let local = url.scheme() == "tauri" && url.host_str() == Some("localhost")
                        || url.scheme() == "http" && url.host_str() == Some("tauri.localhost");
                    local
                        || cfg!(debug_assertions)
                            && url.scheme() == "http"
                            && url.host_str() == Some("localhost")
                            && url.port() == Some(1420)
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            let hwnd = window.hwnd()?;
            let pointer = Box::into_raw(Box::new(app.handle().clone()));
            unsafe {
                use windows_sys::Win32::{
                    System::RemoteDesktop::{
                        WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
                    },
                    UI::Shell::SetWindowSubclass,
                };
                if SetWindowSubclass(hwnd.0 as _, Some(windows_events), 1, pointer as usize) == 0 {
                    drop(Box::from_raw(pointer));
                    return Err("Windows lifecycle hook unavailable".into());
                }
                if WTSRegisterSessionNotification(hwnd.0 as _, NOTIFY_FOR_THIS_SESSION) == 0 {
                    return Err("Windows session notifications unavailable".into());
                }
            }
            let timer_app = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(1));
                let state = timer_app.state::<NativeState>();
                // Match begin/check lock order and revoke under the same guard;
                // an old timeout observation cannot revoke a newer session.
                let revoked = if let Ok(mut active) = state.active.lock() {
                    let expired = state
                        .inactivity
                        .lock()
                        .map(|s| s.expired(Instant::now()))
                        .unwrap_or(true);
                    if active.is_some() && expired {
                        state.serial.fetch_add(1, Ordering::SeqCst);
                        *active = None;
                        true
                    } else {
                        false
                    }
                } else {
                    true
                };
                if revoked {
                    let _ = timer_app.emit_to("main", "native-lock", ());
                }
            });
            app.state::<NativeState>().wake_backup();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("PassKey Local desktop could not start");
}
