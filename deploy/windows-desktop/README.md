# Windows desktop test installers

**Current status:** installed-app smoke has not passed, so no gated installer download is available yet. The final packaging correction awaits a Windows rerun after GitHub access is restored.

Open the [Windows desktop workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml), select a successful run, and download the **PassKey-Local-Windows-x64-…-unsigned** ZIP under **Artifacts**. Sign in to the GitHub account with access to this private repository. Extract the ZIP and use `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`.

The archive contains the installer, its SHA-256 sidecar, `build.json` identifying the tested source/toolchain, the packaged-window smoke evidence and the acceptance report. Windows 11 x64 is the intended target. The build config bundles the official Evergreen x64 WebView2 offline installer; installation on a clean offline Windows machine remains an open acceptance gate. The app does not need Node or Python to run.

These are unsigned experimental test builds. Windows Hello remains unavailable until protected-key/fresh-authorization proof on real TPM/Kensington hardware is established. Use the master password. See [implementation and migration](../../docs/windows/IMPLEMENTATION.md) and [acceptance limits](../../docs/windows/ACCEPTANCE.md).

Large installers are stored as Actions artifacts with 30-day retention. To regenerate an expired build, open **Actions → Windows desktop → Run workflow** and select `main`. No production release tag is created by this workflow.

For a website hosted on Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/). The desktop installer is not a Pages deployment.
