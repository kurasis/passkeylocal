use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};

struct Fixture {
    info: Vec<u8>,
    public: Vec<u8>,
    subject: Vec<u8>,
    aik: Vec<u8>,
    #[cfg(windows)]
    other_aik: Vec<u8>,
    signature: Vec<u8>,
    nonce: [u8; 32],
}
impl Fixture {
    fn new() -> Self {
        let value: serde_json::Value = serde_json::from_str(include_str!(
            "../../../../../../tests/hello/tpm-certification.json"
        ))
        .unwrap();
        let bytes = |key: &str| STANDARD.decode(value[key].as_str().unwrap()).unwrap();
        Self {
            info: bytes("certifyInfo"),
            public: bytes("publicArea"),
            subject: bytes("cngSubject"),
            aik: bytes("cngAik"),
            #[cfg(windows)]
            other_aik: bytes("cngOtherAik"),
            signature: bytes("signature"),
            nonce: bytes("nonce").try_into().unwrap(),
        }
    }
    fn inspect(&self) -> Result<UnverifiedCertification<'_>, Error> {
        inspect(
            &self.info,
            &self.signature,
            &self.public,
            &self.subject,
            &self.nonce,
        )
    }
    fn error(&self) -> Error {
        match self.inspect() {
            Err(error) => error,
            Ok(_) => panic!("Rejected fixture accepted"),
        }
    }
    fn rebind_name(&mut self) {
        self.info[105..137].copy_from_slice(&Sha256::digest(&self.public));
    }
}

#[test]
fn independent_software_impostor_is_only_an_unverified_candidate() {
    let f = Fixture::new();
    assert_eq!(f.info.len(), 173);
    assert_eq!(f.public.len(), 278);
    let parsed = f.inspect().unwrap();
    assert_eq!(
        parsed.signature_input(),
        (f.info.as_slice(), f.signature.as_slice())
    );
    // Perfectly declared TPM metadata can be fabricated by software. Parsing
    // can never enable any vault path, including direct enrollment/unlock calls.
    assert_eq!(crate::hello::readiness()["available"], false);
    assert_eq!(crate::hello::enroll().unwrap_err().code, "UNAVAILABLE");
    assert_eq!(crate::hello::unlock().unwrap_err().code, "UNAVAILABLE");
}

#[test]
fn every_truncation_is_rejected_without_panicking() {
    let f = Fixture::new();
    for size in 0..f.info.len() {
        assert!(inspect(
            &f.info[..size],
            &f.signature,
            &f.public,
            &f.subject,
            &f.nonce
        )
        .is_err());
    }
    for size in 0..f.public.len() {
        assert!(inspect(
            &f.info,
            &f.signature,
            &f.public[..size],
            &f.subject,
            &f.nonce
        )
        .is_err());
    }
    for size in 0..f.subject.len() {
        assert!(inspect(
            &f.info,
            &f.signature,
            &f.public,
            &f.subject[..size],
            &f.nonce
        )
        .is_err());
    }
    for size in 0..f.signature.len() {
        assert!(inspect(
            &f.info,
            &f.signature[..size],
            &f.public,
            &f.subject,
            &f.nonce
        )
        .is_err());
    }
}

#[test]
fn oversized_trailing_and_hostile_length_inputs_are_rejected() {
    for component in 0..4 {
        let mut f = Fixture::new();
        match component {
            0 => f.info.push(0),
            1 => f.public.push(0),
            2 => f.subject.push(0),
            _ => f.signature.push(0),
        }
        assert!(f.inspect().is_err());
    }
    let mut f = Fixture::new();
    f.info = vec![0; 1025];
    assert_eq!(f.error(), Error::Length);
    let mut f = Fixture::new();
    f.public = vec![0; 513];
    assert_eq!(f.error(), Error::Length);
    for offset in [6, 42, 101, 137] {
        let mut f = Fixture::new();
        f.info[offset..offset + 2].copy_from_slice(&u16::MAX.to_be_bytes());
        assert!(f.inspect().is_err());
    }
    let mut f = Fixture::new();
    f.public[20..22].copy_from_slice(&u16::MAX.to_be_bytes());
    assert_eq!(f.error(), Error::Length);
}

#[test]
fn incorrect_magic_tag_nonce_names_and_unsafe_clock_fail() {
    for (offset, expected) in [
        (0, Error::Format),
        (4, Error::Format),
        (44, Error::NonceMismatch),
        (105, Error::NameMismatch),
        (8, Error::UnsupportedProfile),
        (139, Error::UnsupportedProfile),
        (92, Error::UnsupportedProfile),
    ] {
        let mut f = Fixture::new();
        f.info[offset] ^= 1;
        assert_eq!(f.error(), expected);
    }
    let mut f = Fixture::new();
    f.nonce[31] ^= 1;
    assert_eq!(f.error(), Error::NonceMismatch);
}

#[test]
fn a_different_real_rsa_subject_cannot_match_the_app_key() {
    let mut f = Fixture::new();
    f.subject = f.aik.clone();
    assert_eq!(f.error(), Error::SubjectMismatch);
    let mut f = Fixture::new();
    f.public[23] ^= 1;
    f.rebind_name();
    assert_eq!(f.error(), Error::SubjectMismatch);
}

