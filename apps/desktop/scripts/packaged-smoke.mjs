/** Windows-only CI test of real packaged assets/WebView2/IPC/worker/KDBX.
 * Debugging is enabled only by this test process's WebView2 environment;
 * no test provider, debug server or driver is installed with the product.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { openVault, listEntries } from '@passkey-local/vault-adapter';

assert.equal(process.platform, 'win32');
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run only on an ephemeral GitHub-hosted Windows runner');
const data = join(process.env.LOCALAPPDATA, 'com.passkeylocal.vault');
assert(!existsSync(join(data, 'current.kdbx')), 'Smoke must not use an existing user vault');
const exe = resolve('apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/passkey-local-desktop.exe');
const password = 'synthetic-Windows-smoke-2026-🔑';
const child = spawn(exe, [], { env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222' }, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1000 }); break; }
    catch { if (child.exitCode !== null) throw new Error('Packaged host exited before readiness'); await new Promise((r) => setTimeout(r, 1000)); }
  }
  assert(browser, 'Packaged WebView2 debugging endpoint must start');
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? await context.waitForEvent('page');
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', () => errors.push('pageerror'));
  let foreignRequests = 0;
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['tauri.localhost', 'ipc.localhost', 'localhost', '127.0.0.1'].includes(url.hostname) || url.protocol === 'tauri:') return route.continue();
    foreignRequests++; return route.abort();
  });
  await page.getByRole('button', { name: 'Create a new vault', exact: true }).click();
  await page.getByLabel('Master password', { exact: true }).fill(password);
  await page.getByLabel('Repeat master password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create a new vault', exact: true }).click();
  await page.getByTestId('verify-file').waitFor();
  // Isolate editor smoke from native-dialog automation: a normal nonsensitive
  // preference is set through the real permitted API, then the app reloads locked.
  await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const token = await invoke('session_begin');
    await invoke('storage', { token, operation: 'setPreference', args: { key: 'onboardingBackupVerified', value: true } });
    await invoke('session_end', { token });
  });
  await page.reload();
  await page.getByLabel('Master password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Synthetic Windows smoke');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('synthetic-user');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-entry-secret');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('heading', { name: 'Synthetic Windows smoke', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await page.getByLabel('Master password', { exact: true }).waitFor();
  assert(!await page.getByRole('heading', { name: 'Synthetic Windows smoke', exact: true }).count());
  const helloDenied = await page.evaluate(async () => {
    try { await window.__TAURI_INTERNALS__.invoke('hello_unlock'); return false; } catch { return true; }
  });
  assert(helloDenied, 'Unproved Hello provider cannot yield secrets');
  const saved = new Uint8Array(await readFile(join(data, 'current.kdbx')));
  const opened = await openVault(saved, password);
  assert.equal(listEntries(opened.db).filter((e) => !e.inRecycleBin).length, 1);
  assert.equal(errors.length, 0, 'Packaged UI has no page error');
  assert.equal(foreignRequests, 0, 'No remote application asset or service requested');
  await mkdir('apps/desktop/artifacts', { recursive: true });
  await page.screenshot({ path: 'apps/desktop/artifacts/windows-locked-smoke.png' });
  await writeFile('apps/desktop/artifacts/packaged-smoke.json', JSON.stringify({
    sourceCommit: process.env.GITHUB_SHA, runtime: await page.evaluate(() => navigator.userAgent),
    fixture: 'synthetic fresh vault with one entry', status: 'PASS',
    evidence: ['packaged asset origin', 'React UI', 'real Tauri IPC and revocable session', 'crypto worker/Argon2 WASM', 'native KDBX save', 'password lock and fallback', 'unproved Hello denied', 'no foreign requests'],
    limits: ['native dialogs not automated', 'clean-machine installer not exercised', 'physical offline/TPM/Kensington/Safari not tested']
  }, null, 2) + '\n');
  console.log('PASS: packaged Windows assets, real IPC/worker/Argon2, verified native save and lock; Hello remains unavailable.');
} finally {
  if (browser) await browser.close();
  child.kill();
}
