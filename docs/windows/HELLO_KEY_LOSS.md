# Temporary Hello/TPM key-loss experiment

This completed target measurement extends the completed combined/restart and
cancellation/cleanup observations. It creates and destroys a **new synthetic
pair** in one command. It never reads a vault, consumes a real password,
changes Windows Hello enrollment, resets the TPM, or removes unrelated keys.

## Completed owner measurement

The [owner report](../../deploy/windows-desktop/hello-target-4b3ba34-key-loss.json)
for source `4b3ba340f684fc6adefc5b5e2a2e0295add18249` passes all 20 stages.
The exact synthetic pair passed decryption before deletion. After passkey
removal, its scoped lookup reported `combined-credential-missing`. The remaining
TPM key still reopened and matched its binding, then after deletion its exact
open returned `0x80090016` (`NTE_BAD_KEYSET`). These are expected absence controls.
Both cleanup paths, journal deletion and the final session check passed, ending
in `combined-key-loss-passed` / `no-test`.

This completes the requested physical key-loss measurement in the reported
`same-process` scope. No repeat, extra cleanup, restart or new installer is
requested. The JSON does not independently record prompt counts or biometric
modality; no new fingerprint observation is inferred. Existing owner prompting
confirmations for earlier experiments retain their original scope.

Eligibility, enrollment and unlock remain false; the original static `remaining`
list is preserved. Account/machine-copy, password recovery after key loss,
remaining authorization negatives and production lifecycle work remain open.

## Reference procedure (completed; no repeat requested)

Use the installer linked from [Windows downloads](../../deploy/windows-desktop/).
In Settings → Windows Hello choose **Test temporary key loss / Проверить потерю
временных ключей**. Allow the two Windows verifications (creation and the
positive decryption control). No restart or manual deletion is needed.

Copy its technical report. Expected successful outcome is
`combined-key-loss-passed`, purpose `synthetic-combined-key-loss`, state `no-test`,
with all 20 stages passed. `loss-tpm-reopen` retains `0x80090016`
(`NTE_BAD_KEYSET`) as the expected absence observation, not a failure hidden
from the report. Eligibility, enrollment and unlock remain false.

An existing combined experiment disables this button; finish or clean up that
experiment first. The new action never adopts or overwrites it. Cancellation
attempts cleanup automatically. If deletion fails, **Remove test and temporary
keys** remains available, including when Hello is disabled. Supply the failure
report instead of changing Windows policy or resetting Hello/TPM.

## Implementation and evidence boundaries

The fixed `hello_combined_key_loss` command takes no renderer-supplied paths,
key identities or ciphertext. It reuses focused-window validation, native
single flight, session epochs, the bounded atomic journal, the dedicated RP and
exact synthetic user selector. The journal exists before either key is created.

1. Create a new pair and pass the same actual PRF → AES-GCM → TPM OAEP → digest
   round trip that protects the synthetic random secret. This is a positive
   control for the exact identities about to be deleted, not a repeat request
   for the already completed restart procedure.
2. Persist `ready: false` before the first deliberate deletion. A crash or
   partial failure cannot offer the damaged record for a resume operation.
3. Delete the exact temporary passkey and verify absence. Reopen through the
   regular credential lookup path, clearing cached credential/creation state.
   Only an empty successful RP/user-scoped lookup is accepted as missing.
   Ambiguity, different identity, cancellation and API/policy errors fail.
4. Reopen the still-existing TPM key, checking its public identity and local
   binding as a separate positive control. Drop the previous native key and
   provider handles before every reopen.
5. Delete that key, then open the same name again with a new provider handle.
   Only `NTE_BAD_KEYSET` from `tpm-reopen-exact-test-key` passes the absence
   control. Provider-open errors, unsupported formats, permissions, cancellation
   and a successful reopen cannot count as evidence of loss.
6. Retry both cleanup paths independently, verify object absence and remove the
   journal. Check the session again before returning success. A failed cleanup
   retains the journal and never returns `combined-key-loss-passed`.

No PRF, password, random secret, native handle or credential identity is returned
in the report. The mechanism observes absence through trusted Windows APIs. It
is not a claim of physical TPM memory erasure, a silent-PRF test, a new process
measurement, cross-account/machine resistance, or password recovery after key
loss. No real enrollment exists yet, so production password-fallback acceptance
cannot be completed by this experiment. Those integration gates remain open.

Portable tests exercise successful controls, strict error classification,
existing/corrupt journal preservation, cancellation, partial deletion and
retryable cleanup. Desktop UI tests cover single flight, report display and
cleanup availability. Packaged Windows smoke invokes the new IPC only if the
hosted capability preflight is blocked, checking refusal before native key
creation and retention of the journal if absence cannot be verified (for example,
when the hosted TPM provider cannot open). This does not manufacture target
hardware evidence; the separate owner report above supplies the physical
key-loss observation for the supported target.
