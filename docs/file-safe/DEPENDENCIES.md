# Crypto/build dependency provenance

| Component | Version | Purpose / license |
| --- | --- | --- |
| libsodium-rs | 0.2.5, exact Cargo pin | Maintained upstream Rust binding, MIT. |
| libsodium-sys-stable | 1.24.0, Cargo.lock | FFI/build integration, MIT/Apache-2.0; verifies the upstream archive minisign signature. |
| libsodium | 1.0.22 | Argon2id13, XChaCha20-Poly1305, secretstream and CSPRNG; ISC. Statically linked into Windows, no runtime download. |
| hkdf | 0.12.4 | Rust HKDF-SHA-256, MIT/Apache-2.0. |
| zeroize | 1.9.0 | Best-effort native key/catalog buffer disposal, MIT/Apache-2.0. |
| PyNaCl | 1.6.2 | Independent Python libsodium primitives, Apache-2.0. |
| cryptography | 50.0.2 | Independent Python HKDF, Apache-2.0/BSD-3-Clause. |

Cargo registry checksums remain in Cargo.lock; Python platform wheel hashes remain in requirements.lock. Production Python dependency additions are exact pins; no formatter/test writer is a runtime dependency.

The verified source archive bundled in libsodium-sys-stable has SHA-256 `b20a92e7ec25b285eafa349d721a5bb27e3a8ba94c0816630a127883f1d1b3ab`; configure.ac declares 1.0.22. Windows MSVC archive `libsodium-1.0.22-stable-msvc.zip` SHA-256 `4b310d0602b6217d68b3000df19af595841ba101910af8d335096f9c45c9f36a`. GNU cross-check archive `libsodium-1.0.22-stable-mingw.tar.gz` SHA-256 `2dbb9fdb0882ec44a328b1f6a8fccbfa0bb0d0f5b1034f135e15827acaf6dba7`.

`apps/desktop/scripts/prepare-sodium.ps1` copies the original MSVC archive from `apps/desktop/build-inputs/libsodium/` and checks its hash; Cargo then independently verifies its upstream minisign signature with the binding's pinned public key. It also copies the Cargo-checksummed bundled source archive/signature into SODIUM_DIST_DIR. Signature/TLS verification is never disabled. The floating upstream stable URL changed on 2026-10-09; the repository retains the original archive hash and upstream signature, rather than accepting changed bytes. This is a build-time prerequisite, not an installer/runtime network action. Update a version/hash only after checking upstream signatures, rerunning cross-reading/adversarial/resource tests and reviewing advisories.

Upstream: <https://github.com/jedisct1/libsodium-rs>, <https://download.libsodium.org/libsodium/releases/>, <https://pynacl.readthedocs.io/>, <https://cryptography.io/>. TXT decoding now uses pinned Rust 1.90 standard-library UTF-8 in the separately bundled GPL worker, plus the existing MIT/Apache-2.0 windows-sys 0.61.2/windows-link 0.2.1 and zeroize 1.9.0 dependencies. Its independent Cargo.lock pins all three registry packages; no new third-party parser or runtime download is introduced. Rebuild with the pinned toolchain and rerun actual Windows isolation tests on updates. No PDF/image parser is bundled; their provenance/license/update obligations remain blocked.

The upstream license texts for these additions are retained in `licenses/`, installed as `file-safe-licenses` resources, and copied into the unsigned artifact/offline recovery kit. Other existing dependency notices remain covered by the repository dependency documentation.
