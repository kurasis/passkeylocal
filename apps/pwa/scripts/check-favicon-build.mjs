/** Execute the actual compiled Pages endpoint with a synthetic upstream. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../dist/', import.meta.url);
const source = readFileSync(new URL('_worker.js', root), 'utf8');
assert(!/node:|__vite-browser-external/.test(source), 'Worker must not require Node compatibility');
const worker = (await import(new URL('_worker.js', root))).default;
const routes = JSON.parse(readFileSync(new URL('_routes.json', root), 'utf8'));
assert.deepEqual(routes, { version: 1, include: ['/api/favicon'], exclude: [] });
const sw = readFileSync(new URL('sw.js', root), 'utf8');
for (const name of ['_worker.js', '_routes.json', '/api/favicon']) assert(!sw.includes(name));
const png = readFileSync(new URL('../../../tests/fixtures/icons/retina-192.png', import.meta.url));
const original = globalThis.fetch;
const calls = [];
const request = () => new Request('https://vault.example.test/api/favicon', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://vault.example.test' },
  body: JSON.stringify({ domain: 'synthetic-icon-fixture.com' })
});
try {
  const env = { ASSETS: { fetch: async () => new Response('synthetic shell') } };
  globalThis.fetch = async (url, init) => {
    calls.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    if (url === 'https://synthetic-icon-fixture.com/') return new Response(null, { status: 301, headers: { Location: 'https://www.synthetic-icon-fixture.com/' } });
    if (url === 'https://www.synthetic-icon-fixture.com/') return new Response('<link rel="icon" type="image/png" sizes="192x192" href="https://cdn.synthetic-icon-fixture.com/retina.png">');
    assert.equal(url, 'https://cdn.synthetic-icon-fixture.com/retina.png');
    return new Response(png);
  };
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('X-PassKey-Icon-Width'), '192');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.deepEqual(calls, ['https://synthetic-icon-fixture.com/', 'https://www.synthetic-icon-fixture.com/', 'https://cdn.synthetic-icon-fixture.com/retina.png']);
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const missing = await worker.fetch(request(), env);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('X-PassKey-Favicon'), 'missing');
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const outage = await worker.fetch(request(), env);
  assert.equal(outage.status, 503);
  assert.equal(outage.headers.has('X-PassKey-Favicon'), false);
  assert.equal(outage.headers.get('cache-control'), 'no-store');
  assert.equal(await (await worker.fetch(new Request('https://vault.example.test/'), env)).text(), 'synthetic shell');
  console.log('PASS: compiled Worker, canonical page/CDN PNG discovery, exact raster/size, no Node imports, miss/outage distinction, no-store, route and precache isolation.');
} finally { globalThis.fetch = original; }
