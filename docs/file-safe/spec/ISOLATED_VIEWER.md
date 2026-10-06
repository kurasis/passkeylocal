# Isolated Read-Only Viewer

## 1. Required boundary

Keep document parsing out of the main Tauri WebView and privileged Rust vault service. Use a separate native viewer worker launched into a Windows AppContainer, preferably a Less Privileged AppContainer where compatible. Apply least-privilege capabilities, explicit handle inheritance, resource limits and a kill-on-close Job Object. An ordinary Rust subprocess, browser iframe, PDF.js worker or additional Tauri window alone does not meet this requirement. [S5, S6, S7]

AppContainer and Job Objects have different purposes: access isolation versus lifecycle/resource control. A job is not a filesystem or network sandbox. Verify actual token, grants, inherited handles and child behavior on Windows; do not infer restrictions from a configuration flag.

The worker receives only one currently selected, fully authenticated document and non-sensitive render options. It receives no root/object keys, catalog, master password, Hello envelope, vault directory handle, backup directory or password-database access. Default: one preview worker at a time. Create a new worker for another document to avoid accidental data retention across selections.

If the required sandbox cannot be established, fail preview closed with a clear error. Storage and explicit export may remain available. Do not silently fall back to parsing in the main process or to opening the document in an external application. Missing isolation is a release blocker for the promised preview feature.

## 2. Supported content

| Type | Required v1 behavior |
| --- | --- |
| PDF | Read-only page rasterization using a maintained PDF engine, default candidate PDFium; page navigation, zoom and rotation. No script execution, XFA, launch actions, attachments, multimedia, form submission, links or printing. |
| JPEG and PNG | Decode within the worker, validate dimensions/decompressed resource use, display pixels; no metadata-triggered network actions or shell codecs. |
| Plain text | Strict UTF-8 with optional UTF-8 BOM, bounded decoding and inert text rendering; no HTML/Markdown interpretation, terminal control execution or link activation. |
| Everything else | Store as opaque encrypted bytes and offer explicit export; unsupported preview is an expected state, not an import failure. |

Check a bounded signature/content probe in the worker; do not trust extension or catalog media hint as parser authorization. Ambiguous/polyglot or malformed files must fail safely. SVG, HTML, Office, archives, fonts, executables, GIF/WebP/HEIC and password-protected PDFs are storage-only in v1 unless later explicitly added with their own parser tests. Never recursively unpack an archive or invoke the Windows shell preview/thumbnail infrastructure.

For PDFium, produce or select a pinned auditable build with JavaScript/V8 and XFA support disabled, and no application callbacks that execute launch/network/file actions. Verify the actual binary/build configuration; a wrapper option alone is insufficient. Record provenance, licenses and update procedure for every bundled parser. Do not download executable parser components at runtime. The engine library does not provide the host sandbox by itself. [S8]

## 3. Brokered data flow

1. The trusted UI asks for an opaque file/version ID under the current unlocked epoch. Rust checks membership, permissions, type/size eligibility and pins that immutable version.
2. Rust decrypts the selected object with bounded buffers into an anonymous memory section, authenticating every frame and checking final marker, full byte length and digest. For these bounded previews, **do not release any document bytes to a parser before whole-object verification succeeds**.
3. Freeze the input, then pass only a read-only mapping/handle with its exact verified length to the sandboxed worker through a narrowly defined broker protocol. No general read/write path or whole-vault filesystem interface.
4. The worker returns bounded raw pixel buffers or bounded text, document/page counts and sanitized errors. It cannot request arbitrary objects, paths, URLs, keys or export operations. The main process validates dimensions, byte counts, stride arithmetic, UTF-8, enums and request IDs before accepting results.
5. The UI displays validated pixel buffers through canvas/ImageData or equivalent, and text via text nodes. Do not pass original PDF/image bytes or worker-generated HTML/SVG into the privileged DOM. Avoid compressed worker output that requires another untrusted decoder in the main process.
6. On lock, cancel, viewer close or epoch mismatch, revoke pending work, terminate the entire worker job, release mappings/handles and clear preview state/caches. Late messages cannot redisplay data.

