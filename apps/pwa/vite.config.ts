import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/**
 * Emits /sw.js with the exact list of build assets to precache and a version
 * derived from their contents. Hosting metadata (_headers) is not precached.
 */
function serviceWorker(): Plugin {
  return {
    name: 'passkey-local-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const publicDir = new URL('./public/', import.meta.url).pathname;
      const hash = createHash('sha256');
      // The shell is cached under '/', never '/index.html': Cloudflare Pages
      // answers '/index.html' with a redirect to '/', and a redirected
      // response cannot be used to answer a navigation.
      const assets = new Set<string>(['/']);
      for (const [fileName, item] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue;
        if (fileName !== 'index.html') assets.add(`/${fileName}`);
        hash.update(fileName);
        hash.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      for (const file of listFiles(publicDir)) {
        const rel = relative(publicDir, file).split('\\').join('/');
        if (rel === '_headers') continue;
        assets.add(`/${rel}`);
        hash.update(rel);
        hash.update(readFileSync(file));
      }
      const template = readFileSync(new URL('./src/sw/service-worker.js', import.meta.url), 'utf8');
      const code = template
        .replace("'__VERSION__'", JSON.stringify(`${pkg.version}-${hash.digest('hex').slice(0, 16)}`))
        .replace('__PRECACHE__', JSON.stringify([...assets].sort()));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    }
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { crypto: new URL('./src/worker/node-crypto-stub.ts', import.meta.url).pathname } },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Inline assets would need data: URLs, which the CSP does not allow.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false }
  }
});
