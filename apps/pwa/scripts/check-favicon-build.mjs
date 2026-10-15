/** Execute the actual compiled Pages endpoint with a synthetic upstream. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../dist/', import.meta.url);
const worker = (await import(new URL('_worker.js', root))).default;
const routes = JSON.parse(readFileSync(new URL('_routes.json', root), 'utf8'));
assert.deepEqual(routes, { version: 1, include: ['/api/favicon'], exclude: [] });
const sw = readFileSync(new URL('sw.js', root), 'utf8');
for (const name of ['_worker.js', '_routes.json', '/api/favicon']) assert(!sw.includes(name));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMIMVj1HwAEOAIuIYFLowAAAABJRU5ErkJggg==', 'base64');
const original = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push(url);
  assert.equal(init.redirect, 'manual');
  assert.equal(init.credentials, 'omit');
  return new Response(png);
};
try {
  const env = { ASSETS: { fetch: async () => new Response('synthetic shell') } };
  const response = await worker.fetch(new Request('https://vault.example.test/api/favicon', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://vault.example.test' },
    body: JSON.stringify({ domain: 'synthetic-icon-fixture.com' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.deepEqual(calls, ['https://synthetic-icon-fixture.com/favicon.ico']);
  assert.equal(await (await worker.fetch(new Request('https://vault.example.test/'), env)).text(), 'synthetic shell');
  console.log('PASS: compiled Pages favicon endpoint, fixed target, no-store, exact route, shell cache exclusion.');
} finally { globalThis.fetch = original; }
