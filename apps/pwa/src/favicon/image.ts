/** Reject active formats and oversized rasters before decoding untrusted bytes. */
export const MAX_ICON_BYTES = 262_144;
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

export const MAX_CACHED_ICON_BYTES = 16_384;
export function iconDimensions(bytes: Uint8Array): { width: number; height: number; png: boolean } | null {
  if (!safeRaster(bytes)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89) return { width: v.getUint32(16), height: v.getUint32(20), png: true };
  let width = 0, height = 0;
  for (let n = 0; n < v.getUint16(4, true); n++) {
    const w = bytes[6 + 16 * n] || 256, h = bytes[7 + 16 * n] || 256;
    if (Math.min(w, h) > Math.min(width, height)) { width = w; height = h; }
  }
  return { width, height, png: false };
}

/** Force the largest ICO frame; browser decoders otherwise often choose 16/32px. */
function largestFrame(bytes: Uint8Array): Uint8Array {
  if (bytes[0] === 0x89) return bytes;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let best = 6;
  for (let p = 22; p < 6 + 16 * v.getUint16(4, true); p += 16) {
    if (Math.min(bytes[p] || 256, bytes[p + 1] || 256) > Math.min(bytes[best] || 256, bytes[best + 1] || 256)) best = p;
  }
  const length = v.getUint32(best + 8, true), offset = v.getUint32(best + 12, true);
  const frame = bytes.subarray(offset, offset + length);
  if (frame[0] === 0x89) return frame;
  const single = new Uint8Array(22 + length);
  single.set([0, 0, 1, 0, 1, 0]); single.set(bytes.subarray(best, best + 16), 6);
  new DataView(single.buffer).setUint32(18, 22, true); single.set(frame, 22);
  return single;
}

export async function normalizeIcon(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (!safeRaster(bytes)) return null;
  bytes = largestFrame(bytes);
  const type = bytes[0] === 0x89 ? 'image/png' : 'image/x-icon';
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth > 512 || image.naturalHeight > 512) return null;
    for (const maximum of [128, 96, 64, 32]) {
      const edge = Math.min(maximum, Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = edge;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const ratio = Math.min(edge / image.naturalWidth, edge / image.naturalHeight);
      const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
      ctx.drawImage(image, (edge - w) / 2, (edge - h) / 2, w, h);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (png && png.size <= MAX_CACHED_ICON_BYTES) return new Uint8Array(await png.arrayBuffer());
    }
    return null;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}
