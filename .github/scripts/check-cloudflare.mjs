/** Read-only production probe: public shell and public GitHub/Google favicons, no vault. */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MAX_ICON_BYTES, iconDimensions, safeRaster } from '../../apps/pwa/src/favicon/image.ts';

const origin = 'https://passkeylocal.top';
const version = JSON.parse(readFileSync(new URL('../../apps/pwa/package.json', import.meta.url))).version;
const report = { version, origin, checkedAt: new Date().toISOString(), requests: [] };
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
async function probe(path, init = {}, maxBytes = 65_536) {
  const row = { path, method: init.method ?? 'GET' };
  if (row.method === 'POST') row.domain = JSON.parse(init.body).domain;
  try {
    const response = await fetch(origin + path, { ...init, redirect: 'manual',
      signal: AbortSignal.timeout(15_000), headers: { ...init.headers, 'User-Agent': 'PassKey-Local-deployment-check' } });
    row.status = response.status;
    row.headers = Object.fromEntries(['content-type', 'cache-control', 'content-security-policy', 'allow',
      'x-passkey-favicon', 'cf-ray'].map(name => [name, response.headers.get(name)]));
    const chunks = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > maxBytes) throw new Error('response-limit');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    row.bytes = size;
    row.sha256 = createHash('sha256').update(bytes).digest('hex');
    if (path === '/' && response.ok) {
      const html = new TextDecoder().decode(bytes);
      row.scripts = [...html.matchAll(/src="(\/assets\/[^"<>]+\.js)"/g)].map(m => m[1]);
    }
    if (path === '/sw.js' && response.ok) {
      const text = new TextDecoder().decode(bytes);
      row.shellVersion = /const VERSION = "([^"]+)"/.exec(text)?.[1] ?? null;
      try { row.precache = JSON.parse(/const PRECACHE = (\[[^;]+\]);/.exec(text)?.[1] ?? 'null'); } catch { row.precache = null; }
    }
    if (row.method === 'POST') { row.validRaster = safeRaster(bytes); row.dimensions = iconDimensions(bytes); }
  } catch (error) { row.error = error.name === 'TimeoutError' ? 'timeout' : 'request-failed'; }
  report.requests.push(row);
  return row;
}
const shell = await probe('/');
const worker = await probe('/sw.js');
const validManifest = Array.isArray(worker.precache) && worker.precache.length > 0 && worker.precache.length <= 100 &&
  worker.precache.every(path => typeof path === 'string' && /^(?:\/|\/(?:assets|icons)\/[a-zA-Z0-9_.-]+|\/manifest\.webmanifest)$/.test(path));
const assets = [];
if (validManifest) for (const path of worker.precache) if (path !== '/') assets.push(await probe(path, {}, 1_048_576));
const method = await probe('/api/favicon');
const icon = await probe('/api/favicon', { method: 'POST', body: JSON.stringify({ domain: 'github.com' }),
  headers: { 'Content-Type': 'application/json', Origin: origin } }, MAX_ICON_BYTES);
const google = await probe('/api/favicon', { method: 'POST', body: JSON.stringify({ domain: 'google.com' }),
  headers: { 'Content-Type': 'application/json', Origin: origin } }, MAX_ICON_BYTES);
report.outcome = shell.status !== 200 ? 'origin-unavailable'
  : worker.status !== 200 || !worker.shellVersion || !/javascript|ecmascript/.test(worker.headers?.['content-type'] ?? '') ? 'service-worker-unavailable'
  : !validManifest || assets.some(asset => asset.status !== 200 || asset.error) ? 'offline-shell-incomplete'
  : method.status !== 405 || method.headers?.allow !== 'POST' ? 'endpoint-not-connected'
  : [icon, google].some(row => row.status !== 200 || !row.validRaster) ? 'icon-request-failed' : 'passed';
writeFileSync(`cloudflare-check-${version}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.outcome === 'passed' ? 0 : 1;
