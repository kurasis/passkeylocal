use super::{format::*, store::*};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::{fs, io::Cursor};
use zeroize::Zeroizing;

fn ok() -> crate::storage::Result<()> {
    Ok(())
}
fn object(data: &[u8]) -> (String, Version, Vec<u8>) {
    init().unwrap();
    let vault = id();
    let object = id();
    let key = random::<32>();
    let mut encrypted = Vec::new();
    let (size, hash) = encrypt_object(
        &mut Cursor::new(data),
        &mut encrypted,
        &vault,
        &object,
        &key,
        &ok,
    )
    .unwrap();
    let v = Version {
        id: id(),
        object_id: object,
        object_key: STANDARD.encode(key),
        plaintext_size: size,
        sha256: hash,
        created_at: stamp(),
        media_hint: String::new(),
    };
    (vault, v, encrypted)
}

#[test]
fn streaming_boundaries_and_authentication() {
    for size in [0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 2 * CHUNK] {
        let data = vec![0x5a; size];
        let (vault, v, encrypted) = object(&data);
        let mut plain = Vec::new();
        decrypt_object(&mut Cursor::new(&encrypted), &mut plain, &vault, &v, &ok).unwrap();
        assert_eq!(plain, data);
        for position in [0, 8, 24, 40, 64, encrypted.len() - 1] {
            let mut bad = encrypted.clone();
            bad[position] ^= 1;
            assert!(
                decrypt_object(&mut Cursor::new(bad), &mut std::io::sink(), &vault, &v, &ok)
                    .is_err()
            );
        }
        for bad in [
            &encrypted[..encrypted.len() - 1],
            &[encrypted.as_slice(), b"x"].concat(),
        ] {
            assert!(
                decrypt_object(&mut Cursor::new(bad), &mut std::io::sink(), &vault, &v, &ok)
                    .is_err()
            );
        }
        let mut wrong = v.clone();
        wrong.plaintext_size += 1;
        assert!(decrypt_object(
            &mut Cursor::new(&encrypted),
            &mut std::io::sink(),
            &vault,
            &wrong,
            &ok
        )
        .is_err());
        wrong = v.clone();
        wrong.sha256 = "0".repeat(64);
        assert!(decrypt_object(
            &mut Cursor::new(&encrypted),
            &mut std::io::sink(),
            &vault,
            &wrong,
            &ok
        )
        .is_err());
    }
}

