# Windows Hello owner acceptance: one Windows account

Revision 1 — 2026-10-08. The owner explicitly excluded a second Windows account
on the same PC from the manual procedure. This plan supersedes that manual step
in older investigation notes and procedures. Do not request account creation,
account switching, administrator credentials, TPM reset or Windows Hello reset.
The account-isolation claim remains unverified; this is not a passed test or a
change to the cryptographic mechanism, native account scoping or access controls.
It does not block development of the remaining current-account scenarios.

## Report format and current decisions

Record each scenario separately as **observation / evidence / status / next action**.
Use COMPLETED (with scope), PENDING IMPLEMENTATION, NOT RUN or EXCLUDED BY OWNER;
never translate exclusion, a mock or a provider error into a hardware success.
Do not treat the diagnostic JSON's static `remaining` array as a new to-do list
for the owner. Preserve original reports and their false eligibility flags.

| Scenario | Evidence | Status | Next action |
| --- | --- | --- | --- |
| Repeated authorization and full restart | [Combined owner results](HELLO_COMBINED_RESTART.md) | COMPLETED, synthetic scope and prompting observations recorded | No repeat |
| Cancel first authorization after restart, then cleanup | [Cancellation and cleanup](HELLO_COMBINED_RESTART.md) | COMPLETED for this cancellation point | No repeat; other interruption points belong to integration |
| Delete temporary passkey and TPM key | [Key-loss result](HELLO_KEY_LOSS.md) | COMPLETED, synthetic same-process scope | No repeat |
| Copy the encrypted test file to a second PC, recheck on source, cleanup | [Correlated copy evidence](../../deploy/windows-desktop/hello-target-cdcc954-copy-evidence.json) | COMPLETED, synthetic envelope-only observation | No repeat; keys already removed |
| Second account on the same PC | No physical measurement | EXCLUDED BY OWNER from manual acceptance; isolation unverified | No owner task; keep native account scoping and automated boundary checks |
| Built-in KDBX recovery through actual temporary Hello/TPM keys | [One-button integration](HELLO_VAULT_RECOVERY.md) | COMPLETED, 27 passed stages; public synthetic KDBX, same-process | No repeat; temporary keys and journal removed |
| Master-password recovery after loss/revocation of real app-owned Hello enrollment | Production enrollment/fallback integration not yet available | PENDING IMPLEMENTATION | Implement and validate with an empty synthetic vault in the existing account before requesting one owner run |
| Password change, vault replacement, expiry, revoke, stale responses and remaining authorization negatives | [Production requirements](WINDOWS_HELLO_KENSINGTON.md) | PENDING IMPLEMENTATION / NOT RUN as applicable | Automate state, tamper and binding tests; reserve actual OS prompts for packaged owner checks |

## Completed two-computer observation

The received destination report has six passed stages, `different-installation`,
`copy-isolation-observed`, and both required keys missing. The exact TPM-open
error `0x80090016` is the expected missing key; the passkey lookup reports
`combined-credential-missing`. This is stronger than an unsupported-provider error.
The source recheck has seven passed stages, `same-account-and-installation`,
both keys opened, and `copy-source-roundtrip-passed`. SHA-256 of the uploaded
3,119-byte test file matches both reports:
`844f0313dd5a69463d1cb817d4e151857ae807a4dfaa969d1300fa6df02ebcef`.

The original `copy-exported` report was not supplied. It is not reconstructed
or marked passed. The observed destination/source pair is accepted for this
narrow experiment because the later source operation authenticates/decrypts
the exact same file; file hash alone would not suffice. No initial export/prompt
measurement or new biometric modality/count is inferred. Both reports identify
source `cdcc9542b891b808824c1ca7ce471a260ef176b5` and `processScope: not-measured`.

The subsequent cleanup report passes all four stages and ends in
`combined-cleaned` / `no-test` with `processScope: same-process`. Its purpose
`synthetic-combined-restart` is the shared cleanup command's expected schema.
No source keys remain available for another recheck; do not ask for a repeat
solely to recover the missing initial export report.

## Remaining format: current account and synthetic vault

The next implementation should exercise the real enrollment/revocation and
independent master-password path using a disposable vault in the owner's existing
account. The future packaged procedure must identify the exact build and actions,
collect one report for the sequence, and preserve original data on cancellation.
It must check correct-password recovery, wrong-password refusal, record/history
integrity, and absence of usable old Hello enrollment after app-owned key removal.
Do not delete real Hello credentials or TPM contents to simulate key loss.
The new [built-in KDBX integration experiment](HELLO_VAULT_RECOVERY.md) implements
the credential-component and temporary-key recovery sequence in an isolated worker.
It is a step toward production integration, not arbitrary user-vault enrollment;
the [owner report](../../deploy/windows-desktop/hello-target-9200a4b-vault-recovery.json)
now completes all 27 stages with two entries, one historical version and final
state `no-test`. No new prompt count or modality is inferred. Production
enrollment and its lifecycle remain separate pending work.

Continue automated checks for tampered context/vault/key binding, stale sessions,
foreign decryption rejection and missing-key/error classification. Existing
synthetic context doubles validate application logic; they do not simulate a
second Windows logon token or prove Windows account isolation. An automated
actual-account experiment, if ever added, requires its own accurate evidence;
it must not silently reinstate an owner task to switch accounts.

Real-vault Hello enrollment/unlock remains disabled until the remaining production
implementation and acceptance work is complete. The exclusion changes the owner's
manual plan, not the false eligibility flags or the protection requirements.
Full Windows-profile cloning and native private-key-container transfer are also
outside the completed envelope-only observation.
