//! Release worker: fixed section handles, UTF-8 decoding, inert text only.
use crate::{
    windows::{token_is_lpac, Handle, View},
    Error, Result, HEADER, MAGIC, MAX_INPUT,
};
use windows_sys::Win32::{
    Foundation::HANDLE,
    System::{
        Memory::{FILE_MAP_READ, FILE_MAP_WRITE},
        Threading::GetCurrentProcess,
    },
};
use zeroize::Zeroizing;
pub fn serve(render: impl FnOnce(&[u8]) -> Result<String>) -> Result<()> {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    if arguments.len() != 3 {
        return Err(Error::Protocol);
    }
    let numbers = arguments
        .iter()
        .map(|a| a.parse::<usize>().map_err(|_| Error::Protocol))
        .collect::<Result<Vec<_>>>()?;
    let len = numbers[2];
    if !(HEADER..=HEADER + MAX_INPUT).contains(&len) {
        return Err(Error::Limit);
    }
    let input_handle = Handle::new(numbers[0] as HANDLE)?;
    let output_handle = Handle::new(numbers[1] as HANDLE)?;
    let input = View::new(input_handle.0, FILE_MAP_READ, len)?;
    let mut output = View::new(
        output_handle.0,
        FILE_MAP_READ | FILE_MAP_WRITE,
        HEADER + MAX_INPUT,
    )?;
    let bytes = input.bytes();
    if &bytes[..8] != MAGIC
        || u64::from_le_bytes(bytes[24..32].try_into().unwrap()) != (len - HEADER) as u64
    {
        return Err(Error::Protocol);
    }
    let out = output.bytes_mut();
    out[..8].copy_from_slice(MAGIC);
    out[8..24].copy_from_slice(&bytes[8..24]);
    let result = if token_is_lpac(unsafe { GetCurrentProcess() })? {
        render(&bytes[HEADER..])
    } else {
        Err(Error::Sandbox)
    };
    let status = match result {
        Ok(text) if text.len() <= MAX_INPUT => {
            let text = Zeroizing::new(text);
            out[HEADER..HEADER + text.len()].copy_from_slice(text.as_bytes());
            out[28..32].copy_from_slice(&(text.len() as u32).to_le_bytes());
            1u32
        }
        Err(Error::Unsupported) => 2,
        _ => 3,
    };
    out[24..28].copy_from_slice(&status.to_le_bytes());
    Ok(())
}