#[test]
fn migratable_imported_signing_restricted_or_reserved_templates_fail() {
    for attributes in [
        0x20072 & !2,
        0x20072 & !16,
        0x20072 & !32,
        0x20072 & !0x20000,
        0x20072 | 0x40000,
        0x20072 | 0x10000,
        0x20072 | 0x800,
        0x20072 | 1,
        0x20072 | 0x80000,
    ] {
        let mut f = Fixture::new();
        f.public[4..8].copy_from_slice(&u32::to_be_bytes(attributes));
        f.rebind_name(); // Even a correctly hashed forged template fails.
        assert_eq!(f.error(), Error::UnsupportedProfile);
    }
}

#[test]
fn unsupported_tpm_algorithms_parameters_and_policy_sizes_fail() {
    for offset in [0, 2, 10, 12, 14, 16] {
        let mut f = Fixture::new();
        f.public[offset] ^= 1;
        f.rebind_name();
        assert_eq!(f.error(), Error::UnsupportedProfile);
    }
    for size in [1, 31, 33] {
        let mut f = Fixture::new();
        let policy: Vec<_> = (size as u16)
            .to_be_bytes()
            .into_iter()
            .chain(vec![0; size])
            .collect();
        f.public.splice(8..10, policy);
        f.rebind_name();
        assert_eq!(f.error(), Error::UnsupportedProfile);
    }
}

#[test]
fn exact_public_area_hash_binds_policy_and_exponent_encoding() {
    let mut f = Fixture::new();
    f.public
        .splice(8..10, 32u16.to_be_bytes().into_iter().chain([0x55; 32]));
    assert_eq!(f.error(), Error::NameMismatch);
    f.rebind_name();
    assert!(f.inspect().is_ok()); // Still an unsigned candidate.
    f.public[10] ^= 1;
    assert_eq!(f.error(), Error::NameMismatch);
    let mut f = Fixture::new();
    f.public[16..20].copy_from_slice(&65537u32.to_be_bytes());
    assert_eq!(f.error(), Error::NameMismatch);
    f.rebind_name();
    assert!(f.inspect().is_ok());
    // A Name must hash TPMT_PUBLIC, not its TPM2B size prefix.
    let mut f = Fixture::new();
    let framed: Vec<_> = (f.public.len() as u16)
        .to_be_bytes()
        .into_iter()
        .chain(f.public.iter().copied())
        .collect();
    f.info[105..137].copy_from_slice(&Sha256::digest(framed));
    assert_eq!(f.error(), Error::NameMismatch);
}

#[test]
fn noncanonical_private_or_unsupported_cng_public_blobs_fail() {
    for offset in [0, 4, 8, 12, 16, 20, 24, 27, 282] {
        let mut f = Fixture::new();
        if offset == 27 {
            f.subject[offset] &= 0x7F;
        } else {
            f.subject[offset] ^= 1;
        }
        assert_eq!(f.error(), Error::UnsupportedProfile);
    }
}

#[cfg(windows)]
#[test]
fn actual_windows_signature_check_never_promotes_a_software_impostor() {
    let f = Fixture::new();
    let checked = f
        .inspect()
        .unwrap()
        .check_signature(&f.aik, || true)
        .unwrap();
    assert_eq!(
        checked.untrusted_certification().signature_input().0,
        f.info
    );
    assert_eq!(crate::hello::readiness()["available"], false);
    assert_eq!(crate::hello::enroll().unwrap_err().code, "UNAVAILABLE");
    assert_eq!(crate::hello::unlock().unwrap_err().code, "UNAVAILABLE");
}

#[cfg(windows)]
#[test]
fn actual_windows_rejects_bad_signatures_wrong_aik_and_signed_data_substitution() {
    let mut f = Fixture::new();
    f.signature[100] ^= 1;
    assert!(matches!(
        f.inspect().unwrap().check_signature(&f.aik, || true),
        Err(Error::Signature)
    ));
    let f = Fixture::new();
    assert!(matches!(
        f.inspect().unwrap().check_signature(&f.other_aik, || true),
        Err(Error::Signature)
    ));
    let mut f = Fixture::new();
    f.info[80] ^= 1; // Clock bytes structurally valid.
    assert!(matches!(
        f.inspect().unwrap().check_signature(&f.aik, || true),
        Err(Error::Signature)
    ));
    let mut f = Fixture::new();
    f.public
        .splice(8..10, 32u16.to_be_bytes().into_iter().chain([0x55; 32]));
    f.rebind_name();
    assert!(matches!(
        f.inspect().unwrap().check_signature(&f.aik, || true),
        Err(Error::Signature)
    ));
}

#[cfg(windows)]
#[test]
fn actual_windows_signature_work_rejects_stale_sessions_before_and_after_calls() {
    for allowed in 0..3 {
        let f = Fixture::new();
        let calls = std::cell::Cell::new(0);
        let result = f.inspect().unwrap().check_signature(&f.aik, || {
            let old = calls.get();
            calls.set(old + 1);
            old < allowed
        });
        assert!(matches!(result, Err(Error::SessionChanged)));
        assert_eq!(calls.get(), allowed + 1);
    }
}
