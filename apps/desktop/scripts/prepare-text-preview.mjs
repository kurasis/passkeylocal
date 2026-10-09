/** Build the fixed Rust TXT worker before Tauri validates/bundles its sidecar. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
if (process.platform !== 'win32') throw new Error('TXT sidecar must be built with the Windows toolchain');
const target = 'x86_64-pc-windows-msvc';
const child = spawnSync('cargo', ['build', '--locked', '--manifest-path', 'apps/desktop/text-preview/Cargo.toml', '--target', target, '--release', '--bin', 'passkey-text-worker'], { cwd: root, stdio: 'inherit' });
if (child.status !== 0) process.exit(child.status ?? 1);
const source = resolve(root, `apps/desktop/text-preview/target/${target}/release/passkey-text-worker.exe`);
const binaries = resolve(root, 'apps/desktop/src-tauri/binaries');
mkdirSync(binaries, { recursive: true });
copyFileSync(source, resolve(binaries, `passkey-text-worker-${target}.exe`));
for (const profile of ['debug', 'release']) {
  const output = resolve(root, `apps/desktop/src-tauri/target/${target}/${profile}`);
  mkdirSync(output, { recursive: true }); copyFileSync(source, resolve(output, 'passkey-text-worker.exe'));
}
