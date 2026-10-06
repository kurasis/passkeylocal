//! No protected-secret provider is eligible until the real-key proof succeeds.
//! A consent boolean or a generic TPM-present check cannot establish that proof.
use crate::storage::{Error, Result};
use serde_json::{json, Value};

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
    Ok(json!({"enrolled": false, "keyDeletion": "no-app-key-created"}))
}

#[cfg(test)]
mod tests {
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
