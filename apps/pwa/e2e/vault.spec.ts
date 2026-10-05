import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Synthetic data only.
const MASTER = 'synthetic e2e master passphrase 2026';
const MARKER_TITLE = 'ZZMARKER-title-7f3a';
const MARKER_USER = 'zzmarker.user@example.test';
const MARKER_PASSWORD = 'ZZMARKER-secret-91c4!';
const ORIGIN = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:4173').origin;

async function watchSecurity(page: Page) {
  const csp: string[] = [];
  const foreign: string[] = [];
  const errors: string[] = [];
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== ORIGIN && u.protocol !== 'blob:' && u.protocol !== 'data:') foreign.push(r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.text().includes('Content Security Policy')) csp.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return {
    async assertClean() {
      const inPage = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
      expect([...csp, ...inPage], 'CSP violations').toEqual([]);
      expect(foreign, 'requests to other origins').toEqual([]);
      expect(errors, 'console errors').toEqual([]);
    }
  };
}

/** Simulate an app switch: hidden (UI redacted), then visible again. */
async function hidePage(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => document.documentElement.classList.contains('redacted'))).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Everything the origin persisted, flattened to text (IndexedDB, Web Storage, Cache Storage). */
async function persistedText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: string[] = [];
    out.push(JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage }));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('passkey-local');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    for (const name of Array.from(db.objectStoreNames)) {
      const all = await new Promise<unknown[]>((resolve) => {
        const r = db.transaction([name], 'readonly').objectStore(name).getAll();
        r.onsuccess = () => resolve(r.result);
      });
      for (const rec of all) {
        out.push(
          JSON.stringify(rec, (_k, v) => (v instanceof ArrayBuffer ? new TextDecoder('latin1').decode(v) : v))
        );
      }
    }
    db.close();
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) out.push(await (await cache.match(req))!.text());
    }
    return out.join('\n');
  });
}

