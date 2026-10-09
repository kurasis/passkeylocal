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
    // Public stage numbers only, written to the test protocol status slot.
    // The release parser has no such diagnostic entry point.
    fn stage(value: u32) {
        use windows_sys::Win32::System::Memory::*;
        let handle = std::env::args().nth(2).unwrap().parse::<usize>().unwrap()
            as windows_sys::Win32::Foundation::HANDLE;
        let view = unsafe { MapViewOfFile(handle, FILE_MAP_WRITE, 0, 0, 32) };
        if !view.Value.is_null() {
            unsafe {
                std::ptr::write_volatile((view.Value as *mut u8).add(24).cast::<u32>(), value);
                UnmapViewOfFile(view);
            }
        }
    }
    let result = passkey_text_preview::worker::serve(|input| -> Result<String> {
        let text = std::str::from_utf8(input).map_err(|_| Error::Protocol)?;
        if text == "hang" {
            std::thread::sleep(Duration::from_secs(60));
            return Ok(String::new());
        }
        stage(100);
        let lines: Vec<_> = text.lines().collect();
        if lines.len() < 5 {
            return Err(Error::Protocol);
        }
        stage(101);
        let parent = lines[0].parse::<u32>().map_err(|_| Error::Protocol)?;
        let sentinel = lines[1].parse::<usize>().map_err(|_| Error::Protocol)? as HANDLE;
        stage(111);
        // Query the actual handle table rather than dereferencing a deliberately
        // absent handle: Windows may raise STATUS_INVALID_HANDLE for the latter.
        #[repr(C)]
        #[derive(Clone, Copy)]
        struct Entry {
            handle: HANDLE,
            handle_count: usize,
            pointer_count: usize,
            granted: u32,
            kind: u32,
            attributes: u32,
            reserved: u32,
        }
        #[link(name = "ntdll")]
        extern "system" {
            fn NtQueryInformationProcess(
                process: HANDLE,
                class: u32,
                buffer: *mut std::ffi::c_void,
                size: u32,
                returned: *mut u32,
            ) -> i32;
        }
        let mut table = vec![0usize; 8192];
        let mut returned = 0;
        let size = std::mem::size_of_val(table.as_slice());
        let status = unsafe {
            NtQueryInformationProcess(
                GetCurrentProcess(),
                51,
                table.as_mut_ptr().cast(),
                size as u32,
                &mut returned,
            )
        };
        let header = 2 * std::mem::size_of::<usize>();
        let count = table[0];
        if status != 0
            || returned as usize > size
            || (returned as usize) < header
            || count > (returned as usize - header) / std::mem::size_of::<Entry>()
        {
            return Ok("FAIL: own handle table unavailable".to_owned());
        }
        let entries = unsafe {
            std::slice::from_raw_parts(
                table.as_ptr().cast::<u8>().add(header).cast::<Entry>(),
                count,
            )
        };
        let input_id = std::env::args().nth(1).unwrap().parse::<usize>().unwrap() as HANDLE;
        let output_id = std::env::args().nth(2).unwrap().parse::<usize>().unwrap() as HANDLE;
        if !entries.iter().any(|e| e.handle == input_id)
            || !entries.iter().any(|e| e.handle == output_id)
        {
            return Ok("FAIL: handle table positive control".to_owned());
        }
        if entries.iter().any(|e| e.handle == sentinel) {
            return Ok("FAIL: inherited sentinel".to_owned());
        }
        let input_handle = std::env::args().nth(1).unwrap().parse::<usize>().unwrap() as HANDLE;
        stage(112);
        let writable = unsafe { MapViewOfFile(input_handle, FILE_MAP_WRITE, 0, 0, 0) };
        if !writable.Value.is_null() {
            unsafe {
                UnmapViewOfFile(writable);
            }
            return Ok("FAIL: writable input mapping".to_owned());
        }
        // Do not infer immutability from the first restricted handle: attempt
        // to gain write access through a same-process duplication as well.
        stage(113);
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
        stage(114);
        for right in [0x00040000u32, 0x00080000u32] {
            let mut privileged = std::ptr::null_mut();
            if unsafe {
                DuplicateHandle(
                    GetCurrentProcess(),
                    input_handle,
                    GetCurrentProcess(),
                    &mut privileged,
                    right,
                    0,
                    0,
                )
            } != 0
            {
                unsafe {
                    CloseHandle(privileged);
                }
                return Ok("FAIL: input security-descriptor escalation".to_owned());
            }
        }
        let process = unsafe { OpenProcess(PROCESS_VM_READ | PROCESS_DUP_HANDLE, 0, parent) };
        if !process.is_null() {
            unsafe {
                CloseHandle(process);
            }
            return Ok("FAIL: parent memory".to_owned());
        }
        stage(115);
        if unsafe { OpenClipboard(std::ptr::null_mut()) } != 0 {
            return Ok("FAIL: clipboard".to_owned());
        }
        stage(102);
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
        stage(103);
        for variable in ["TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE"] {
            if let Some(path) = std::env::var_os(variable) {
                let path = std::path::PathBuf::from(path);
                let _ = std::fs::create_dir_all(&path);
                if std::fs::write(
                    path.join("selected-document-probe.txt"),
                    b"synthetic persistence canary",
                )
                .is_ok()
                {
                    return Ok("FAIL: actual worker TEMP/profile persistence".to_owned());
                }
            }
        }
        let own_profile = std::path::Path::new(lines.last().unwrap())
            .parent()
            .unwrap();
        if std::fs::create_dir_all(own_profile).is_ok() {
            return Ok("FAIL: own profile storage".to_owned());
        }
        stage(104);
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
        stage(105);
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
        stage(106);
        for target in [lines[3], "1.1.1.1:53"] {
            if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
                if socket.send_to(b"synthetic denial probe", target).is_ok() {
                    return Ok("FAIL: UDP or DNS-port access".to_owned());
                }
            }
        }
        stage(107);
        // Child policy and job active-process limit are enforced before resume.
        if std::process::Command::new(std::env::current_exe().map_err(|_| Error::Sandbox)?)
            .spawn()
            .is_ok()
        {
            return Ok("FAIL: child execution".to_owned());
        }
        stage(108);
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
