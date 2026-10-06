/** Windows-only CI test of real packaged assets/WebView2/IPC/worker/KDBX.
 * Debugging is enabled only by temporary app-scoped policy on this CI host;
 * no test provider, debug server or driver is installed with the product.
 */
import assert from 'node:assert/strict';
import { spawn, execFileSync, execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { openVault, listEntries } from '@passkey-local/vault-adapter';

assert.equal(process.platform, 'win32');
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run only on an ephemeral GitHub-hosted Windows runner');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'Machine policy changes are restricted to disposable hosted runners');
const data = join(process.env.LOCALAPPDATA, 'com.passkeylocal.vault');
assert(!existsSync(join(data, 'current.kdbx')), 'Smoke must not use an existing user vault');
const release = resolve('apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release');
const installers = readdirSync(join(release, 'bundle/nsis')).filter((name) => name.endsWith('-setup.exe'));
assert.equal(installers.length, 1, 'One installer must be tested');
await promisify(execFile)(join(release, 'bundle/nsis', installers[0]), ['/S'], { timeout: 180000 });
const exe = join(process.env.LOCALAPPDATA, 'PassKey Local', 'passkey-local-desktop.exe');
assert(existsSync(exe), 'Per-user installer must install the app');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const installedHash = digest(await readFile(exe));
assert.equal(installedHash, digest(await readFile(join(release, 'passkey-local-desktop.exe'))), 'Installed executable must match the compiled source binary');
const password = 'synthetic-Windows-smoke-2026-🔑';
// Runtime 150 ignores environment overrides for elevated hosts such as
// GitHub's runner. HKLM policy remains supported. Scope it to this EXE and
// remove our value in finally; never change the installer or release host.
// https://github.com/tauri-apps/wry/issues/1782
const policyPath = String.raw`HKLM:\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments`;
const policyName = 'passkey-local-desktop.exe';
const powershell = (command) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', timeout: 30000 });
let child, browser, page, policyInstalled = false;
let hostOutput = '';
let lastConnectionError = '';
try {
  powershell(`$ErrorActionPreference = 'Stop'; $path = '${policyPath}'; $name = '${policyName}'; if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; $key = Get-Item $path; if ($null -ne $key.GetValue($name, $null)) { throw 'Refuse to overwrite existing test policy' }; New-ItemProperty -Path $path -Name $name -Value '--remote-debugging-port=9222' -PropertyType String | Out-Null; if ((Get-Item $path).GetValue($name) -ne '--remote-debugging-port=9222') { throw 'Test policy readback failed' }`);
  policyInstalled = true;
  const environment = { ...process.env };
  delete environment.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS;
  child = spawn(exe, [], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { hostOutput = (hostOutput + chunk.toString()).slice(-16000); });
  for (let attempt = 0; attempt < 30; attempt++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1000 }); break; }
    catch (error) { lastConnectionError = String(error.message).slice(0, 2000); if (child.exitCode !== null) throw new Error('Packaged host exited before readiness'); await new Promise((r) => setTimeout(r, 1000)); }
  }
  assert(browser, `Packaged WebView2 debugging endpoint must start: ${lastConnectionError}`);
  const context = browser.contexts()[0];
  page = context.pages()[0] ?? await context.waitForEvent('page');
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', () => errors.push('pageerror'));
  let foreignRequests = 0;
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['tauri.localhost', 'ipc.localhost', 'localhost', '127.0.0.1'].includes(url.hostname) || url.protocol === 'tauri:') return route.continue();
    foreignRequests++; return route.abort();
  });
  await page.waitForFunction(() => !!window.__TAURI_INTERNALS__?.invoke);
  const privacy = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('native_status'));
  assert.equal(privacy.browserPrivacyVerified, true, 'Password saving and autofill disabled with native readback');
  const nativeWindow = JSON.parse(powershell(`Get-Process -Id ${child.pid} -ErrorAction Stop | Select-Object MainWindowHandle,MainWindowTitle,Responding | ConvertTo-Json`));
  assert.notEqual(nativeWindow.MainWindowHandle, 0, 'A visible native main window must exist');
  assert.equal(nativeWindow.MainWindowTitle, 'PassKey Local');
  assert.equal(nativeWindow.Responding, true);
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
    installer: 'per-user silent install completed on hosted runner', installedExecutableSha256: installedHash,
    automation: 'Temporary app-scoped HKLM WebView2 debugging policy; elevated hosted runner; no product debug switch',
    fixture: 'synthetic fresh vault with one entry', status: 'PASS',
    evidence: ['actual per-user NSIS installation', 'installed executable equals built binary', 'packaged asset origin', 'WebView2 password saving/autofill disabled with native readback', 'React UI', 'real Tauri IPC and revocable session', 'crypto worker/Argon2 WASM', 'native KDBX save', 'password lock and fallback', 'unproved Hello denied', 'no foreign requests'],
    limits: ['native dialogs not automated', 'clean offline machine and standard-user installation not exercised', 'physical offline/TPM/Kensington/Safari not tested']
  }, null, 2) + '\n');
  console.log('PASS: packaged Windows assets, real IPC/worker/Argon2, verified native save and lock; Hello remains unavailable.');
} catch (error) {
  await mkdir('apps/desktop/artifacts', { recursive: true });
  let endpoint, processInfo;
  try { endpoint = await (await fetch('http://127.0.0.1:9222/json/version')).json(); } catch { endpoint = 'unreachable'; }
  try {
    processInfo = child ? powershell(`Get-Process -Id ${child.pid} -ErrorAction Stop | Select-Object MainWindowHandle,MainWindowTitle,Responding | ConvertTo-Json`) : 'not launched';
  } catch (processError) { processInfo = String(processError.message).slice(0, 2000); }
  await writeFile('apps/desktop/artifacts/smoke-failure.json', JSON.stringify({ status: 'FAIL', sourceCommit: process.env.GITHUB_SHA, error: String(error.message).slice(0, 4000), hostOutput, endpoint, processInfo, fixture: 'ephemeral hosted runner; synthetic data only' }, null, 2));
  if (page) await page.screenshot({ path: 'apps/desktop/artifacts/smoke-failure.png' }).catch(() => {});
  console.error(hostOutput);
  throw error;
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    try { child?.kill(); } finally {
      if (policyInstalled) powershell(`$ErrorActionPreference = 'Stop'; Remove-ItemProperty -Path '${policyPath}' -Name '${policyName}'; if ($null -ne (Get-Item '${policyPath}').GetValue('${policyName}', $null)) { throw 'Test policy cleanup failed' }`);
    }
  }
}