#[test]
fn password_header_bounds_exact_utf8_and_context() {
    init().unwrap();
    let h = Head {
        format_version: 1,
        vault_id: id(),
        key_epoch_id: id(),
        snapshot_id: id(),
    };
    let root = Zeroizing::new(random::<32>());
    let password = "  пароль🔐é  ".as_bytes();
    let encrypted = write_key(&h, &root, password).unwrap();
    assert_eq!(encrypted.len(), 140);
    assert_eq!(*read_key(&encrypted, &h, password).unwrap(), *root);
    assert!(read_key(&encrypted, &h, "пароль🔐é".as_bytes()).is_err());
    let mut wrong = h.clone();
    wrong.key_epoch_id = id();
    assert!(read_key(&encrypted, &wrong, password).is_err());
    for index in [40, 44] {
        let mut b = encrypted.clone();
        b[index..index + 4].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(read_key(&b, &h, password).is_err());
    }
    assert!(write_key(&h, &root, &[255]).is_err());
    assert!(write_key(&h, &root, &[]).is_err());
    assert!(Head::parse(br#"{"format_version":1,"format_version":1}"#).is_err());
}

#[test]
fn independent_store_history_trash_rotation_backup_restore_and_cas() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let copies = temp.path().join("backups");
    fs::create_dir(&copies).unwrap();
    let mut s = SafeStore::open(&base).unwrap();
    s.create(b"first password", &ok).unwrap();
    let initial = s.list().unwrap();
    let folder = initial.folders[0].id.clone();
    let source = temp.path().join("source");
    fs::write(&source, b"first immutable content").unwrap();
    let file = s
        .import(
            &initial.snapshot_id,
            &mut open_read(&source).unwrap(),
            "document.pdf",
            &folder,
            None,
            &ok,
        )
        .unwrap();
    assert!(s
        .folder(&initial.snapshot_id, &folder, "stale", &ok)
        .is_err());
    let old_copy = s.backup_plan().unwrap().copy_to(&copies, &ok).unwrap();
    for index in 0..12 {
        fs::write(&source, format!("version {index}")).unwrap();
        s.import(
            &s.snapshot().unwrap(),
            &mut open_read(&source).unwrap(),
            "ignored",
            &folder,
            Some(&file),
            &ok,
        )
        .unwrap();
    }
    let listing = s.list().unwrap();
    assert_eq!(listing.files[0].versions.len(), 11);
    let earlier = listing.files[0].versions[0].id.clone();
    s.restore_version(&listing.snapshot_id, &file, &earlier, &ok)
        .unwrap();
    s.trash(&s.snapshot().unwrap(), &file, true, false, &ok)
        .unwrap();
    s.rotate(
        &s.snapshot().unwrap(),
        b"first password",
        b"second password",
        &ok,
    )
    .unwrap();
    let new_copy = s.backup_plan().unwrap().copy_to(&copies, &ok).unwrap();
    assert!(SafeStore::verify_package(&new_copy, b"first password", &ok).is_err());
    let (_, c) = SafeStore::verify_package(&new_copy, b"second password", &ok).unwrap();
    assert!(c.files[0].deleted);
    assert_eq!(c.files[0].versions.len(), 11);
    SafeStore::verify_package(&old_copy, b"first password", &ok).unwrap();
    s.lock();
    assert!(s.list().is_err());
    assert!(s.unlock(b"first password", &ok).is_err());
    s.unlock(b"second password", &ok).unwrap();
    let export = temp.path().join("export");
    s.export(&file, None, &export, &ok).unwrap();
    assert_eq!(fs::read(&export).unwrap(), b"version 1");
    assert!(s.export(&file, None, &export, &ok).is_err());
    s.lock();
    assert!(s.restore(&old_copy, b"first password", false, &ok).is_err());
    s.restore(&old_copy, b"first password", true, &ok).unwrap();
    assert_eq!(s.list().unwrap().files[0].versions.len(), 1);
    assert_eq!(fs::read(source).unwrap(), b"version 11");
}

#[test]
fn cancel_does_not_commit_or_publish_plaintext() {
    let temp = tempfile::tempdir().unwrap();
    let mut s = SafeStore::open(&temp.path().join("safe")).unwrap();
    s.create(b"password", &ok).unwrap();
    let l = s.list().unwrap();
    let source = temp.path().join("source");
    fs::write(&source, vec![7; CHUNK * 2]).unwrap();
    let calls = std::cell::Cell::new(0);
    let cancel = || {
        let n = calls.get() + 1;
        calls.set(n);
        if n > 2 {
            Err(crate::storage::Error::new("CANCELLED"))
        } else {
            Ok(())
        }
    };
    assert!(s
        .import(
            &l.snapshot_id,
            &mut open_read(&source).unwrap(),
            "cancel",
            &l.folders[0].id,
            None,
            &cancel
        )
        .is_err());
    assert_eq!(s.list().unwrap().snapshot_id, l.snapshot_id);
    assert!(s.list().unwrap().files.is_empty());
    let file = s
        .import(
            &l.snapshot_id,
            &mut open_read(&source).unwrap(),
            "ok",
            &l.folders[0].id,
            None,
            &ok,
        )
        .unwrap();
    let dest = temp.path().join("plain");
    assert!(s
        .export(&file, None, &dest, &|| Err(crate::storage::Error::new(
            "CANCELLED"
        )))
        .is_err());
    assert!(!dest.exists());
}

#[test]
#[ignore = "explicit 5 GiB streaming resource gate"]
fn five_gib_streaming_gate() {
    use std::io::Read;
    let temp = tempfile::tempdir().unwrap();
    init().unwrap();
    let vault = id();
    let obj = id();
    let key = random::<32>();
    let path = temp.path().join("large.obj");
    let start = std::time::Instant::now();
    let size = 5 * 1024 * 1024 * 1024u64;
    let mut source = std::io::repeat(0x5a).take(size);
    let (n, hash) = encrypt_object(
        &mut source,
        &mut new_file(&path).unwrap(),
        &vault,
        &obj,
        &key,
        &ok,
    )
    .unwrap();
    assert_eq!(n, size);
    let v = Version {
        id: id(),
        object_id: obj,
        object_key: STANDARD.encode(key),
        plaintext_size: n,
        sha256: hash,
        created_at: stamp(),
        media_hint: String::new(),
    };
    decrypt_object(
        &mut open_read(&path).unwrap(),
        &mut std::io::sink(),
        &vault,
        &v,
        &ok,
    )
    .unwrap();
    eprintln!(
        "Verified 5 GiB in {:?}; bounded 1 MiB frames",
        start.elapsed()
    );
}

#[test]
fn injected_write_boundaries_preserve_committed_or_recoverable_generations() {
    for stage in [
        "initial-key",
        "initial-catalog",
        "initial-head",
        "initial-active",
    ] {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("safe");
        let mut s = SafeStore::open(&path).unwrap();
        s.fail_at(stage);
        assert!(s.create(b"password", &ok).is_err());
        drop(s);
        let mut s = SafeStore::open(&path).unwrap();
        assert!(
            s.exists(),
            "orphan generation must not look like a fresh install"
        );
        assert!(s.create(b"different", &ok).is_err());
        if stage == "initial-active" {
            s.unlock(b"password", &ok).unwrap();
        }
    }
    for stage in [
        "object-part",
        "object-published",
        "catalog",
        "recovery-ledger",
        "head",
    ] {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("safe");
        let source = temp.path().join("source");
        fs::write(&source, b"synthetic canary").unwrap();
        let mut s = SafeStore::open(&path).unwrap();
        s.create(b"password", &ok).unwrap();
        let l = s.list().unwrap();
        s.fail_at(stage);
        assert!(s
            .import(
                &l.snapshot_id,
                &mut open_read(&source).unwrap(),
                "canary",
                &l.folders[0].id,
                None,
                &ok
            )
            .is_err());
        drop(s);
        let mut s = SafeStore::open(&path).unwrap();
        s.unlock(b"password", &ok).unwrap();
        let listing = s.list().unwrap();
        assert_eq!(listing.files.len(), usize::from(stage == "head"));
        if stage == "head" {
            let out = temp.path().join("out");
            s.export(&listing.files[0].id, None, &out, &ok).unwrap();
            assert_eq!(fs::read(out).unwrap(), b"synthetic canary");
        }
        assert_eq!(fs::read(source).unwrap(), b"synthetic canary");
    }
}

#[test]
fn independent_tokens_pagination_deadlines_and_metadata_redaction() {
    use super::manager::{Change, Mode, Query, SafeManager, Sort};
    let temp = tempfile::tempdir().unwrap();
    let safe = temp.path().join("files");
    let manager = SafeManager::open(&safe).unwrap();
    let mut password_store = crate::storage::Store::open(&temp.path().join("passwords")).unwrap();
    let password_token = password_store.begin();
    assert!(manager.check(&password_token).is_err());
    password_store
        .dispatch(&password_token, "readHead", serde_json::json!({}))
        .unwrap();
    let token = manager.access("file password".into(), true).unwrap();
    assert!(password_store
        .dispatch(&token, "readHead", serde_json::json!({}))
        .is_err());
    let q = || Query {
        folder_id: None,
        mode: Mode::Files,
        search: String::new(),
        sort: Sort::Name,
        offset: 0,
        folder_offset: 0,
        limit: 100,
    };
    let page = manager.page(&token, q()).unwrap();
    manager
        .change(
            &token,
            &page.snapshot_id,
            Change::Folder {
                parent_id: page.root_id,
                name: "private folder canary".into(),
            },
        )
        .unwrap();
    manager.interval(&token, 30_000).unwrap();
    manager.lock();
    assert!(manager.page(&token, q()).is_err());
    let status = serde_json::to_string(&manager.status().unwrap()).unwrap();
    assert!(!status.contains("private folder canary"));
    assert!(!status.contains(&token));
    let next = manager.access("file password".into(), false).unwrap();
    assert_ne!(next, token);
    assert!(manager.check(&token).is_err());
    assert_eq!(manager.page(&next, q()).unwrap().folders.len(), 1);
    drop(manager);
    assert_eq!(
        SafeManager::open(&safe)
            .unwrap()
            .status()
            .unwrap()
            .interval_ms,
        30_000
    );
}

#[test]
fn managed_retention_preserves_manual_and_unrelated_packages() {
    use super::backup::BackupQueue;
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let target = temp.path().join("backups");
    fs::create_dir(&target).unwrap();
    fs::write(target.join("unrelated"), b"keep").unwrap();
    let mut store = SafeStore::open(&base).unwrap();
    store.create(b"password", &ok).unwrap();
    let root = store.list().unwrap().folders[0].id.clone();
    let queue = BackupQueue::open(&base).unwrap();
    queue.configure(&target, 1).unwrap();
    let manual = store.backup_plan().unwrap().copy_to(&target, &ok).unwrap();
    for index in 0..3 {
        store
            .folder(
                &store.snapshot().unwrap(),
                &root,
                &format!("folder {index}"),
                &ok,
            )
            .unwrap();
        queue.enqueue(store.backup_plan().unwrap()).unwrap();
        queue.retry().unwrap();
        queue.run_due();
        assert_eq!(queue.status().unwrap().status, "ciphertext_copy_verified");
    }
    assert!(manual.exists());
    assert_eq!(fs::read(target.join("unrelated")).unwrap(), b"keep");
    assert_eq!(queue.status().unwrap().retained_packages, 1);
    // Adding an unrelated file to a tracked old package blocks pruning it.
    let tracked = fs::read_dir(&target)
        .unwrap()
        .map(|e| e.unwrap().path())
        .find(|p| p.is_dir() && p != &manual)
        .unwrap();
    fs::write(tracked.join("unrelated"), b"do not delete").unwrap();
    store
        .folder(&store.snapshot().unwrap(), &root, "fourth", &ok)
        .unwrap();
    queue.enqueue(store.backup_plan().unwrap()).unwrap();
    queue.retry().unwrap();
    queue.run_due();
    assert_eq!(queue.status().unwrap().status, "retention_blocked");
    assert!(tracked.join("unrelated").exists());
    assert!(manual.exists());
}

#[test]
fn candidate_restore_is_bound_and_corruption_preserves_current_safe() {
    use super::manager::{Mode, Query, SafeManager, Sort};
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let backup = temp.path().join("backup");
    fs::create_dir(&backup).unwrap();
    let manager = SafeManager::open(&base).unwrap();
    let token = manager.access("password".into(), true).unwrap();
    let package = manager.backup(&token, &backup).unwrap();
    let before = manager
        .page(
            &token,
            Query {
                folder_id: None,
                mode: Mode::Files,
                search: String::new(),
                sort: Sort::Name,
                offset: 0,
                folder_offset: 0,
                limit: 100,
            },
        )
        .unwrap()
        .snapshot_id;
    let candidate = manager
        .verify_candidate(&package, "password".into())
        .unwrap();
    fs::write(package.join("HEAD.json"), b"{}").unwrap();
    assert!(manager
        .restore_candidate(
            candidate["candidate"].as_str().unwrap(),
            "password".into(),
            true,
            &|| {}
        )
        .is_err());
    assert_eq!(
        manager
            .page(
                &token,
                Query {
                    folder_id: None,
                    mode: Mode::Files,
                    search: String::new(),
                    sort: Sort::Name,
                    offset: 0,
                    folder_offset: 0,
                    limit: 100
                }
            )
            .unwrap()
            .snapshot_id,
        before
    );
}

#[test]
fn frame_order_duplication_wrong_keys_and_cross_safe_substitution_fail() {
    let (vault, v, encrypted) = object(&vec![0x42; CHUNK * 2 + 1]);
    let length = CHUNK + 21;
    let mut swapped = encrypted.clone();
    swapped[64..64 + length].copy_from_slice(&encrypted[64 + length..64 + 2 * length]);
    swapped[64 + length..64 + 2 * length].copy_from_slice(&encrypted[64..64 + length]);
    assert!(decrypt_object(
        &mut Cursor::new(swapped),
        &mut std::io::sink(),
        &vault,
        &v,
        &ok
    )
    .is_err());
    let mut duplicate = encrypted.clone();
    duplicate[64 + length..64 + 2 * length].copy_from_slice(&encrypted[64..64 + length]);
    assert!(decrypt_object(
        &mut Cursor::new(duplicate),
        &mut std::io::sink(),
        &vault,
        &v,
        &ok
    )
    .is_err());
    let mut missing = encrypted.clone();
    missing.drain(64..64 + length);
    assert!(decrypt_object(
        &mut Cursor::new(missing),
        &mut std::io::sink(),
        &vault,
        &v,
        &ok
    )
    .is_err());
    assert!(decrypt_object(
        &mut Cursor::new(&encrypted),
        &mut std::io::sink(),
        &id(),
        &v,
        &ok
    )
    .is_err());
    let mut wrong = v.clone();
    wrong.object_key = STANDARD.encode(random::<32>());
    assert!(decrypt_object(
        &mut Cursor::new(encrypted),
        &mut std::io::sink(),
        &vault,
        &wrong,
        &ok
    )
    .is_err());
}

#[test]
fn pinned_old_epoch_copy_finishes_after_rotation_and_lock() {
    let temp = tempfile::tempdir().unwrap();
    let mut s = SafeStore::open(&temp.path().join("safe")).unwrap();
    s.create(b"old password", &ok).unwrap();
    let l = s.list().unwrap();
    let source = temp.path().join("source");
    fs::write(&source, b"old-epoch synthetic content").unwrap();
    s.import(
        &l.snapshot_id,
        &mut open_read(&source).unwrap(),
        "old",
        &l.folders[0].id,
        None,
        &ok,
    )
    .unwrap();
    let plan = s.backup_plan().unwrap();
    s.rotate(
        &s.snapshot().unwrap(),
        b"old password",
        b"new password",
        &ok,
    )
    .unwrap();
    s.lock();
    let destination = temp.path().join("copies");
    fs::create_dir(&destination).unwrap();
    let p = plan.copy_to(&destination, &ok).unwrap();
    SafeStore::verify_package(&p, b"old password", &ok).unwrap();
    assert!(SafeStore::verify_package(&p, b"new password", &ok).is_err());
}

#[test]
fn missing_object_restore_never_changes_current_active_generation() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let mut s = SafeStore::open(&base).unwrap();
    s.create(b"password", &ok).unwrap();
    let l = s.list().unwrap();
    let source = temp.path().join("source");
    fs::write(&source, b"source").unwrap();
    s.import(
        &l.snapshot_id,
        &mut open_read(&source).unwrap(),
        "file",
        &l.folders[0].id,
        None,
        &ok,
    )
    .unwrap();
    let copies = temp.path().join("copies");
    fs::create_dir(&copies).unwrap();
    let package = s.backup_plan().unwrap().copy_to(&copies, &ok).unwrap();
    let object = fs::read_dir(package.join("objects"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    fs::remove_file(object).unwrap();
    let before = fs::read(base.join("ACTIVE.json")).unwrap();
    assert!(s.restore(&package, b"password", true, &ok).is_err());
    assert_eq!(fs::read(base.join("ACTIVE.json")).unwrap(), before);
    assert_eq!(s.list().unwrap().files.len(), 1);
}

#[test]
fn invalid_creation_password_does_not_leave_an_orphan_generation() {
    let temp = tempfile::tempdir().unwrap();
    let mut s = SafeStore::open(&temp.path().join("safe")).unwrap();
    for pw in [&[][..], &[255][..], &vec![b'a'; 1025][..]] {
        assert!(s.create(pw, &ok).is_err());
        assert!(!s.exists());
    }
    s.create(b"valid password", &ok).unwrap();
}

#[test]
fn explicit_unlock_accepts_a_valid_reformatted_locator_then_detects_external_changes() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let mut s = SafeStore::open(&base).unwrap();
    s.create(b"password", &ok).unwrap();
    s.lock();
    let path = base.join("ACTIVE.json");
    let a: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    fs::write(&path, serde_json::to_vec_pretty(&a).unwrap()).unwrap();
    s.unlock(b"password", &ok).unwrap();
    let l = s.list().unwrap();
    fs::write(&path, serde_json::to_vec(&a).unwrap()).unwrap();
    assert!(s
        .folder(&l.snapshot_id, &l.folders[0].id, "stale", &ok)
        .is_err());
}

#[test]
fn locked_recovery_candidate_survives_periodic_cleanup_but_not_another_lock() {
    use super::manager::SafeManager;
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let copies = temp.path().join("copies");
    fs::create_dir(&copies).unwrap();
    let m = SafeManager::open(&base).unwrap();
    let token = m.access("password".into(), true).unwrap();
    let package = m.backup(&token, &copies).unwrap();
    m.lock();
    let c = m.verify_candidate(&package, "password".into()).unwrap();
    m.dispose_locked();
    m.dispose_locked();
    m.restore_candidate(
        c["candidate"].as_str().unwrap(),
        "password".into(),
        true,
        &|| {},
    )
    .unwrap();
    let c = m.verify_candidate(&package, "password".into()).unwrap();
    m.lock();
    assert!(m
        .restore_candidate(
            c["candidate"].as_str().unwrap(),
            "password".into(),
            true,
            &|| {}
        )
        .is_err());
}

#[test]
fn recovery_binds_verified_head_bytes_and_rejects_changes_during_verification() {
    use std::sync::atomic::{AtomicBool, Ordering};
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("safe");
    let mut s = SafeStore::open(&base).unwrap();
    s.create(b"password", &ok).unwrap();
    let copies = temp.path().join("copies");
    fs::create_dir(&copies).unwrap();
    let package = s.backup_plan().unwrap().copy_to(&copies, &ok).unwrap();
    let prior = fs::read(base.join("ACTIVE.json")).unwrap();
    assert!(s
        .restore_head(&package, b"password", true, Some(&"0".repeat(64)), &ok)
        .is_err());
    assert_eq!(fs::read(base.join("ACTIVE.json")).unwrap(), prior);
    let changed = AtomicBool::new(false);
    let change_head = || {
        if !changed.swap(true, Ordering::SeqCst) {
            let p = package.join("HEAD.json");
            let value: serde_json::Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
            fs::write(p, serde_json::to_vec_pretty(&value).unwrap()).unwrap();
        }
        Ok(())
    };
    assert!(SafeStore::verify_package(&package, b"password", &change_head).is_err());
    assert_eq!(fs::read(base.join("ACTIVE.json")).unwrap(), prior);
}
