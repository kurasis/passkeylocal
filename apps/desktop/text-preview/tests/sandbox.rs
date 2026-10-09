#![cfg(all(windows, feature = "proof"))]
use passkey_text_preview::{windows::proof_run, Error};
use std::{
    io::Write,
    net::{TcpListener, TcpStream, UdpSocket},
    os::windows::fs::OpenOptionsExt,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};
fn nonce() -> [u8; 16] {
    static ID: AtomicU64 = AtomicU64::new(0);
    let mut nonce = [0; 16];
    nonce[..8].copy_from_slice(&(std::process::id() as u64).to_le_bytes());
    nonce[8..].copy_from_slice(&ID.fetch_add(1, Ordering::SeqCst).to_le_bytes());
    nonce
}
#[test]
fn real_lpac_text_and_negative_worker_are_os_enforced() {
    let release = std::env::var("PASSKEY_PREVIEW_RELEASE_WORKER")
        .expect("Prove the exact bundled release worker");
    let worker = Path::new(&release);
    let text = b"\xef\xbb\xbfSynthetic <script>alert(1)</script>\nUTF-8 text";
    let out = proof_run(worker, text, nonce(), || true, Duration::from_secs(30)).unwrap();
    assert_eq!(&*out, "Synthetic <script>alert(1)</script>\nUTF-8 text");
    assert_eq!(
        proof_run(worker, b"\xff", nonce(), || true, Duration::from_secs(30)).unwrap_err(),
        Error::Unsupported
    );
    let base = std::env::temp_dir().join(format!("PassKey-Preview-Canary-{}", std::process::id()));
    std::fs::create_dir(&base).unwrap();
    let vault = base.join("password-vault.kdbx");
    std::fs::write(&vault, b"synthetic unrelated vault").unwrap();
    let sentinel = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(0)
        .open(&vault)
        .unwrap();
    use std::os::windows::io::AsRawHandle;
    let sentinel_raw = sentinel.as_raw_handle();
    assert_ne!(
        unsafe {
            windows_sys::Win32::Foundation::SetHandleInformation(
                sentinel_raw,
                windows_sys::Win32::Foundation::HANDLE_FLAG_INHERIT,
                windows_sys::Win32::Foundation::HANDLE_FLAG_INHERIT,
            )
        },
        0
    );
    let tcp = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = tcp.local_addr().unwrap();
    let positive = TcpStream::connect(addr).unwrap();
    tcp.accept().unwrap();
    drop(positive);
    let udp = UdpSocket::bind("127.0.0.1:0").unwrap();
    let udpaddr = udp.local_addr().unwrap();
    let sender = UdpSocket::bind("127.0.0.1:0").unwrap();
    sender.send_to(b"positive", udpaddr).unwrap();
    udp.recv_from(&mut [0; 16]).unwrap();
    let local = std::env::var("LOCALAPPDATA").unwrap();
    let user = std::env::var("USERPROFILE").unwrap();
    let paths = [
        vault.clone(),
        base.join("object.obj"),
        base.join("plaintext.tmp"),
        Path::new(&user).join("Documents/PassKey-preview-probe.tmp"),
        Path::new(&local).join("Temp/PassKey-preview-probe.tmp"),
        Path::new(&local).join("Packages/PassKey-preview-probe.tmp"),
    ];
    let payload = format!(
        "{}\n{}\n{}\n{}\n{}",
        std::process::id(),
        sentinel_raw as usize,
        addr,
        udpaddr,
        paths
            .iter()
            .map(|p| p.to_string_lossy())
            .collect::<Vec<_>>()
            .join("\n")
    );
    std::fs::write(&paths[1], b"synthetic unrelated encrypted object").unwrap();
    let report = proof_run(
        Path::new(env!("CARGO_BIN_EXE_passkey-preview-probe")),
        payload.as_bytes(),
        nonce(),
        || true,
        Duration::from_secs(30),
    )
    .unwrap();
    println!("{}", &*report);
    assert!(report.starts_with("PASS:"));
    assert_eq!(std::fs::read(&vault).unwrap(), b"synthetic unrelated vault");
    assert_eq!(
        std::fs::read(&paths[1]).unwrap(),
        b"synthetic unrelated encrypted object"
    );
    for p in &paths[2..] {
        assert!(!p.exists(), "probe persisted a file");
    }
    drop(sentinel);
    std::fs::remove_dir_all(base).unwrap();
}
#[test]
fn timeout_and_cancellation_kill_the_job_promptly() {
    let probe = Path::new(env!("CARGO_BIN_EXE_passkey-preview-probe"));
    let now = Instant::now();
    assert_eq!(
        proof_run(probe, b"hang", nonce(), || true, Duration::from_millis(600)).unwrap_err(),
        Error::Timeout
    );
    assert!(now.elapsed() < Duration::from_secs(5));
    let now = Instant::now();
    assert_eq!(
        proof_run(
            probe,
            b"hang",
            nonce(),
            || now.elapsed() < Duration::from_millis(600),
            Duration::from_secs(30)
        )
        .unwrap_err(),
        Error::Cancelled
    );
    assert!(now.elapsed() < Duration::from_secs(5));
    let _ = std::io::stdout().flush();
    println!("PASS: timeout and cancellation revoke job within five seconds");
}
