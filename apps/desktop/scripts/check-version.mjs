import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = path => JSON.parse(read(path));
const version = json('apps/desktop/package.json').version;
assert.match(version, /^\d+\.\d+\.\d+$/, 'Use a three-part application release version');
const config = json('apps/desktop/src-tauri/tauri.conf.json');
assert.equal(json('apps/pwa/package.json').version, version, 'PWA and desktop versions must agree');
assert.equal(config.version, version, 'Tauri version must agree');
assert.equal(config.app.windows[0].title, `PassKey Local (${version})`, 'Initial native title must include the version');
assert.equal(/^version = "([^"]+)"$/m.exec(read('apps/desktop/src-tauri/Cargo.toml'))?.[1], version, 'Native package version must agree');
assert.equal(/name = "passkey-local-desktop"\r?\nversion = "([^"]+)"/.exec(read('apps/desktop/src-tauri/Cargo.lock'))?.[1], version, 'Native lock version must agree');
const lock = json('package-lock.json');
for (const target of ['desktop', 'pwa']) assert.equal(lock.packages[`apps/${target}`].version, version, `${target} npm lock version must agree`);
process.stdout.write(`${version}\n`);
