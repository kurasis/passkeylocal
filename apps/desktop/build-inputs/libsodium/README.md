# Original signed build input

The upstream libsodium 1.0.22 stable MSVC archive and original `.minisig` are retained byte-for-byte after the floating upstream URL changed on 2026-10-09. SHA-256: `4b310d0602b6217d68b3000df19af595841ba101910af8d335096f9c45c9f36a`. Originally obtained over HTTPS from <https://download.libsodium.org/libsodium/releases/>.

`prepare-sodium.ps1` checks this unchanged hash; locked `libsodium-sys-stable` independently verifies the original upstream signature with its pinned minisign public key before extraction. No private signing keys are included. This archive is a build input, never a runtime download. See [dependency provenance](../../../../docs/file-safe/DEPENDENCIES.md) and the installed ISC license in `licenses/`.
