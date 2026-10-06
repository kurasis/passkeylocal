# Windows desktop test installers

Latest desktop layout and Windows Hello diagnostics build: [successful Windows run 37492302591](https://github.com/kurasis/passkeylocal/actions/runs/37492302591), [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37492302591/artifacts/11426914631). Code head `92593791fa16a2397ad3c3c28be8ab34f97abe03`; tested PR merge source `b5557267e43ada24bb98f82fdb593bc0c9023164`; merged through [PR #4](https://github.com/kurasis/passkeylocal/pull/4).

Installer SHA-256: `950e244662055a5b885b01356e74b644169ec6f2f9bc6d0d7f3499a49450bd3d` (217,811,037 bytes), independently verified after download. [Build metadata](build-b555726.json), [installed-app evidence](smoke-b555726.json), [5 GiB measurement](file-safe-resource-b555726.json), [official WebView2 download/signature evidence](webview2-download-b555726.json), [Russian Hello settings](windows-settings-b555726.png) and [locked window](windows-locked-b555726.png) are retained here. Previous installer evidence remains in this folder.

Russian module buttons and sidebar now occupy separate rows/columns without overlap. In **Settings → Windows Hello**, the app checks actual Windows configuration and offers **Check Windows Hello**, **Test fingerprint or PIN** and **Windows sign-in settings**. The system test is enabled only when Windows reports availability. It verifies OS consent only: **Hello vault unlocking is not implemented** and still requires a proved protected-key provider. Continue unlocking with the master password. The hosted Windows machine correctly reported `device-not-present`; actual fingerprint/PIN consent and physical TPM/Kensington support were not exercised.

The installed-app smoke also passed independent password/file-safe unlock, folder creation, Lock All, password re-unlock, native KDBX save and 6 / 12 / 24 hour inactivity preference persistence. Both production frontend builds, seven isolated UI scenarios, eight web e2e tests, Windows native tests and independent recovery checks pass for this change.

Open the artifact link above while signed in to the GitHub account with access to this private repository. Extract the ZIP and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. The app needs neither Node nor Python.

The archive contains the installer, SHA-256 sidecar, exact-source build/smoke/resource metadata, acceptance reports and crypto dependency license texts. Windows 11 x64 is the intended target; this hosted evidence is from an elevated Windows Server runner. The official Evergreen x64 WebView2 offline installer is bundled; clean offline standard-user Windows 11 installation remains an open gate. Lock hashes describe Windows CRLF checkout bytes.

These are unsigned experimental test builds. File Safe storage/recovery is implemented; preview and Windows Hello vault unlocking remain unavailable until the required isolation and real TPM/provider authorization proofs are established. Hello configuration and diagnostic actions are implemented. Use the master password. See [file-safe operating guide](../../docs/file-safe/OPERATING_GUIDE.md), [acceptance limits](../../docs/file-safe/ACCEPTANCE.md) and [independent recovery](../../docs/file-safe/RECOVERY.md). Full feature acceptance and production release are blocked by the open gates.

Large installers are Actions artifacts with 30-day retention. To regenerate an expired build, open [Actions → Windows desktop](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) → **Run workflow** and select `main`.

For Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/).
