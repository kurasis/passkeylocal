// Minimal static server for dist/ that applies public/_headers exactly as a
// Cloudflare Pages / Netlify style host would. Used by the browser tests and
// as a reference for deployment. Usage: node scripts/serve.mjs [port] [dir]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 4173);
const root = process.argv[3] ?? new URL('../dist/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.json': 'application/json'
};

export function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const i = line.indexOf(':');
      current.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

function matches(pattern, path) {
  return pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
}

const rules = parseHeaders(readFileSync(join(root, '_headers'), 'utf8'));

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  // Cloudflare Pages behaviour: '/index.html' redirects to '/', which serves it.
  if (path === '/index.html') {
    res.writeHead(308, { Location: '/' });
    res.end();
    return;
  }
  const file = normalize(join(root, path === '/' ? '/index.html' : path));
  if (!file.startsWith(normalize(root)) || path === '/_headers' || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  const headers = { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' };
  for (const r of rules) if (matches(r.pattern, path)) for (const [k, v] of r.headers) headers[k] = v;
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
