# Isolated TXT preview

Click a `.txt` file, select **Preview TXT / Предпросмотр TXT** from its right-click
menu, or use the preview button in file details. The read-only panel supports
keyboard scrolling, text size, **Close preview**, Escape and immediate safe lock.
The same interface uses Colorful, Light and Dark. Text is never interpreted as
HTML/Markdown, a command or an active link. Files using another encoding or larger
than 8 MiB remain stored/exportable. Supported input is strict UTF-8, with an
optional UTF-8 BOM. Binary signatures, HTML/SVG document prefixes and disallowed
control characters fail closed. PDF/images and other formats remain storage-only.

## Native boundary

`file_safe_preview` is a focused-main-window-only fixed command. Read admits one
opaque request under the safe's current token and immutable snapshot. File/version
membership, extension and size are checked natively. Secretstream decryption
checks every frame, final marker, complete size and digest into bounded zeroizing
memory. No original document reaches a parser before complete authentication.
Keys/catalog/passwords/paths never enter the worker. Cancel tickets reject late
admission; lock/session checks also revoke pending work. No export dialog, external
application, file path or plaintext temp fallback is used.

The separately built Rust worker uses only strict UTF-8 decoding. A fresh CSPRNG
nonce derives a unique **LPAC SID without a storage profile**: the package identity is registered through the same KernelBase entry points used by Chromium,
then unregistered on exit. This is separate from creating profile directories;
`CreateAppContainerProfile` and storage grants are not used. Missing APIs fail closed. A temporary RX grant applies only to the fixed worker
executable and is revoked without replacing unrelated ACL entries. There are no
capabilities, profile/directory/network/registry grants or inherited environment
secrets. Current directory is the Windows system directory; required Windows profile
variables and TEMP/TMP point to a
nonexistent inaccessible child. Normal runtime DLL reads remain OS-controlled.

An explicit handle list contains only a frozen read-only anonymous input section
and a bounded output section. The host closes its writable input handle/view before
launch. The process belongs to a kill-on-close job **at creation**, starts suspended
and resumes only after actual AppContainer/zero-capability token readback and a behavioral LPAC AccessCheck.
The latter must grant the restricted-packages bit and deny the ordinary
ALL_APPLICATION_PACKAGES bit using the actual token; no flag-only inference.
Child creation is prohibited, the job allows one process, committed memory is
limited to 256 MiB and UI access including clipboard is restricted. Text needs a
smaller budget than the original 1 GiB multi-parser maximum; no PDF/image decoder
is bundled. Timeout is 30 seconds; revocation is checked every 20 ms while waiting.

Output is an exact-length memory protocol with magic, per-launch nonce, status and
bounded UTF-8. The trusted broker validates every field and accepts no worker HTML,
paths, URLs or requests. UI renders at most 24 inert text segments, indexing lines
with bounded typed offsets and explicit 20,000-segment sections, keeping physical
scroll height below browser limits even for 8 MiB of empty lines. A section number
can jump to any remaining content; the source is not truncated. Long lines split without splitting surrogate
pairs. Close/lock/module change discard state and cancel the ticket; late results
cannot reappear. Plaintext strings/sections may still be retained by OS paging,
hibernation, GPU, dumps or a compromised host; no forensic erasure is promised.
The supported path creates no intentional document file/cache/index/thumbnail.

## Verification and limits

`apps/desktop/text-preview` has strict decoder/protocol tests, an unbundled hostile
worker behind the `proof` feature and actual Windows LPAC integration tests. The
Windows workflow builds/proves the exact release TXT worker before Tauri packaging.
The hostile executable is never installed and the production worker has no debug
command interpreter. Tests use synthetic canaries and a fresh registered SID without a storage profile.

Hosted proof checks token/capabilities, input write denial, absent nonlisted
inheritable handle, unrelated file/profile/TEMP/registry/parent-memory/clipboard
access, TCP/UDP/DNS-port/loopback denial, parent loopback positive controls, child
execution, memory allocation and timeout/cancellation. Installed smoke matches the
worker digest, reads a production-authenticated synthetic file through the actual
native broker, verifies inert UTF-8 UI, context rename and lock redaction. Original
metadata/screenshots are published only after that exact source passes CI.

This is experimental text-only acceptance. Clean offline standard-user installed
hostile probing, exhaustive named-pipe/COM/service-broker and WER/paging traces,
parent/worker crash matrix and physical suspend/user-switch cases remain separately
unverified. These are not claimed passed by a UI double or by hosted administrator
results. Full original multi-format viewer acceptance remains incomplete. See
[acceptance](ACCEPTANCE.md) and [release evidence](../RELEASE_EVIDENCE.md).

References: Microsoft [AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation),
[process attributes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute),
[derive AppContainer SID](https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-deriveappcontainersidfromappcontainername),
[job objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects),
[GetTokenInformation](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation).
