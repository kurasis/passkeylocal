// Generates the app icons (PNG) without external tools: a rounded square with a keyhole.
// Run: node scripts/gen-icons.mjs  (outputs are committed under public/icons/)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function icon(size, { rounded }) {
  const bg = [0x1f, 0x3a, 0x5f];
  const fg = [0xf6, 0xf7, 0xf9];
  const rows = [];
  const r = rounded ? size * 0.2 : 0;
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const cx = Math.min(Math.max(x, r), size - 1 - r);
      const cy = Math.min(Math.max(y, r), size - 1 - r);
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const u = x / size - 0.5;
      const v = y / size - 0.5;
      const hole = u * u + (v + 0.08) ** 2 <= 0.11 ** 2 || (Math.abs(u) <= 0.05 + (v - 0.02) * 0.2 && v >= -0.02 && v <= 0.24);
      const c = !inside ? null : hole ? fg : bg;
      if (c) row.push(...c, 255);
      else row.push(0, 0, 0, 0);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), icon(192, { rounded: true }));
writeFileSync(new URL('icon-512.png', out), icon(512, { rounded: false }));
writeFileSync(new URL('apple-touch-icon.png', out), icon(180, { rounded: false }));
