import { expect, test, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Dedicated production-header server with disposable, hot-swappable shell builds.
const origin = 'http://localhost:4184';
const password = 'synthetic service worker upgrade passphrase';
let dir: string, server: ChildProcess;
let originalHtml: string, originalSw: string, originalEntry: string, entryName: string;

function publish(label: string, incomplete = false) {
  const next = `assets/update-fixture-${label}.js`;
  writeFileSync(join(dir, 'index.html'), originalHtml.replace(entryName, next));
  writeFileSync(join(dir, 'sw.js'), originalSw.replace(/const VERSION = "([^"]+)";/, `const VERSION = "$1-${label}";`).replaceAll(entryName, next));
  if (!incomplete) writeFileSync(join(dir, next), `${originalEntry}\nglobalThis.__updateFixture = ${JSON.stringify(label)};\n`);
}

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pkl-sw-upgrade-'));
  cpSync(fileURLToPath(new URL('../dist/', import.meta.url)), dir, { recursive: true });
  originalHtml = readFileSync(join(dir, 'index.html'), 'utf8');
  originalSw = readFileSync(join(dir, 'sw.js'), 'utf8');
  entryName = /src="\/(assets\/index-[^"<>]+\.js)"/.exec(originalHtml)![1]!;
  originalEntry = readFileSync(join(dir, entryName), 'utf8');
  publish('a');
  server = spawn(process.execPath, ['scripts/serve.mjs', '4184', dir], { stdio: 'ignore' });
  await expect.poll(async () => { try { return (await fetch(origin)).status; } catch { return 0; } }).toBe(200);
});
test.afterAll(() => { server?.kill(); if (dir) rmSync(dir, { recursive: true, force: true }); });

async function fingerprint(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('passkey-local'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    const rows = [];
    for (const name of Array.from(db.objectStoreNames)) {
      const data = await new Promise<unknown[]>((resolve, reject) => {
        const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      rows.push([name, data]);
    }
    db.close();
    const text = JSON.stringify(rows, (_k, v) => v instanceof ArrayBuffer ? Array.from(new Uint8Array(v)) : v);
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
  });
}

test('real shell upgrade waits during editing, applies only while locked, preserves ciphertext and survives a failed next install', async ({ page, context }) => {
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This application is up to date.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create a new vault', exact: true }).click();
  await page.getByLabel('Master password', { exact: true }).fill(password);
  await page.getByLabel('Repeat master password').fill(password);
  await page.getByRole('button', { name: 'Create a new vault', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare encrypted backup' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('save-backup').click();
  const path = join(dir, 'synthetic-backup.kdbx'); await (await download).saveAs(path);
  await page.getByTestId('verify-file').setInputFiles(path);
  await page.getByLabel('Password for this file').fill(password);
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText(/Verified: this file is exactly the current version/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Synthetic preserved entry');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic preserved entry', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vault', exact: true }).click();
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Synthetic unsaved draft');

  publish('b');
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Synthetic unsaved draft');
  await expect(page.getByRole('button', { name: 'Update now', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (globalThis as any).__updateFixture)).toBe('a');
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  const before = await fingerprint(page);
  await page.getByRole('button', { name: 'Update now', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (globalThis as any).__updateFixture)).toBe('b');
  await expect(page.getByRole('heading', { name: 'Vault locked', exact: true })).toBeVisible();
  expect(await fingerprint(page)).toEqual(before);

  // A missing new asset must not replace the complete active shell.
  publish('c', true);
  const check = page.getByRole('button', { name: 'Check for updates', exact: true });
  await expect(check).toBeEnabled(); await check.click();
  await expect(page.getByRole('status').filter({ hasText: 'Could not check or download the update.' })).toBeVisible();
  expect(await page.evaluate(() => (globalThis as any).__updateFixture)).toBe('b');
  await context.setOffline(true); await page.reload();
  await page.getByLabel('Master password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('button', { name: /Synthetic preserved entry/ })).toBeVisible();
  expect(await page.evaluate(() => (globalThis as any).__updateFixture)).toBe('b');
});
