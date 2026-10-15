/** Read-only production probe: public shell and one public GitHub favicon, no vault. */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { safeRaster } from '../../apps/pwa/src/favicon/image.ts';

const origin = 'https://passkeylocal.top';
const version = JSON.parse(readFileSync(new URL('../../apps/pwa/package.json', import.meta.url))).version;
const report = { version, origin, checkedAt: new Date().toISOString(), requests: [] };
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
async function probe(path, init = {}) {
  const row = { path, method: init.method ?? 'GET' };
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
          if (size > 65_536) throw new Error('response-limit');
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
    if (row.method === 'POST') row.validRaster = safeRaster(bytes);
  } catch (error) { row.error = error.name === 'TimeoutError' ? 'timeout' : 'request-failed'; }
  report.requests.push(row);
  return row;
}
const shell = await probe('/');
const method = await probe('/api/favicon');
const icon = await probe('/api/favicon', { method: 'POST', body: JSON.stringify({ domain: 'github.com' }),
  headers: { 'Content-Type': 'application/json', Origin: origin } });
report.outcome = shell.status !== 200 ? 'origin-unavailable'
  : method.status !== 405 || method.headers?.allow !== 'POST' ? 'endpoint-not-connected'
  : icon.status !== 200 || !icon.validRaster ? 'icon-request-failed' : 'passed';
writeFileSync(`cloudflare-check-${version}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.outcome === 'passed' ? 0 : 1;