Use one per-launch IPC capability with authenticated/appropriately ACL-restricted endpoints, explicit message length limits and operation IDs. Only explicitly listed pipe/section handles are inherited; do not enable broad handle inheritance. Job assignment and restrictions must be active before untrusted document parsing starts. Prevent child-process escape and ensure parent crash/termination closes the job and terminates the worker.

A compromised worker may lie about page contents or attempt malformed IPC. The host must not grant new permissions in response. Root keys remain in the trusted Rust service; renderer isolation does not protect against a compromised host or malicious OS.

## 4. Denied access and proof obligations

No Internet/intranet/server capabilities, loopback exemptions, general filesystem grants, shell execution, clipboard, printing, camera, microphone, COM automation or registry write access. Permit only the read/execute resources needed to load the fixed worker and system/runtime libraries, plus tightly scoped inherited IPC/input/output resources. In LPAC, enumerate the minimal additional runtime permissions explicitly rather than granting broad defaults.

AppContainer profiles can have writable storage by default. Do not claim diskless operation just because the worker is sandboxed. Audit and restrict profile/TEMP access and any inherited writable handles. Test attempted writes to these locations and other user paths. If unavoidable infrastructure writes exist, document exactly what is written and prove no document plaintext is persisted by the supported path; do not advertise protection from malicious parser disk writes without enforcing it. The required security gate is that the sandboxed parser cannot persist selected document plaintext to an accessible filesystem location. If this cannot be proven for the chosen design, redesign or block preview.

Audit indirect access through named pipes, broker callbacks, shell services and allowed system objects. A network-disabled flag in a PDF library is only defense in depth; verify DNS, TCP, UDP, HTTP and loopback failures from inside a controlled sandbox probe. Check file access to a canary password vault, another file-safe object, Documents, temp locations, registry and parent-process memory. Failed access must be OS-enforced, not merely absent from normal UI code.

Use a dedicated hostile test worker to exercise granted capabilities, separate from the release parser. Do not embed a debug command interpreter or bypass switch in the production binary. Use negative tests in the actual packaged install under a standard Windows account.

## 5. Resource budgets

These are release defaults; change only with documented performance evidence and matching tests. All checks must occur before corresponding large allocation or parsing work where possible.

| Resource | Default bound |
| --- | --- |
| PDF input | 128 MiB and at most 1,000 pages; page count checked inside bounded worker |
| JPEG/PNG input | 64 MiB, at most 40 million decoded pixels and 16,384 pixels on either dimension |
| Plain-text input | 8 MiB; virtualized display with bounded line/segment rendering |
| Worker memory | 1 GiB committed-memory limit |
| Output bitmap | At most 4,096 by 4,096 RGBA pixels per response; checked multiplication and stride |
| Preview cache | At most two rendered pages and 128 MiB of pixel buffers; memory only |
| Initial parse / individual page render | 30 seconds / 10 seconds wall time, with cancellation |
| Simultaneous worker processes | One; no child processes |

A file exceeding preview limits remains safely stored/exportable. Never truncate a source file to force preview. A timeout/OOM causes a sanitized preview failure and worker termination, not a crash of the vault service or unbounded retry. Keep the trusted UI responsive and cancel promptly. Page rasterization does not provide full PDF accessibility/text selection in v1; document this limitation instead of injecting an unreviewed text/annotation layer.

## 6. Plaintext traces and user expectations

No intentional plaintext document files, persistent thumbnails, recent-document lists, HTTP cache, document telemetry, parser crash attachments or search indexes. Default previews and thumbnails are generated on demand and kept only in bounded memory. Persistent encrypted thumbnail storage can be a later feature; do not quietly cache them in the WebView profile.

The input memory section may be backed by paging, and OS/GPU memory, hibernation or crash mechanisms can retain data. Avoid application-managed dumps containing secrets, investigate whether the chosen worker can suppress relevant crash reporting, and document system-level limits. Do not turn off system diagnostics/security globally or promise forensic erasure. Full-disk encryption is complementary protection for offline access, not proof against a running compromised session.

Clear sensitive UI and window/taskbar titles on lock. Screenshot-blocking APIs, if added, are best effort and cannot stop an external camera or privileged capture. Exported files and original import sources remain outside the safe. The product must describe these boundaries plainly without claiming a virtual machine or malware-proof environment.
