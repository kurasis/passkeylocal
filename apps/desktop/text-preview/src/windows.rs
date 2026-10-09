//! Per-launch unprofiled LPAC SID, two section handles, job active at creation.
use crate::{Error, Result, HEADER, MAGIC, MAX_INPUT};
use std::{
    ffi::c_void,
    mem::{size_of, zeroed},
    os::windows::ffi::OsStrExt,
    path::Path,
    ptr::{null, null_mut},
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::*,
    Security::{Authorization::*, Isolation::*, *},
    Storage::FileSystem::{FILE_GENERIC_EXECUTE, FILE_GENERIC_READ},
    System::{
        JobObjects::*, LibraryLoader::*, Memory::*, SystemInformation::GetSystemDirectoryW,
        SystemServices::MAXIMUM_ALLOWED, Threading::*,
    },
};
use zeroize::{Zeroize, Zeroizing};
pub(crate) fn failed(stage: &str) -> Error {
    #[cfg(feature = "proof")]
    eprintln!("Preview sandbox failure at {stage}: Win32 {}", unsafe {
        GetLastError()
    });
    let _ = stage;
    Error::Sandbox
}
pub(crate) struct Handle(pub HANDLE);
impl Handle {
    pub(crate) fn new(value: HANDLE) -> Result<Self> {
        if value.is_null() || value == INVALID_HANDLE_VALUE {
            Err(failed("handle"))
        } else {
            Ok(Self(value))
        }
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}
pub(crate) struct View {
    pub address: MEMORY_MAPPED_VIEW_ADDRESS,
    pub len: usize,
}
impl View {
    pub(crate) fn new(handle: HANDLE, access: u32, len: usize) -> Result<Self> {
        let address = unsafe { MapViewOfFile(handle, access, 0, 0, len) };
        if address.Value.is_null() {
            Err(failed("map"))
        } else {
            Ok(Self { address, len })
        }
    }
    pub(crate) fn bytes(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self.address.Value.cast(), self.len) }
    }
    pub(crate) fn bytes_mut(&mut self) -> &mut [u8] {
        unsafe { std::slice::from_raw_parts_mut(self.address.Value.cast(), self.len) }
    }
}
impl Drop for View {
    fn drop(&mut self) {
        unsafe {
            UnmapViewOfFile(self.address);
        }
    }
}
struct Sid(PSID);
impl Drop for Sid {
    fn drop(&mut self) {
        unsafe {
            FreeSid(self.0);
        }
    }
}
// Chromium registers the package identity separately from creating profile
// directories. Fail closed if this Windows entry point is unavailable. No
// CreateAppContainerProfile/profile directory or storage grants are requested.
struct Registration {
    sid: PSID,
    unregister: unsafe extern "system" fn(PSID) -> i32,
}
impl Registration {
    fn new(sid: PSID, name: &[u16]) -> Result<Self> {
        let module_name = wide(std::ffi::OsStr::new("kernelbase.dll"));
        let module = unsafe { GetModuleHandleW(module_name.as_ptr()) };
        if module.is_null() {
            return Err(failed("identity-module"));
        }
        let register =
            unsafe { GetProcAddress(module, c"AppContainerRegisterSid".as_ptr().cast()) }
                .ok_or_else(|| failed("identity-register-api"))?;
        let unregister =
            unsafe { GetProcAddress(module, c"AppContainerUnregisterSid".as_ptr().cast()) }
                .ok_or_else(|| failed("identity-unregister-api"))?;
        let register: unsafe extern "system" fn(PSID, *const u16, *const u16) -> i32 =
            unsafe { std::mem::transmute(register) };
        let unregister: unsafe extern "system" fn(PSID) -> i32 =
            unsafe { std::mem::transmute(unregister) };
        if unsafe { register(sid, name.as_ptr(), name.as_ptr()) } < 0 {
            return Err(failed("identity-register"));
        }
        Ok(Self { sid, unregister })
    }
}
impl Drop for Registration {
    fn drop(&mut self) {
        unsafe {
            (self.unregister)(self.sid);
        }
    }
}
struct Attributes {
    data: Vec<usize>,
    pointer: LPPROC_THREAD_ATTRIBUTE_LIST,
}
impl Attributes {
    fn new(count: u32) -> Result<Self> {
        let mut size = 0;
        unsafe {
            InitializeProcThreadAttributeList(null_mut(), count, 0, &mut size);
        }
        let mut data = vec![0usize; size.div_ceil(size_of::<usize>())];
        let pointer = data.as_mut_ptr().cast();
        if unsafe { InitializeProcThreadAttributeList(pointer, count, 0, &mut size) } == 0 {
            return Err(failed("attributes"));
        }
        Ok(Self { data, pointer })
    }
    fn set<T>(&self, attribute: u32, value: &T) -> Result<()> {
        if unsafe {
            UpdateProcThreadAttribute(
                self.pointer,
                0,
                attribute as usize,
                (value as *const T).cast::<c_void>(),
                size_of::<T>(),
                null_mut(),
                null(),
            )
        } == 0
        {
            return Err(failed("attribute"));
        }
        Ok(())
    }
}
impl Drop for Attributes {
    fn drop(&mut self) {
        unsafe {
            DeleteProcThreadAttributeList(self.pointer);
        }
        let _ = &self.data;
    }
}
fn wide(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}
// Only the fixed executable receives RX. No profile, directory, TEMP, registry,
// writable-file or network grants. Revoke just the unique SID after exit.
fn executable_acl(path: &[u16], sid: PSID, mode: ACCESS_MODE) -> Result<()> {
    unsafe {
        let mut descriptor = null_mut();
        let mut old = null_mut();
        if GetNamedSecurityInfoW(
            path.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            null_mut(),
            null_mut(),
            &mut old,
            null_mut(),
            &mut descriptor,
        ) != 0
        {
            return Err(failed("read-executable-acl"));
        }
        let entry = EXPLICIT_ACCESS_W {
            grfAccessPermissions: FILE_GENERIC_READ | FILE_GENERIC_EXECUTE,
            grfAccessMode: mode,
            grfInheritance: 0,
            Trustee: TRUSTEE_W {
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: TRUSTEE_IS_UNKNOWN,
                ptstrName: sid.cast(),
                ..zeroed()
            },
        };
        let mut acl = null_mut();
        let made = SetEntriesInAclW(1, &entry, old, &mut acl);
        let set = if made == 0 {
            SetNamedSecurityInfoW(
                path.as_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                null_mut(),
                null_mut(),
                acl,
                null_mut(),
            )
        } else {
            made
        };
        if !acl.is_null() {
            LocalFree(acl.cast());
        }
        LocalFree(descriptor.cast());
        if set != 0 {
            return Err(failed("set-executable-acl"));
        }
        Ok(())
    }
}
struct Grant<'a> {
    path: &'a [u16],
    sid: PSID,
}
impl Drop for Grant<'_> {
    fn drop(&mut self) {
        let _ = executable_acl(self.path, self.sid, REVOKE_ACCESS);
    }
}
fn section(len: usize) -> Result<Handle> {
    Handle::new(unsafe {
        CreateFileMappingW(
            INVALID_HANDLE_VALUE,
            null(),
            PAGE_READWRITE,
            0,
            len as u32,
            null(),
        )
    })
}
fn inherited(handle: HANDLE, access: u32) -> Result<Handle> {
    let mut value = null_mut();
    if unsafe {
        DuplicateHandle(
            GetCurrentProcess(),
            handle,
            GetCurrentProcess(),
            &mut value,
            access,
            1,
            0,
        )
    } == 0
    {
        return Err(failed("duplicate-section"));
    }
    Handle::new(value)
}
/// Caller supplies a fresh CSPRNG nonce and fully authenticated document bytes.
pub fn run(
    executable: &Path,
    input: &[u8],
    nonce: [u8; 16],
    check: impl Fn() -> bool,
) -> Result<Zeroizing<String>> {
    run_with_timeout(executable, input, nonce, check, Duration::from_secs(30))
}
#[cfg(feature = "proof")]
pub fn proof_run(
    executable: &Path,
    input: &[u8],
    nonce: [u8; 16],
    check: impl Fn() -> bool,
    timeout: Duration,
) -> Result<Zeroizing<String>> {
    run_with_timeout(executable, input, nonce, check, timeout)
}
fn run_with_timeout(
    executable: &Path,
    input: &[u8],
    nonce: [u8; 16],
    check: impl Fn() -> bool,
    timeout: Duration,
) -> Result<Zeroizing<String>> {
    if input.len() > MAX_INPUT {
        return Err(Error::Limit);
    }
    if !check() {
        return Err(Error::Cancelled);
    }
    let started = Instant::now();
    let path = wide(executable.as_os_str());
    let name = format!(
        "PassKeyLocal.Preview.{}",
        nonce.iter().map(|b| format!("{b:02x}")).collect::<String>()
    );
    let name = wide(std::ffi::OsStr::new(&name));
    let mut sid = null_mut();
    if unsafe { DeriveAppContainerSidFromAppContainerName(name.as_ptr(), &mut sid) } < 0 {
        return Err(failed("derive-unprofiled-sid"));
    }
    let sid = Sid(sid);
    let _registration = Registration::new(sid.0, &name)?;
    executable_acl(&path, sid.0, GRANT_ACCESS)?;
    let _grant = Grant {
        path: &path,
        sid: sid.0,
    };
    let writable = section(HEADER + input.len())?;
    {
        let mut view = View::new(writable.0, FILE_MAP_WRITE, HEADER + input.len())?;
        let bytes = view.bytes_mut();
        bytes[..8].copy_from_slice(MAGIC);
        bytes[8..24].copy_from_slice(&nonce);
        bytes[24..32].copy_from_slice(&(input.len() as u64).to_le_bytes());
        bytes[HEADER..].copy_from_slice(input);
    }
    let frozen = inherited(writable.0, FILE_MAP_READ)?;
    drop(writable);
    let output = section(HEADER + MAX_INPUT)?;
    let output_child = inherited(output.0, FILE_MAP_READ | FILE_MAP_WRITE)?;
    let mut output_view = View::new(output.0, FILE_MAP_READ | FILE_MAP_WRITE, HEADER + MAX_INPUT)?;
    let job = Handle::new(unsafe { CreateJobObjectW(null(), null()) })?;
    let limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        BasicLimitInformation: JOBOBJECT_BASIC_LIMIT_INFORMATION {
            LimitFlags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
                | JOB_OBJECT_LIMIT_PROCESS_MEMORY
                | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION,
            ActiveProcessLimit: 1,
            ..unsafe { zeroed() }
        },
        ProcessMemoryLimit: 256 * 1024 * 1024,
        ..unsafe { zeroed() }
    };
    let ui = JOBOBJECT_BASIC_UI_RESTRICTIONS {
        UIRestrictionsClass: 0xff,
    };
    if unsafe {
        SetInformationJobObject(
            job.0,
            JobObjectExtendedLimitInformation,
            (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    } == 0
        || unsafe {
            SetInformationJobObject(
                job.0,
                JobObjectBasicUIRestrictions,
                (&ui as *const JOBOBJECT_BASIC_UI_RESTRICTIONS).cast(),
                size_of::<JOBOBJECT_BASIC_UI_RESTRICTIONS>() as u32,
            )
        } == 0
    {
        return Err(failed("job-restrictions"));
    }
    let caps = SECURITY_CAPABILITIES {
        AppContainerSid: sid.0,
        Capabilities: null_mut(),
        CapabilityCount: 0,
        Reserved: 0,
    };
    let attributes = Attributes::new(5)?;
    let handles = [frozen.0, output_child.0];
    let jobs = [job.0];
    let lpac = 1u32;
    let no_children = 1u32;
    attributes.set(PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES, &caps)?;
    attributes.set(PROC_THREAD_ATTRIBUTE_ALL_APPLICATION_PACKAGES_POLICY, &lpac)?;
    attributes.set(PROC_THREAD_ATTRIBUTE_CHILD_PROCESS_POLICY, &no_children)?;
    attributes.set(PROC_THREAD_ATTRIBUTE_HANDLE_LIST, &handles)?;
    attributes.set(PROC_THREAD_ATTRIBUTE_JOB_LIST, &jobs)?;
    let mut directory = vec![0u16; 32768];
    let size =
        unsafe { GetSystemDirectoryW(directory.as_mut_ptr(), directory.len() as u32) } as usize;
    if size == 0 || size >= directory.len() {
        return Err(failed("system-directory"));
    }
    directory.truncate(size + 1);
    let system = String::from_utf16_lossy(&directory[..size]);
    let system_root = Path::new(&system)
        .parent()
        .ok_or(Error::Sandbox)?
        .to_string_lossy();
    // No inherited environment (tokens, vault paths or source identifiers).
    let environment: Vec<u16> = format!(
        "APPDATA={system}\\PassKeyNoProfile\0LOCALAPPDATA={system}\\PassKeyNoProfile\0SystemRoot={system_root}\0TEMP={system}\\PassKeyNoTemp\0TMP={system}\\PassKeyNoTemp\0USERPROFILE={system}\\PassKeyNoProfile\0\0"
    )
    .encode_utf16()
    .collect();
    let command = format!(
        "\"{}\" {} {} {}",
        executable.display(),
        frozen.0 as usize,
        output_child.0 as usize,
        HEADER + input.len()
    );
    let mut command = wide(std::ffi::OsStr::new(&command));
    let mut startup: STARTUPINFOEXW = unsafe { zeroed() };
    startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
    // Do not implicitly inherit console/CI pipe handles outside the explicit
    // section list. The worker has no standard streams.
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = null_mut();
    startup.StartupInfo.hStdOutput = null_mut();
    startup.StartupInfo.hStdError = null_mut();
    startup.lpAttributeList = attributes.pointer;
    let mut process: PROCESS_INFORMATION = unsafe { zeroed() };
    if unsafe {
        CreateProcessW(
            path.as_ptr(),
            command.as_mut_ptr(),
            null(),
            null(),
            1,
            EXTENDED_STARTUPINFO_PRESENT
                | CREATE_NO_WINDOW
                | CREATE_UNICODE_ENVIRONMENT
                | CREATE_SUSPENDED,
            environment.as_ptr().cast(),
            directory.as_ptr(),
            &startup.StartupInfo,
            &mut process,
        )
    } == 0
    {
        return Err(failed("create-lpac-worker"));
    }
    let process_handle = Handle::new(process.hProcess)?;
    let thread = Handle::new(process.hThread)?;
    if !token_is_lpac(process_handle.0)? {
        return Err(failed("token-readback"));
    }
    if !check() {
        return Err(Error::Cancelled);
    }
    if unsafe { ResumeThread(thread.0) } == u32::MAX {
        return Err(failed("resume-worker"));
    }
    loop {
        if !check() {
            return Err(Error::Cancelled);
        }
        if started.elapsed() > timeout {
            return Err(Error::Timeout);
        }
        let wait = unsafe { WaitForSingleObject(process_handle.0, 20) };
        if wait == WAIT_OBJECT_0 {
            break;
        }
        if wait != WAIT_TIMEOUT {
            return Err(failed("wait-worker"));
        }
    }
    let mut exit = 0;
    if unsafe { GetExitCodeProcess(process_handle.0, &mut exit) } == 0 || exit != 0 {
        return Err(failed("worker-exit"));
    }
    if !check() {
        return Err(Error::Cancelled);
    }
    let result =
        crate::response(output_view.bytes(), &nonce).map(|text| Zeroizing::new(text.to_owned()));
    output_view.bytes_mut().zeroize();
    result
}
pub(crate) fn token_is_lpac(process: HANDLE) -> Result<bool> {
    let mut token = null_mut();
    if unsafe { OpenProcessToken(process, TOKEN_QUERY | TOKEN_DUPLICATE, &mut token) } == 0 {
        return Err(failed("open-worker-token"));
    }
    let token = Handle::new(token)?;
    {
        let class = TokenIsAppContainer;
        let mut value = 0u32;
        let mut length = 0;
        if unsafe {
            GetTokenInformation(
                token.0,
                class,
                (&mut value as *mut u32).cast(),
                4,
                &mut length,
            )
        } == 0
            || length != 4
            || value != 1
        {
            return Ok(false);
        }
    }
    let mut size = 0;
    unsafe {
        GetTokenInformation(token.0, TokenCapabilities, null_mut(), 0, &mut size);
    }
    if !(4..=4096).contains(&size) {
        return Ok(false);
    }
    let mut groups = vec![0usize; (size as usize).div_ceil(size_of::<usize>())];
    if unsafe {
        GetTokenInformation(
            token.0,
            TokenCapabilities,
            groups.as_mut_ptr().cast(),
            size,
            &mut size,
        )
    } == 0
    {
        return Ok(false);
    }
    if unsafe { *(groups.as_ptr().cast::<u32>()) } != 0 {
        return Ok(false);
    }
    // Prove actual LPAC access semantics, as Chromium does. Some Windows
    // versions reject the newer TokenIsLessPrivilegedAppContainer info class.
    // World gets both bits; AC gets bit 1; restricted packages get bit 2.
    // Only an LPAC token must resolve MAXIMUM_ALLOWED to exactly bit 2.
    let mut impersonation = null_mut();
    if unsafe { DuplicateToken(token.0, SecurityImpersonation, &mut impersonation) } == 0 {
        return Err(failed("lpac-access-token"));
    }
    let impersonation = Handle::new(impersonation)?;
    let sddl = wide(std::ffi::OsStr::new(
        "O:SYG:SYD:(A;;0x3;;;WD)(A;;0x1;;;AC)(A;;0x2;;;S-1-15-2-2)",
    ));
    let mut descriptor = null_mut();
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            SDDL_REVISION_1,
            &mut descriptor,
            null_mut(),
        )
    } == 0
    {
        return Err(failed("lpac-access-descriptor"));
    }
    let mapping: GENERIC_MAPPING = unsafe { zeroed() };
    let mut privileges = [0usize; 256];
    let mut privilege_size = size_of::<[usize; 256]>() as u32;
    let mut granted = 0;
    let mut allowed = 0;
    let result = unsafe {
        AccessCheck(
            descriptor,
            impersonation.0,
            MAXIMUM_ALLOWED,
            &mapping,
            privileges.as_mut_ptr().cast(),
            &mut privilege_size,
            &mut granted,
            &mut allowed,
        )
    };
    unsafe {
        LocalFree(descriptor.cast());
    }
    if result == 0 {
        return Err(failed("lpac-access-check"));
    }
    Ok(allowed != 0 && granted == 2)
}
