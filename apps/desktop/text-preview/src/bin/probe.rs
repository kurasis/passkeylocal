//! Hostile acceptance worker, built only with `proof`, never bundled.
#![cfg_attr(windows, windows_subsystem = "windows")]
#[cfg(windows)]
fn main() {
    use passkey_text_preview::{Error, Result};
    use std::{
        io::Write,
        net::{SocketAddr, TcpStream, UdpSocket},
        time::Duration,
    };
    use windows_sys::Win32::{
        Foundation::*,
        System::DataExchange::OpenClipboard,
        System::{Memory::*, Registry::*, Threading::*},
    };
    let result = passkey_text_preview::worker::serve(|input| -> Result<String> {
        let text = std::str::from_utf8(input).map_err(|_| Error::Protocol)?;
        if text == "hang" {
            std::thread::sleep(Duration::from_secs(60));
            return Ok(String::new());
        }
        let lines: Vec<_> = text.lines().collect();
        if lines.len() < 5 {
            return Err(Error::Protocol);
        }
        let parent = lines[0].parse::<u32>().map_err(|_| Error::Protocol)?;
        let sentinel = lines[1].parse::<usize>().map_err(|_| Error::Protocol)? as HANDLE;
        let mut flags = 0;
        if unsafe { GetHandleInformation(sentinel, &mut flags) } != 0 {
            return Ok("FAIL: inherited sentinel".to_owned());
        }
        let input_handle = std::env::args().nth(1).unwrap().parse::<usize>().unwrap() as HANDLE;
        let writable = unsafe { MapViewOfFile(input_handle, FILE_MAP_WRITE, 0, 0, 0) };
        if !writable.Value.is_null() {
            unsafe {
                UnmapViewOfFile(writable);
            }
            return Ok("FAIL: writable input mapping".to_owned());
        }
        // Do not infer immutability from the first restricted handle: attempt
        // to gain write access through a same-process duplication as well.
        let mut escalated = std::ptr::null_mut();
        if unsafe {
            DuplicateHandle(
                GetCurrentProcess(),
                input_handle,
                GetCurrentProcess(),
                &mut escalated,
                FILE_MAP_WRITE,
                0,
                0,
            )
        } != 0
        {
            let view = unsafe { MapViewOfFile(escalated, FILE_MAP_WRITE, 0, 0, 0) };
            unsafe {
                CloseHandle(escalated);
            }
            if !view.Value.is_null() {
                unsafe {
                    UnmapViewOfFile(view);
                }
                return Ok("FAIL: input access escalation".to_owned());
            }
        }
        let process = unsafe { OpenProcess(PROCESS_VM_READ, 0, parent) };
        if !process.is_null() {
            unsafe {
                CloseHandle(process);
            }
            return Ok("FAIL: parent memory".to_owned());
        }
        if unsafe { OpenClipboard(std::ptr::null_mut()) } != 0 {
            return Ok("FAIL: clipboard".to_owned());
        }
        for path in &lines[4..] {
            if std::fs::File::open(path).is_ok() {
                return Ok("FAIL: unrelated file read".to_owned());
            }
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(false)
                .open(path)
            {
                let _ = file.write_all(b"synthetic preview persistence canary");
                return Ok("FAIL: file persistence".to_owned());
            }
        }
        // Registration must not grant a writable own storage profile. Try
        // creating all missing directories, not just opening a missing leaf.
        let own_profile = std::path::Path::new(lines.last().unwrap())
            .parent()
            .unwrap();
        if std::fs::create_dir_all(own_profile).is_ok() {
            return Ok("FAIL: own profile storage".to_owned());
        }
        let key: Vec<u16> = "Software\\PassKeyLocalPreviewSyntheticCanary\0"
            .encode_utf16()
            .collect();
        let mut registry = std::ptr::null_mut();
        let rc = unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                0,
                std::ptr::null(),
                0,
                KEY_WRITE,
                std::ptr::null(),
                &mut registry,
                std::ptr::null_mut(),
            )
        };
        if rc == 0 {
            unsafe {
                RegCloseKey(registry);
                RegDeleteKeyW(HKEY_CURRENT_USER, key.as_ptr());
            }
            return Ok("FAIL: registry write".to_owned());
        }
        let targets = [
            lines[2]
                .parse::<SocketAddr>()
                .map_err(|_| Error::Protocol)?,
            "1.1.1.1:443".parse().unwrap(),
        ];
        for target in targets {
            if TcpStream::connect_timeout(&target, Duration::from_millis(300)).is_ok() {
                return Ok("FAIL: TCP access".to_owned());
            }
        }
        for target in [lines[3], "1.1.1.1:53"] {
            if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
                if socket.send_to(b"synthetic denial probe", target).is_ok() {
                    return Ok("FAIL: UDP or DNS-port access".to_owned());
                }
            }
        }
        // Child policy and job active-process limit are enforced before resume.
        if std::process::Command::new(std::env::current_exe().map_err(|_| Error::Sandbox)?)
            .spawn()
            .is_ok()
        {
            return Ok("FAIL: child execution".to_owned());
        }
        let memory = unsafe {
            VirtualAlloc(
                std::ptr::null(),
                300 * 1024 * 1024,
                MEM_COMMIT | MEM_RESERVE,
                PAGE_READWRITE,
            )
        };
        if !memory.is_null() {
            unsafe {
                VirtualFree(memory, 0, MEM_RELEASE);
            }
            return Ok("FAIL: memory limit".to_owned());
        }
        Ok("PASS: LPAC/no capabilities; input read-only; no inherited sentinel; denied vault/temp/profile/files/registry/parent-memory/clipboard; denied TCP/UDP/DNS/loopback; no children; bounded memory".to_owned())
    });
    std::process::exit(if result.is_ok() { 0 } else { 1 });
}
#[cfg(not(windows))]
fn main() {
    std::process::exit(1);
}
