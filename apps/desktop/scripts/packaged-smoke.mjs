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
import { chromium, expect } from '@playwright/test';
import { openVault, listEntries } from '@passkey-local/vault-adapter';

assert.equal(process.platform, 'win32');
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run only on an ephemeral GitHub-hosted Windows runner');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'Machine policy changes are restricted to disposable hosted runners');
const data = join(process.env.LOCALAPPDATA, 'com.passkeylocal.vault');
assert(!existsSync(join(data, 'current.kdbx')), 'Smoke must not use an existing user vault');
const safeData = join(process.env.LOCALAPPDATA, 'com.passkeylocal.file-safe');
assert(!existsSync(join(safeData, 'ACTIVE.json')), 'File-safe smoke must not use existing user data');
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
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const helloReport = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_status'));
  assert.equal(helloReport.available, false, 'OS configuration must not enable unproved vault unwrap');
  assert.equal(helloReport.enrolled, false);
  assert(['available', 'device-not-present', 'not-configured', 'disabled-by-policy', 'device-busy', 'unknown'].includes(helloReport.helloConfiguration), 'Actual WinRT availability probe returns a sanitized configuration');
  const helloSection = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await helloSection.getByRole('button', { name: 'Check Windows Hello', exact: true }).click();
  await expect(helloSection.getByRole('button', { name: 'Windows sign-in settings', exact: true })).toBeEnabled();
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Test fingerprint or PIN', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Test protected key', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Test OAEP with confirmation', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Test PKCS#1 compatibility', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Test PKCS#1 key behavior', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Test key attestation capability', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  await expect(helloSection.getByRole('button', { name: 'Check PRF support', exact: true })).toBeEnabled();
  await expect.poll(async () => helloSection.getByRole('button', { name: 'Get Windows Hello attestation', exact: true }).isEnabled()).toBe(helloReport.helloConfiguration === 'available');
  const helloWebauthnCapability = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_webauthn_capability'));
  assert.equal(helloWebauthnCapability.sourceCommit, process.env.GITHUB_SHA);
  assert.equal(helloWebauthnCapability.purpose, 'webauthn-prf-capability');
  assert.equal(helloWebauthnCapability.checks.length, 4);
  assert(helloWebauthnCapability.webauthn.osBuild > 0);
  assert(helloWebauthnCapability.webauthn.apiVersion > 0);
  assert.equal(helloWebauthnCapability.webauthn.tpmBinding, 'not-verified');
  for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloWebauthnCapability[key], false);
  await expect(helloSection.getByRole('button', { name: 'Check TPM provider', exact: true })).toBeEnabled();
  await expect(helloSection.getByRole('button', { name: 'Test TPM inner layer', exact: true })).toBeEnabled();
  const helloTpmCapability = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_tpm_capability'));
  assert.equal(helloTpmCapability.sourceCommit, process.env.GITHUB_SHA);
  assert.equal(helloTpmCapability.purpose, 'tpm-inner-capability');
  assert.equal(helloTpmCapability.checks.length, 2);
  assert.equal(helloTpmCapability.authorization, 'no-hello-authorization');
  assert.equal(helloTpmCapability.perKeyTpmEvidence, 'not-verified');
  assert.equal(helloTpmCapability.processScope, 'same-process');
  for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloTpmCapability[key], false);
  // Exact packaged IPC/ACL, read-only status and no-record resume/cleanup.
  // Do not manufacture target hardware evidence on the hosted runner.
  const helloCombinedStatus = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_combined_status'));
  assert.equal(helloCombinedStatus.sourceCommit, process.env.GITHUB_SHA);
  assert.equal(helloCombinedStatus.purpose, 'synthetic-combined-restart');
  assert.equal(helloCombinedStatus.combinedState, 'no-test');
  for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloCombinedStatus[key], false);
  for (const command of ['hello_combined_resume', 'hello_combined_cleanup']) {
    const report = await page.evaluate((name) => window.__TAURI_INTERNALS__.invoke(name), command);
    assert.equal(report.outcome, 'no-test');
    assert.deepEqual(report.checks, []);
  }
  await expect(helloSection.getByRole('button', { name: '2. Continue after restart', exact: true })).toBeDisabled();
  await expect(helloSection.getByRole('button', { name: 'Remove test and temporary keys', exact: true })).toBeDisabled();
  let helloTpmLocalBinding = null;
  if (helloTpmCapability.outcome === 'blocked') {
    helloTpmLocalBinding = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_tpm_local_binding'));
    assert.equal(helloTpmLocalBinding.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloTpmLocalBinding.purpose, 'synthetic-tpm-local-binding');
    assert.equal(helloTpmLocalBinding.outcome, 'blocked');
    assert.equal(helloTpmLocalBinding.checks.length, 12);
    assert(helloTpmLocalBinding.checks.slice(2, -1).every((check) => check.status === 'not-run'));
    assert.deepEqual(helloTpmLocalBinding.checks.at(-1), { test: 'test-key-delete', status: 'passed' });
    assert.equal(helloTpmLocalBinding.perKeyTpmEvidence, 'not-verified');
    assert.deepEqual(helloTpmLocalBinding.exportChecks, []);
    for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloTpmLocalBinding[key], false);
  }
  let helloTpmProof = null;
  if (helloTpmCapability.outcome === 'blocked') {
    // Exercise permitted IPC only when preflight prevents key creation.
    helloTpmProof = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_tpm_proof'));
    assert.equal(helloTpmProof.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloTpmProof.purpose, 'synthetic-tpm-inner');
    assert.equal(helloTpmProof.outcome, 'blocked');
    assert.equal(helloTpmProof.checks.length, 11);
    assert(helloTpmProof.checks.slice(2, -1).every((check) => check.status === 'not-run'));
    assert.deepEqual(helloTpmProof.checks.at(-1), { test: 'test-key-delete', status: 'passed' });
    for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloTpmProof[key], false);
  }
  let helloPrfProof = null;
  let helloDirectAttestation = null;
  if (helloWebauthnCapability.outcome === 'blocked') {
    // A blocked read-only preflight stops before make/get, even if this runner
    // ever gains Hello. Never automate biometric prompts on a hosted machine.
    helloPrfProof = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_prf_proof'));
    assert.equal(helloPrfProof.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloPrfProof.purpose, 'synthetic-webauthn-prf');
    assert.equal(helloPrfProof.outcome, 'blocked');
    assert.equal(helloPrfProof.checks.length, 10);
    for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloPrfProof[key], false);
    assert(helloPrfProof.checks.slice(4, 9).every((check) => check.status === 'not-run'));
    assert.deepEqual(helloPrfProof.checks.at(-1), { test: 'test-passkey-delete', status: 'passed' });
    helloDirectAttestation = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_webauthn_attestation'));
    assert.equal(helloDirectAttestation.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloDirectAttestation.purpose, 'synthetic-webauthn-direct-attestation');
    assert.equal(helloDirectAttestation.algorithm, 'webauthn-es256-direct-attestation');
    assert.equal(helloDirectAttestation.outcome, 'blocked');
    assert.equal(helloDirectAttestation.checks.length, 6);
    assert.equal(helloDirectAttestation.checks[4].status, 'not-run');
    assert.equal(helloDirectAttestation.directAttestation, undefined);
    assert.deepEqual(helloDirectAttestation.checks.at(-1), { test: 'test-passkey-delete', status: 'passed' });
    for (const key of ['eligible', 'enrolled', 'unlocked']) assert.equal(helloDirectAttestation[key], false);
  }
  let helloKeyProof = null;
  let helloOaepCapability = null;
  let helloPkcs1Compatibility = null;
  let helloPkcs1Behavior = null;
  let helloAttestationCapability = null;
  if (helloReport.helloConfiguration !== 'available') {
    // The hosted runner has no configured Hello. Direct permitted IPC must
    // stop before creating a key or opening any OS enrollment/consent prompt.
    helloKeyProof = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_key_proof'));
    assert.equal(helloKeyProof.sourceCommit, process.env.GITHUB_SHA, 'Installed native probe embeds this build source, not a stale cached binary');
    assert.equal(helloKeyProof.eligible, false);
    assert.equal(helloKeyProof.unlocked, false);
    assert.equal(helloKeyProof.outcome, 'blocked');
    assert.equal(helloKeyProof.checks[0].test, 'hello-configuration');
    assert.equal(helloKeyProof.checks[0].status, 'failed');
    assert(helloKeyProof.checks.slice(1, -1).every((check) => check.status === 'not-run'));
    assert.equal(helloKeyProof.checks.at(-1).status, 'passed');
    helloOaepCapability = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_oaep_capability'));
    assert.equal(helloOaepCapability.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloOaepCapability.purpose, 'synthetic-oaep-capability');
    assert.equal(helloOaepCapability.eligible, false);
    assert.equal(helloOaepCapability.enrolled, false);
    assert.equal(helloOaepCapability.unlocked, false);
    assert.equal(helloOaepCapability.outcome, 'blocked');
    assert.equal(helloOaepCapability.checks[0].status, 'failed');
    assert(helloOaepCapability.checks.slice(1, -1).every((check) => check.status === 'not-run'));
    assert.equal(helloOaepCapability.checks.at(-1).status, 'passed');
    helloPkcs1Compatibility = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_pkcs1_compatibility'));
    assert.equal(helloPkcs1Compatibility.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloPkcs1Compatibility.purpose, 'synthetic-pkcs1-compatibility');
    assert.equal(helloPkcs1Compatibility.algorithm, 'rsa-pkcs1-v1_5');
    assert.equal(helloPkcs1Compatibility.eligible, false);
    assert.equal(helloPkcs1Compatibility.enrolled, false);
    assert.equal(helloPkcs1Compatibility.unlocked, false);
    assert.equal(helloPkcs1Compatibility.outcome, 'blocked');
    assert.equal(helloPkcs1Compatibility.checks[0].status, 'failed');
    assert(helloPkcs1Compatibility.checks.slice(1, -1).every((check) => check.status === 'not-run'));
    assert.equal(helloPkcs1Compatibility.checks.at(-1).status, 'passed');
    helloPkcs1Behavior = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_pkcs1_behavior'));
    assert.equal(helloPkcs1Behavior.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloPkcs1Behavior.purpose, 'synthetic-pkcs1-behavior');
    assert.equal(helloPkcs1Behavior.algorithm, 'rsa-pkcs1-v1_5');
    assert.equal(helloPkcs1Behavior.eligible, false);
    assert.equal(helloPkcs1Behavior.enrolled, false);
    assert.equal(helloPkcs1Behavior.unlocked, false);
    assert.equal(helloPkcs1Behavior.outcome, 'blocked');
    assert.equal(helloPkcs1Behavior.checks[0].status, 'failed');
    assert(helloPkcs1Behavior.checks.slice(1, -1).every((check) => check.status === 'not-run'));
    assert.equal(helloPkcs1Behavior.checks.at(-1).status, 'passed');
    helloAttestationCapability = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hello_attestation_capability'));
    assert.equal(helloAttestationCapability.sourceCommit, process.env.GITHUB_SHA);
    assert.equal(helloAttestationCapability.purpose, 'synthetic-attestation-capability');
    assert.equal(helloAttestationCapability.algorithm, 'rsa-2048-decrypt-only');
    assert.equal(helloAttestationCapability.eligible, false);
    assert.equal(helloAttestationCapability.enrolled, false);
    assert.equal(helloAttestationCapability.unlocked, false);
    assert.equal(helloAttestationCapability.outcome, 'blocked');
    assert.equal(helloAttestationCapability.checks.length, 7);
    assert.equal(helloAttestationCapability.checks[0].status, 'failed');
    assert(helloAttestationCapability.checks.slice(1, -1).every((check) => check.status === 'not-run'));
    assert.equal(helloAttestationCapability.checks.at(-1).status, 'passed');
    assert.equal(helloAttestationCapability.attestationClaim, undefined, 'Unexecuted claim API reports no observation');
  }
  // Check the reported Russian layout in the real installed WebView2, where
  // module controls and the sidebar previously occupied the same vertical area.
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
  await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return { modules: rect('.module-navigation'), nav: rect('.tabbar'), main: rect('main'), desktop: innerWidth >= 900, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  assert.equal(layout.overflow, false, 'Installed Russian layout has no horizontal overflow');
  assert(layout.main.top >= layout.modules.bottom - 1, 'Main content follows module controls');
  if (layout.desktop) {
    assert(layout.nav.top >= layout.modules.bottom, 'Sidebar follows module controls without overlap');
    assert(layout.nav.right <= layout.main.left + 1, 'Sidebar and main content occupy separate columns');
  }
  await mkdir('apps/desktop/artifacts', { recursive: true });
  await page.screenshot({ path: 'apps/desktop/artifacts/windows-settings-smoke.png' });
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const interval = page.getByRole('combobox', { name: 'Lock after inactivity', exact: true });
  for (const [label, milliseconds] of [['6 hours', 21600000], ['12 hours', 43200000], ['24 hours', 86400000]]) {
    await interval.selectOption({ label });
    await expect.poll(async () => JSON.parse(await readFile(join(data, 'state.json'), 'utf8')).preferences.lockIntervalMs).toBe(milliseconds);
  }
  await page.reload();
  await page.getByLabel('Master password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(interval).toHaveValue('86400000');
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Synthetic Windows smoke');
  await page.getByLabel('Username or email', { exact: true }).fill('synthetic-user');
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
  // Exercise the installed file-safe UI while the password database is locked.
  powershell(`[void](New-Object -ComObject WScript.Shell).AppActivate(${child.pid})`);
  await page.getByRole('button', { name: 'File Safe', exact: true }).click();
  const safePassword = 'synthetic-independent-file-safe-2026';
  await page.getByLabel('File-safe master password', { exact: true }).fill(safePassword);
  await page.getByLabel('Repeat password', { exact: true }).fill(safePassword);
  await page.getByRole('button', { name: 'Create file safe', exact: true }).click();
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).waitFor();
  await page.getByLabel('Folder name', { exact: true }).fill('Synthetic file-safe folder');
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await page.getByRole('button', { name: '▸ Synthetic file-safe folder', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Passwords', exact: true }).click();
  await page.getByLabel('Master password', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'File Safe', exact: true }).click();
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Lock all', exact: true }).click();
  await page.getByLabel('File-safe master password', { exact: true }).waitFor();
  assert(!await page.getByRole('button', { name: '▸ Synthetic file-safe folder', exact: true }).count());
  await page.getByLabel('File-safe master password', { exact: true }).fill(safePassword);
  await page.getByRole('button', { name: 'Unlock file safe', exact: true }).click();
  await page.getByRole('button', { name: '▸ Synthetic file-safe folder', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).click();
  await page.getByLabel('File-safe master password', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Passwords', exact: true }).click();
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
    helloConfiguration: helloReport.helloConfiguration, helloKeyProof, helloOaepCapability, helloPkcs1Compatibility, helloPkcs1Behavior, helloAttestationCapability, helloWebauthnCapability, helloPrfProof, helloDirectAttestation, helloTpmCapability, helloTpmProof, helloTpmLocalBinding, helloCombinedStatus, russianSettingsLayout: layout,
    evidence: ['actual per-user NSIS installation', 'installed executable equals built binary', 'packaged asset origin', 'WebView2 password saving/autofill disabled with native readback', 'React UI', 'real Tauri IPC and revocable session', 'crypto worker/Argon2 WASM', 'native KDBX save', '6/12/24 hour preferences with native readback and reload', 'password lock and fallback', 'unproved Hello denied', 'independent native file-safe create/folder/lock/password re-unlock', 'one module does not cross-unlock another', 'Lock all redacts both modules', 'no foreign requests'],
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
