# Windows desktop test installers

Tested build: [successful run 37424185908](https://github.com/kurasis/passkeylocal/actions/runs/37424185908), [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37424185908/artifacts/11395251579). Code head `edb9405`; tested PR merge source `e88ba87c9ac0c96a0042928b2b0240b6ece4f17a`.

Installer SHA-256: `70725fd831a40e3c1ac9f89eac90283e51e947c4caa820391207e3b28218640d` (217,415,126 bytes), independently verified after download. [Build metadata](build-e88ba87.json), [installed-app evidence](smoke-e88ba87.json) and [locked window](windows-locked-e88ba87.png) are retained here. Lock hashes describe Windows CRLF checkout bytes; equivalent LF files on Linux have different byte hashes.

Open the [Windows desktop workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml), select a successful run, and download the **PassKey-Local-Windows-x64-…-unsigned** ZIP under **Artifacts**. Sign in to the GitHub account with access to this private repository. Extract the ZIP and use `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`.

The archive contains the installer, its SHA-256 sidecar, `build.json` identifying the tested source/toolchain, the packaged-window smoke evidence and the acceptance report. Windows 11 x64 is the intended target. The build config bundles the official Evergreen x64 WebView2 offline installer; installation on a clean offline Windows machine remains an open acceptance gate. The app does not need Node or Python to run.

These are unsigned experimental test builds. Windows Hello remains unavailable until protected-key/fresh-authorization proof on real TPM/Kensington hardware is established. Use the master password. See [implementation and migration](../../docs/windows/IMPLEMENTATION.md) and [acceptance limits](../../docs/windows/ACCEPTANCE.md).

Large installers are stored as Actions artifacts with 30-day retention. To regenerate an expired build, open **Actions → Windows desktop → Run workflow** and select `main`. No production release tag is created by this workflow.

For a website hosted on Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/). The desktop installer is not a Pages deployment.
