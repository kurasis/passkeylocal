# Windows desktop test installers

Latest experimental encrypted File Safe build: [successful Windows run 37463813205](https://github.com/kurasis/passkeylocal/actions/runs/37463813205), [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37463813205/artifacts/11415511148). Code head `ad3a8de8bbd6e86161390f5d29690ceeb5271654`; tested PR merge source `2ebf75fbfd49291bd3cb678aada7e1167fcd3c34`.

Installer SHA-256: `a5d8e4f709cb0b8e7e59614fbf7e77b0ee0b2b5c118e1aa29c526a7f1afe199d` (217,789,444 bytes), independently verified after download. [Build metadata](build-2ebf75f.json), [installed-app evidence](smoke-2ebf75f.json), [5 GiB resource measurement](file-safe-resource-2ebf75f.json), [official WebView2 download/signature evidence](webview2-download-2ebf75f.json) and [locked window](windows-locked-2ebf75f.png) are retained here. Installed-app smoke passed for independent password/file-safe unlock, folder creation, Lock All and file-safe unlock again. Restore completion and 6 / 12 / 24 hour password-vault inactivity choices remain included. Previous installer evidence remains in this folder.

Open the artifact link above while signed in to the GitHub account with access to this private repository. Extract the ZIP and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. The app needs neither Node nor Python.

The archive contains the installer, SHA-256 sidecar, exact-source build/smoke/resource metadata, acceptance reports and crypto dependency license texts. Windows 11 x64 is the intended target; this hosted evidence is from an elevated Windows Server runner. The official Evergreen x64 WebView2 offline installer is bundled; clean offline standard-user Windows 11 installation remains an open gate. Lock hashes describe Windows CRLF checkout bytes.

These are unsigned experimental test builds. File Safe storage/recovery is implemented; preview and Windows Hello remain unavailable until the required isolation and real TPM/Kensington authorization proofs are established. Use the master password. See [file-safe operating guide](../../docs/file-safe/OPERATING_GUIDE.md), [acceptance limits](../../docs/file-safe/ACCEPTANCE.md) and [independent recovery](../../docs/file-safe/RECOVERY.md). Full feature acceptance and production release are blocked by the open gates.

Large installers are Actions artifacts with 30-day retention. To regenerate an expired build, open [Actions → Windows desktop](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) → **Run workflow** and select `main`.

For Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/).
