/** Reject active formats and oversized rasters before decoding untrusted bytes. */
export const MAX_ICON_BYTES = 65_536;
export function safeRaster(bytes: Uint8Array): boolean {
  if (bytes.length < 24 || bytes.length > MAX_ICON_BYTES) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0) === 0x89504e47 && v.getUint32(4) === 0x0d0a1a0a && v.getUint32(12) === 0x49484452) {
    const w = v.getUint32(16), h = v.getUint32(20);
    return w > 0 && h > 0 && w <= 512 && h <= 512;
  }
  if (v.getUint32(0, true) !== 0x00010000) return false;
  const count = v.getUint16(4, true);
  if (!count || count > 32 || 6 + 16 * count > bytes.length) return false;
  for (let n = 0; n < count; n++) {
    const p = 6 + 16 * n, size = v.getUint32(p + 8, true), offset = v.getUint32(p + 12, true);
    if (!size || offset < 6 + 16 * count || offset + size > bytes.length) return false;
    // Embedded PNG dimensions must also agree with the bounded directory entry.
    if (size >= 24 && v.getUint32(offset) === 0x89504e47) {
      if (v.getUint32(offset + 16) !== (bytes[p] || 256) || v.getUint32(offset + 20) !== (bytes[p + 1] || 256)) return false;
    } else {
      if (size < 40 || v.getUint32(offset, true) < 40 ||
        v.getInt32(offset + 4, true) !== (bytes[p] || 256) ||
        Math.abs(v.getInt32(offset + 8, true)) !== 2 * (bytes[p + 1] || 256)) return false;
    }
  }
  return true;
}

export async function normalizeIcon(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (!safeRaster(bytes)) return null;
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth > 512 || image.naturalHeight > 512) return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const ratio = Math.min(32 / image.naturalWidth, 32 / image.naturalHeight);
    const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
    ctx.drawImage(image, (32 - w) / 2, (32 - h) / 2, w, h);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return png && png.size <= 8192 ? new Uint8Array(await png.arrayBuffer()) : null;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}
