//! No protected-secret provider is eligible until the real-key proof succeeds.
//! A consent boolean or a generic TPM-present check cannot establish that proof.
use crate::storage::{Error, Result};
use serde_json::{json, Value};

pub mod attestation;

#[cfg(any(windows, test))]
pub mod tpm;

#[cfg(any(windows, test))]
pub mod prf;

#[cfg(any(windows, test))]
pub mod proof;

#[cfg(windows)]
static AUTHENTICATING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[cfg(windows)]
pub(crate) struct Attempt;
#[cfg(windows)]
impl Attempt {
    pub(crate) fn begin() -> Result<Self> {
        use std::sync::atomic::Ordering;
        AUTHENTICATING
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| Error::new("BUSY"))?;
        Ok(Self)
    }
}
#[cfg(windows)]
impl Drop for Attempt {
    fn drop(&mut self) {
        AUTHENTICATING.store(false, std::sync::atomic::Ordering::Release);
    }
}

pub fn readiness() -> Value {
    json!({"available": false, "reason": "protected-key-proof-required", "enrolled": false,
        "helloConfiguration": "not-probed", "perKeyTpmEvidence": "not-verified",
        "perOperationAuthorization": "not-verified", "kensington": "not-tested",
        "ess": "not-probed", "mode": "off"})
}
pub fn enroll() -> Result<Value> {
    Err(Error::new("UNAVAILABLE"))
}
pub fn unlock() -> Result<Value> {
    Err(Error::new("UNAVAILABLE"))
}
pub fn revoke() -> Result<Value> {
    Ok(json!({"enrolled": false, "keyDeletion": "no-enrollment-key-created"}))
}

/// Configuration and consent diagnostics are deliberately independent of
/// protected-secret eligibility. Even successful consent never enables unwrap.
#[cfg(windows)]
pub mod diagnostics {
    use super::*;
    use windows::{
        Security::Credentials::UI::{UserConsentVerificationResult, UserConsentVerifier},
        Win32::{
            Foundation::HWND,
            System::WinRT::{
                IUserConsentVerifierInterop, RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED,
            },
        },
    };
    use windows_core::HSTRING;

    struct Apartment;
    impl Apartment {
        fn new() -> Result<Self> {
            unsafe { RoInitialize(RO_INIT_MULTITHREADED) }
                .map_err(|_| Error::new("UNAVAILABLE"))?;
            Ok(Self)
        }
    }
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe { RoUninitialize() };
        }
    }
    pub fn check() -> Value {
        let configuration = (|| {
            let _apartment = Apartment::new()?;
            let result = UserConsentVerifier::CheckAvailabilityAsync()
                .and_then(|operation| operation.join())
                .map_err(|_| Error::new("UNAVAILABLE"))?;
            Ok::<_, Error>(super::configuration_name(result.0))
        })()
        .unwrap_or("unknown");
        let mut report = readiness();
        report["helloConfiguration"] = json!(configuration);
        report
    }

    /// A diagnostic OS prompt only. It has no password, envelope or key access.
    /// The text is fixed natively and the HWND comes from the trusted host.
    pub fn verify(hwnd: usize) -> Result<Value> {
        let _attempt = super::Attempt::begin()?;
        let _apartment = Apartment::new()?;
        let interop: IUserConsentVerifierInterop =
            windows_core::factory::<UserConsentVerifier, IUserConsentVerifierInterop>()
                .map_err(|_| Error::new("UNAVAILABLE"))?;
        let operation: windows_future::IAsyncOperation<UserConsentVerificationResult> = unsafe {
            interop.RequestVerificationForWindowAsync(HWND(hwnd as *mut _), &HSTRING::from(
                "PassKey Local: test Windows Hello only. This does not unlock a vault. / Проверка Windows Hello. Хранилище не разблокируется."
            ))
        }.map_err(|_| Error::new("UNAVAILABLE"))?;
        let result = operation.join().map_err(|_| Error::new("UNAVAILABLE"))?;
        Ok(
            json!({"result": super::verification_name(result.0), "purpose": "diagnostic-only", "unlocked": false, "enrolled": false}),
        )
    }
}

#[cfg(any(windows, test))]
fn configuration_name(value: i32) -> &'static str {
    match value {
        0 => "available",
        1 => "device-not-present",
        2 => "not-configured",
        3 => "disabled-by-policy",
        4 => "device-busy",
        _ => "unknown",
    }
}
#[cfg(any(windows, test))]
fn verification_name(value: i32) -> &'static str {
    match value {
        0 => "verified",
        1 => "device-not-present",
        2 => "not-configured",
        3 => "disabled-by-policy",
        4 => "device-busy",
        5 => "retries-exhausted",
        6 => "cancelled",
        _ => "unknown",
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn diagnostic_results_never_conflate_configuration_and_unlock_eligibility() {
        assert_eq!(super::configuration_name(0), "available");
        assert_eq!(super::configuration_name(3), "disabled-by-policy");
        assert_eq!(super::configuration_name(99), "unknown");
        assert_eq!(super::verification_name(0), "verified");
        assert_eq!(super::verification_name(6), "cancelled");
        assert_eq!(super::verification_name(99), "unknown");
        assert_eq!(super::readiness()["available"], false);
    }
    #[test]
    fn consent_or_renderer_state_cannot_enable_an_unproved_provider() {
        assert_eq!(super::readiness()["available"], false);
        for _ in 0..3 {
            assert_eq!(super::enroll().unwrap_err().code, "UNAVAILABLE");
            assert_eq!(super::unlock().unwrap_err().code, "UNAVAILABLE");
        }
        assert_eq!(super::revoke().unwrap()["enrolled"], false);
    }
}
