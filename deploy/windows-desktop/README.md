# Windows desktop test installers

Tested build with restore completion and 6 / 12 / 24 hour inactivity choices: [successful run 37430858051](https://github.com/kurasis/passkeylocal/actions/runs/37430858051), [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37430858051/artifacts/11397316873). Code head `8ee765b`; tested PR merge source `e78bcad6edee0509e536fdffe0ad9e8b1bc1ffa1`.

Installer SHA-256: `df5de92db41ebae11e0e5f60c26b1246b1000b7335dd814e720e4bf92d331b62` (217,413,328 bytes), independently verified after download. [Build metadata](build-e78bcad.json), [installed-app evidence](smoke-e78bcad.json) and [locked window](windows-locked-e78bcad.png) are retained here. Native preference values were read back after UI selection and retained after reload. Lock hashes describe Windows CRLF checkout bytes; equivalent LF files on Linux have different byte hashes.

The latest web archive additionally abbreviates Russian hour labels as `ч.`; that wording-only adjustment does not change the tested lock behavior. Previous installer metadata remains in this folder.

Open the [Windows desktop workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml), select a successful run, and download the **PassKey-Local-Windows-x64-…-unsigned** ZIP under **Artifacts**. Sign in to the GitHub account with access to this private repository. Extract the ZIP and use `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`.

The archive contains the installer, its SHA-256 sidecar, `build.json` identifying the tested source/toolchain, the packaged-window smoke evidence and the acceptance report. Windows 11 x64 is the intended target. The build config bundles the official Evergreen x64 WebView2 offline installer; installation on a clean offline Windows machine remains an open acceptance gate. The app does not need Node or Python to run.

These are unsigned experimental test builds. Windows Hello remains unavailable until protected-key/fresh-authorization proof on real TPM/Kensington hardware is established. Use the master password. See [implementation and migration](../../docs/windows/IMPLEMENTATION.md) and [acceptance limits](../../docs/windows/ACCEPTANCE.md).

Large installers are stored as Actions artifacts with 30-day retention. To regenerate an expired build, open **Actions → Windows desktop → Run workflow** and select `main`. No production release tag is created by this workflow.

For a website hosted on Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/). The desktop installer is not a Pages deployment.
