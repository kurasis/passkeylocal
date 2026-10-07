# Windows desktop test installers

Latest per-format private export diagnostic: [successful Windows run 37627304056](https://github.com/kurasis/passkeylocal/actions/runs/37627304056), [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37627304056/artifacts/11485642610). Code head `587e3c13a60d17541b9ea7f45e8c763e68b8c2e7`; tested PR merge source `946514c0dd590f703cd5398d9d39ec7c28d0491d`; merged automatically through [PR #12](https://github.com/kurasis/passkeylocal/pull/12). Actual main merge `a03f74eff94ef62d55d6afe1cbe4addf83d01a80` has the identical tested Git tree `e689cf0389fe5869e8a9152293ef903685bfede2`.

Installer SHA-256: `8ac0609e492b602014538292e28bd6dc04d775cdd408b9dfa57b5421cf68821a` (217,852,272 bytes), independently matched to the original sidecar/build metadata. [Build metadata](build-946514c.json), [installed-app evidence](smoke-946514c.json), [5 GiB measurement](file-safe-resource-946514c.json), [signed official WebView2 evidence](webview2-download-946514c.json), [Russian settings](windows-settings-946514c.png) and [locked window](windows-locked-946514c.png) are retained here. Previous artifacts/evidence remain available.

The [9fdbc05 owner report](hello-target-9fdbc05.json) passes both PKCS#1 test-secret comparisons and three explicit silent refusals. The owner reports fingerprint confirmation every time for the queried creation/first/second decrypt prompts. Cleanup passes. Private RSA export returns `0x8009000A` / `NTE_BAD_TYPE`; Microsoft documents this as the key not being exportable into that blob type. The original build stopped before the other two formats. This is owner-reported same-process behavior, not per-key TPM attestation, fresh-process/account/machine/cancellation proof or approval of legacy vault wrapping.

The [completed 946514c target report](hello-target-946514c.json) has the exact
published source identifier. All three private formats return `NTE_BAD_TYPE` /
`unsupported-format`; both decrypt comparisons, three strict silent refusals
and cleanup pass. It adds no prompt observation. The aggregate export gate
remains failed: unavailable formats do not prove non-exportability or TPM
binding. **Do not repeat this unchanged diagnostic.** There is no new installer
for this evidence-only update. The integration now needs a supported, verified
attestation path for this exact decrypt-only key; no such path is established
or implemented. See [the result and limits](../../docs/windows/HELLO_KEY_PROBE.md#all-three-target-export-formats-are-unavailable-2026-10-07)
and [the source review](../../docs/windows/SOURCES_AND_REVIEW.md#same-key-attestation-investigation-2026-10-07).

The fixed native export stage now collects RSA private, RSA full-private and PKCS#8 private results separately after unsuccessful attempts. It distinguishes explicit permission refusal, unavailable format, other failure, unexpected success and NOT RUN. Only `NTE_PERM` for every format passes the unchanged aggregate gate. An unavailable format remains unresolved even if subsequent formats return refusal. The first unresolved code/operation is retained. Success/cancellation/native session change stops later export attempts. Real bounded output buffers are zeroized; no exported material leaves the probe. Normal unconditional app test-key cleanup remains unchanged. No caller-selected key, format or ciphertext is exposed.

[General CI 37627304079](https://github.com/kurasis/passkeylocal/actions/runs/37627304079) and Windows CI passed all 11 PR checks. General CI includes 161 TypeScript tests, 18 isolated UI scenarios, eight production PWA scenarios and cross-platform independent recovery. Windows executed 48 native tests (one resource test ignored and separately executed/PASS), actual software CNG export controls, native KDBX/Python parity and full encrypted-file interop/10,000-file restore. The hosted 5 GiB gate passed in 44.216 s with sampled peak working set 10,567,680 bytes. NSIS install/packaged smoke passed; all four native modes returned source-matched reports and stopped at `device-not-present` before app-key creation. These hosted tests establish no Passport/TPM/Kensington authorization. Source correlation is provenance, not signed/hardware attestation.

**Hello vault unlock remains disabled.** Per-key TPM proof, complete fresh authorization/cancellation, fresh-process/account/machine-copy tests and the actual credential envelope/enrollment remain outstanding. Use the master password. Failed app test-key deletion is visible; retry in the same process for cleanup. Automatic crash cleanup across restarts is not implemented.

Open the artifact link while signed in to the GitHub account with access to this private repository. Extract its ZIP and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. Neither Node nor Python is required. The signed official x64 Evergreen WebView2 offline installer is included. Windows 11 x64 is the target; CI uses an elevated Windows Server host without configured Hello.

These are unsigned experimental builds. File Safe storage/recovery is implemented; preview and Hello unlock remain unavailable pending their proofs. See [the operating guide](../../docs/file-safe/OPERATING_GUIDE.md), [acceptance limits](../../docs/file-safe/ACCEPTANCE.md), [independent recovery](../../docs/file-safe/RECOVERY.md) and [release evidence](../../docs/RELEASE_EVIDENCE.md). Full feature acceptance/production release remains blocked.

Large installers are Actions artifacts with 30-day retention. To regenerate an expired build, open [Actions → Windows desktop](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) → **Run workflow** on `main`.

For Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/).
