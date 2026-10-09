//! Narrow text-only preview protocol. Original document decoding runs in LPAC.
pub const MAX_INPUT: usize = 8 * 1024 * 1024;
pub const HEADER: usize = 32;
pub const MAGIC: &[u8; 8] = b"PKLTXT01";
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Unsupported,
    Limit,
    Sandbox,
    Cancelled,
    Timeout,
    Protocol,
}
pub type Result<T> = std::result::Result<T, Error>;

/// Strict UTF-8 plus optional BOM. Text is returned inert, never interpreted.
pub fn decode(input: &[u8]) -> Result<&str> {
    if input.len() > MAX_INPUT {
        return Err(Error::Limit);
    }
    let input = input.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(input);
    // Byte signatures cannot authorize another format via a renamed .txt.
    if [
        b"%PDF-".as_slice(),
        b"PK\x03\x04",
        b"\x89PNG",
        b"MZ",
        b"\xff\xd8\xff",
    ]
    .iter()
    .any(|s| input.starts_with(s))
    {
        return Err(Error::Unsupported);
    }
    let probe = input
        .iter()
        .take(64)
        .copied()
        .map(|b| b.to_ascii_lowercase())
        .collect::<Vec<_>>();
    let probe = probe.strip_prefix(b" ").unwrap_or(&probe);
    if [b"<!doctype html".as_slice(), b"<html", b"<svg"]
        .iter()
        .any(|prefix| probe.starts_with(prefix))
    {
        return Err(Error::Unsupported);
    }
    let text = std::str::from_utf8(input).map_err(|_| Error::Unsupported)?;
    if text
        .chars()
        .any(|c| c.is_control() && !matches!(c, '\r' | '\n' | '\t'))
    {
        return Err(Error::Unsupported);
    }
    Ok(text)
}

/// Validate the worker's bounded output, including per-launch correlation.
pub fn response<'a>(output: &'a [u8], nonce: &[u8; 16]) -> Result<&'a str> {
    if output.len() < HEADER || &output[..8] != MAGIC || &output[8..24] != nonce {
        return Err(Error::Protocol);
    }
    let status = u32::from_le_bytes(output[24..28].try_into().unwrap());
    let size = u32::from_le_bytes(output[28..32].try_into().unwrap()) as usize;
    if size > MAX_INPUT || size > output.len() - HEADER {
        return Err(Error::Protocol);
    }
    match status {
        1 => std::str::from_utf8(&output[HEADER..HEADER + size]).map_err(|_| Error::Protocol),
        2 if size == 0 => Err(Error::Unsupported),
        3 if size == 0 => Err(Error::Sandbox),
        _ => Err(Error::Protocol),
    }
}

#[cfg(windows)]
pub mod windows;
#[cfg(windows)]
pub mod worker;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn text_is_strict_bounded_and_inert() {
        assert_eq!(
            decode(b"\xef\xbb\xbfHello\r\n<script>plain text</script>").unwrap(),
            "Hello\r\n<script>plain text</script>"
        );
        assert_eq!(decode("Привет 🗂".as_bytes()).unwrap(), "Привет 🗂");
        assert_eq!(decode(b""), Ok(""));
        for bad in [
            b"\xff".as_slice(),
            b"bad\0text",
            b"\x1b[31m",
            b"%PDF-1.7",
            b"MZbinary",
            b"PK\x03\x04zip",
            b"<!DOCTYPE html>",
            b"<svg xmlns=\"x\">",
        ] {
            assert_eq!(decode(bad), Err(Error::Unsupported));
        }
        assert_eq!(decode(&vec![b'a'; MAX_INPUT + 1]), Err(Error::Limit));
        assert_eq!(decode(&vec![b'a'; MAX_INPUT]).unwrap().len(), MAX_INPUT);
    }
    #[test]
    fn hostile_output_cannot_change_nonce_status_or_length() {
        let nonce = [7; 16];
        let mut bytes = vec![0; HEADER + 2];
        bytes[..8].copy_from_slice(MAGIC);
        bytes[8..24].copy_from_slice(&nonce);
        bytes[24..28].copy_from_slice(&1u32.to_le_bytes());
        bytes[28..32].copy_from_slice(&2u32.to_le_bytes());
        bytes[32..].copy_from_slice(b"ok");
        assert_eq!(response(&bytes, &nonce), Ok("ok"));
        assert_eq!(response(&bytes, &[8; 16]), Err(Error::Protocol));
        bytes[28..32].copy_from_slice(&u32::MAX.to_le_bytes());
        assert_eq!(response(&bytes, &nonce), Err(Error::Protocol));
        bytes[28..32].copy_from_slice(&2u32.to_le_bytes());
        bytes[32] = 0xff;
        assert_eq!(response(&bytes, &nonce), Err(Error::Protocol));
        bytes[24..28].copy_from_slice(&99u32.to_le_bytes());
        assert_eq!(response(&bytes, &nonce), Err(Error::Protocol));
    }
}