async function createAndVerifyVault(page: Page) {
  const dir = mkdtempSync(join(tmpdir(), 'pkl-e2e-'));
  // Welcome → create
  await page.getByRole('button', { name: 'Create a new vault' }).click();
  await page.getByLabel('Master password', { exact: true }).fill(MASTER);
  await page.getByLabel('Repeat master password').fill(MASTER);
  await page.getByRole('button', { name: 'Create a new vault' }).click();

  // Onboarding backup drill: export the empty vault, then verify the saved file.
  await expect(page.getByRole('heading', { name: 'First, prove you can back up' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare encrypted backup' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('save-backup').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^vault-backup-\d{8}T\d{6}Z-r0\.kdbx$/);
  const saved = join(dir, download.suggestedFilename());
  await download.saveAs(saved);
  await page.getByTestId('verify-file').setInputFiles(saved);
  await page.getByLabel('Password for this file').fill(MASTER);
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText(/Verified: this file is exactly the current version/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('create, back up, add entry, app switch, inactivity lock, reload, offline unlock, no plaintext at rest', async ({ page, context }) => {
  const sec = await watchSecurity(page);
  await page.clock.install();
  await page.goto('/');

  await createAndVerifyVault(page);

  // Add an entry.
  await page.getByRole('button', { name: 'Add entry' }).click();
  await page.getByLabel('Title').fill(MARKER_TITLE);
  await page.getByLabel('Username or email').fill(MARKER_USER);
  await page.getByLabel('Password', { exact: true }).fill(MARKER_PASSWORD);
  // Secondary fields stay collapsed until asked for.
  await expect(page.getByLabel('Website')).toHaveCount(0);
  await page.getByRole('button', { name: /^More: website/ }).click();
  await page.getByLabel('Notes').fill('synthetic note');
  await page.getByRole('button', { name: 'Hide extra fields' }).click();
  await expect(page.getByRole('button', { name: /\(filled: 1\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: MARKER_TITLE })).toBeVisible();
  // Secret masked until an explicit reveal.
  await expect(page.getByText(MARKER_PASSWORD)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal: Password' }).click();
  await expect(page.getByText(MARKER_PASSWORD)).toBeVisible();
  await expect(page).toHaveTitle('PassKey Local');
  expect(page.url()).toBe(`${ORIGIN}/`);

  // Switching apps does not lock (user decision); only the inactivity interval does.
  await hidePage(page);
  await expect(page.getByRole('heading', { name: MARKER_TITLE })).toBeVisible();
  await page.clock.fastForward('02:01');
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  const lockedHtml = await page.content();
  expect(lockedHtml).not.toContain(MARKER_TITLE);
  expect(lockedHtml).not.toContain(MARKER_PASSWORD);

  // Wrong password: authentication failure message, still locked.
  await page.getByLabel('Master password').fill('not the right synthetic password');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText(/password is wrong or the file is damaged/)).toBeVisible();

  // No plaintext markers in IndexedDB, Web Storage or Cache Storage.
  const atRest = await persistedText(page);
  for (const marker of [MARKER_TITLE, MARKER_USER, MARKER_PASSWORD, MASTER]) expect(atRest).not.toContain(marker);

  // Reload starts locked; unlock shows the entry.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  await page.getByLabel('Master password').fill(MASTER);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('button', { name: new RegExp(MARKER_TITLE) })).toBeVisible();

  // Offline after the shell is cached: reload and unlock in airplane mode.
  // The server redirects /index.html to / like Cloudflare Pages; the cached
  // shell must be a plain (non-redirected) response stored under '/'.
  const shell = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const res = await caches.match('/');
    return { cached: !!res, redirected: res?.redirected ?? null, legacy: !!(await caches.match('/index.html')) };
  });
  expect(shell).toEqual({ cached: true, redirected: false, legacy: false });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  await page.getByLabel('Master password').fill(MASTER);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('button', { name: new RegExp(MARKER_TITLE) })).toBeVisible();
  await context.setOffline(false);

  await sec.assertClean();
});

test('deployment headers are served as configured', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("default-src 'none'");
  expect(h['content-security-policy']).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(h['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(h['content-security-policy']).not.toContain("'unsafe-inline'");
  expect(h['referrer-policy']).toBe('no-referrer');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['cache-control']).toBe('no-cache');
  const index = await request.get('/index.html', { maxRedirects: 0 });
  // Cloudflare Pages answers 307; scripts/serve.mjs answers 308. Either keeps '/' the only shell URL.
  expect([307, 308]).toContain(index.status());
  expect(index.headers()['location']).toBe('/');
  const worker = await request.get('/sw.js');
  expect(worker.headers()['content-type']).toContain('javascript');
});

test('passkey PRF enrollment, offline unlock after reload, disable and password fallback', async ({ page, context }) => {
  const sec = await watchSecurity(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
    automaticPresenceSimulation: true, hasPrf: true
  } });
  await page.goto('/');
  await createAndVerifyVault(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Confirm master password for Face ID / passkey').fill(MASTER);
  await page.getByRole('button', { name: 'Enable Face ID / passkey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable Face ID / passkey' })).toBeVisible();
  const atRest = await persistedText(page);
  expect(atRest).not.toContain(MASTER);
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  // Leave a real WebAuthn get pending, then reload; late results must never reopen the vault.
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: false });
  await page.getByRole('button', { name: 'Unlock with Face ID / passkey' }).click();
  await expect(page.getByRole('button', { name: 'Unlock with Face ID / passkey' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: true });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Unlock with Face ID / passkey' }).click();
  await expect(page.getByRole('button', { name: 'Add entry' })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Disable Face ID / passkey' }).click();
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock with Face ID / passkey' })).toHaveCount(0);
  await page.getByLabel('Master password').fill(MASTER);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add entry' })).toBeVisible();
  await sec.assertClean();
});

test('locking during passkey enrollment aborts it and keeps password unlock available', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
    automaticPresenceSimulation: false, hasPrf: true
  } });
  await page.goto('/');
  await createAndVerifyVault(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Confirm master password for Face ID / passkey').fill(MASTER);
  await page.getByRole('button', { name: 'Enable Face ID / passkey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable Face ID / passkey', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: true });
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock with Face ID / passkey' })).toHaveCount(0);
  await page.getByLabel('Master password').fill(MASTER);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add entry' })).toBeVisible();
});

test('a passkey provider without PRF cannot enable unlock; password still works', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
    hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: false
  } });
  await page.goto('/');
  await createAndVerifyVault(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Confirm master password for Face ID / passkey').fill(MASTER);
  await page.getByRole('button', { name: 'Enable Face ID / passkey', exact: true }).click();
  await expect(page.getByText('Secure passkey unlock is unavailable in this browser or passkey provider. Use your master password.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disable Face ID / passkey' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock with Face ID / passkey' })).toHaveCount(0);
  await page.getByLabel('Master password').fill(MASTER);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add entry' })).toBeVisible();
});
