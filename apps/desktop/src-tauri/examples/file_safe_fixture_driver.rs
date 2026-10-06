//! Synthetic interop driver; not linked into the production host or installer.
use passkey_local_desktop::file_safe::{
    format::CHUNK,
    store::{open_read, SafeStore},
};
use std::{
    fs,
    io::{self, Read},
    path::Path,
};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let command = &args[1];
    let path = Path::new(&args[2]);
    let mut password = Vec::new();
    io::stdin().read_to_end(&mut password).unwrap();
    let check = || Ok(());
    if command == "verify" {
        let (_, c) = SafeStore::verify_package(path, &password, &check).unwrap();
        println!(
            "{}",
            serde_json::json!({"files":c.files.len(), "versions":c.files.iter().map(|f|f.versions.len()).sum::<usize>(), "plaintext_bytes":c.files.iter().flat_map(|f|&f.versions).map(|v|v.plaintext_size).sum::<u64>().to_string()})
        );
    } else if command == "large-page" {
        use passkey_local_desktop::file_safe::manager::{Mode, Query, SafeManager, Sort};
        let local = path.parent().unwrap().join("large-native-store");
        let manager = SafeManager::open(&local).unwrap();
        let start = std::time::Instant::now();
        manager
            .restore(path, String::from_utf8(password.clone()).unwrap(), true)
            .unwrap();
        let restore = start.elapsed();
        let token = manager
            .access(String::from_utf8(password).unwrap(), false)
            .unwrap();
        let start = std::time::Instant::now();
        let page = manager
            .page(
                &token,
                Query {
                    folder_id: None,
                    mode: Mode::Files,
                    search: "canary 09999".into(),
                    sort: Sort::Name,
                    offset: 0,
                    folder_offset: 0,
                    limit: 100,
                },
            )
            .unwrap();
        let search = start.elapsed();
        assert_eq!(page.total, 1);
        assert_eq!(page.files.len(), 1);
        assert!(search < std::time::Duration::from_secs(2));
        println!(
            "{}",
            serde_json::json!({"files_in_fixture":10000,"restore_seconds":restore.as_secs_f64(),"search_seconds":search.as_secs_f64(),"rows_returned":page.files.len(),"status":"PASS"})
        );
    } else if command == "write" {
        fs::create_dir_all(path).unwrap();
        let mut s = SafeStore::open(&path.join("native")).unwrap();
        s.create(&password, &check).unwrap();
        let root = s.list().unwrap().folders[0].id.clone();
        let folder = s
            .folder(&s.snapshot().unwrap(), &root, "Документы é", &check)
            .unwrap();
        for (index, size) in [0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 2 * CHUNK + 19]
            .into_iter()
            .enumerate()
        {
            let source = path.join("synthetic-input");
            fs::write(&source, vec![0x40 + index as u8; size]).unwrap();
            let file = s
                .import(
                    &s.snapshot().unwrap(),
                    &mut open_read(&source).unwrap(),
                    &format!("../CON.{index}.txt"),
                    &folder,
                    None,
                    &check,
                )
                .unwrap();
            if index == 1 {
                s.import(
                    &s.snapshot().unwrap(),
                    &mut open_read(&source).unwrap(),
                    "unchanged",
                    &folder,
                    Some(&file),
                    &check,
                )
                .unwrap();
            }
            if index == 2 {
                s.trash(&s.snapshot().unwrap(), &file, true, false, &check)
                    .unwrap();
            }
            fs::remove_file(source).unwrap();
        }
        let package = s.backup_plan().unwrap().copy_to(path, &check).unwrap();
        println!("{}", package.display());
    } else {
        panic!("unknown synthetic fixture operation");
    }
}
