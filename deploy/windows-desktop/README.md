# Windows desktop test installers

Latest protected-key experiment build: [successful Windows run 37585002476](https://github.com/kurasis/passkeylocal/actions/runs/37585002476), [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37585002476/artifacts/11467575895). Code head `cac0f40e750bcfffc926abc23ba7e2eee69b0f9b`; tested PR merge source `3fc5c57fcb57815030ce489ff05952ce7fe62293`; merged through [PR #5](https://github.com/kurasis/passkeylocal/pull/5). Main merge `2c8955490944fb3514bf33b5f424679177f111c6` has the identical tested Git tree.

Installer SHA-256: `ce02dea783c5c4c53721cf43a58656907e3d34c219c8a1016833a94439e45409` (217,831,045 bytes), independently verified after download. [Build metadata](build-3fc5c57.json), [installed-app evidence](smoke-3fc5c57.json), [5 GiB measurement](file-safe-resource-3fc5c57.json), [official WebView2 signature evidence](webview2-download-3fc5c57.json), [Russian settings screenshot](windows-settings-3fc5c57.png) and [locked window](windows-locked-3fc5c57.png) are retained here. All previous evidence remains in the folder.

Final general and Windows CI passed: 161 TypeScript tests; nine isolated UI scenarios; eight PWA e2e scenarios; 39 Windows native tests plus the separately run 5 GiB resource gate; independent recovery (88 passed / 15 skipped). Installed-app smoke verifies the actual new proof IPC stops before key creation on the hosted machine, which reports `device-not-present`. This is not a successful protected-key unwrap or physical TPM/Kensington test.

Post-merge duplicate CI runs were blocked before any steps by GitHub account billing (payment failure or spending limit; GitHub does not distinguish these in its annotation). The successful exact-tree PR runs above tested this installer. Downloads remain available. Future CI runs require the owner to check [GitHub Billing & plans](https://github.com/settings/billing); no billing settings were changed here.

The latest build adds **Test protected key** in Settings → Windows Hello. It runs real Microsoft Passport CNG encryption/decryption of a separate random test secret, measures silent-decrypt/private-export rejection and attempts to delete its app-owned test key. The report identifies the exact failed stage/code and can be copied with **Copy test report**. See the [test procedure](../../docs/windows/HELLO_KEY_PROBE.md).

**Hello vault unlock is still disabled.** The key experiment is the next required proof step; per-key TPM attestation, observed fresh prompts, fresh-process and account/machine-copy tests remain open, as do the actual credential envelope and enrollment. Continue unlocking with the master password. The owner's Windows 11 Pro 25H2 and Kensington VeriMark Desktop are reported target details, not evidence from the hosted runner.

To collect results on that computer: install this build, open Settings → Windows Hello, click **Test protected key**, note whether both decryptions request confirmation, then copy the report. No passwords, key names, account identifiers, biometric data or key material appear in it. A failed test-key deletion is visible; retry the test in the same process for cleanup. Crash cleanup across process restarts is not implemented.

Open the artifact link while signed in to the GitHub account with access to this private repository. Extract the ZIP and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. The app needs neither Node nor Python. The official Evergreen x64 WebView2 offline installer is included. Windows 11 x64 is the target; CI uses an elevated Windows Server host with no configured Hello device.

These are unsigned experimental builds. File Safe storage/recovery is implemented; preview and Hello vault unlock remain unavailable until their required proofs are established. See [file-safe operating guide](../../docs/file-safe/OPERATING_GUIDE.md), [acceptance limits](../../docs/file-safe/ACCEPTANCE.md) and [independent recovery](../../docs/file-safe/RECOVERY.md). Full feature acceptance and production release remain blocked.

Large installers are Actions artifacts with 30-day retention. To regenerate an expired build, open [Actions → Windows desktop](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) → **Run workflow** and select `main`.

For Cloudflare Pages, use the separate [web upload ZIP](../cloudflare-pages/).
