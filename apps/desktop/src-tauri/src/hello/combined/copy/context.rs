//! Local comparison labels, not hardware attestation or an authorization gate.
use super::*;
use windows_sys::Win32::System::Registry::{
    RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ, RRF_SUBKEY_WOW6464KEY,
};

pub(in crate::hello::combined) fn observe(salt: &[u8; 32]) -> ProofResult<Context> {
    let sid = Zeroizing::new(crate::hello::proof::windows::current_sid()?);
    let subkey: Vec<u16> = "SOFTWARE\\Microsoft\\Cryptography\0"
        .encode_utf16()
        .collect();
    let value: Vec<u16> = "MachineGuid\0".encode_utf16().collect();
    let mut data = Zeroizing::new([0u16; 128]);
    let mut size = std::mem::size_of_val(&*data) as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            subkey.as_ptr(),
            value.as_ptr(),
            RRF_RT_REG_SZ | RRF_SUBKEY_WOW6464KEY,
            std::ptr::null_mut(),
            data.as_mut_ptr().cast(),
            &mut size,
        )
    };
    if status != 0 {
        return Err(Failure {
            status: Outcome::Failed,
            code: Some(0x80070000 | (status & 0xffff)),
            operation: Some("copy-context-machine-guid"),
        });
    }
    if size < 2 || size as usize > std::mem::size_of_val(&*data) || !size.is_multiple_of(2) {
        return Err(invalid("copy-context-machine-guid-size"));
    }
    let end = size as usize / 2 - 1;
    if data[end] != 0 || data[..end].contains(&0) {
        return Err(invalid("copy-context-machine-guid-string"));
    }
    let text = Zeroizing::new(
        String::from_utf16(&data[..end])
            .map_err(|_| invalid("copy-context-machine-guid-string"))?,
    );
    let id =
        uuid::Uuid::parse_str(&text).map_err(|_| invalid("copy-context-machine-guid-format"))?;
    if id.is_nil() {
        return Err(invalid("copy-context-machine-guid-empty"));
    }
    Ok(Context::new(salt, id.as_bytes(), sid.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_context_is_repeatable_and_salted_without_exposing_sid_or_machine_guid() {
        let a = observe(&[7; 32]).expect("local Windows process SID and MachineGuid");
        assert_eq!(a, observe(&[7; 32]).unwrap());
        assert_ne!(a, observe(&[8; 32]).unwrap());
        let encoded = serde_json::to_string(&a).unwrap();
        assert!(!encoded.contains("S-1-"));
        assert_eq!(a.relation(&a), "same-account-and-installation");
    }
}
