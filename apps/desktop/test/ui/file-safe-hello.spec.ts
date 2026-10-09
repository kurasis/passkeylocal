import { test, expect } from '@playwright/test';

test('File Safe connects independently, defaults to session and retains explicit password fallback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File-safe settings', exact: true }).click();
  const settings = page.getByTestId('file-safe-hello');
  await settings.locator('summary').click();
  const mode = settings.getByLabel('Keep this connection', { exact: true });
  await expect(mode).toHaveValue('session');
  await expect(mode.locator('option')).toHaveCount(4);
  await expect(settings.getByRole('button', { name: 'Connect file safe to Windows Hello', exact: true })).toBeDisabled();
  await mode.selectOption('remember6');
  await settings.getByLabel('Confirm file-safe master password', { exact: true }).fill('wrong');
  await settings.getByRole('button', { name: 'Connect file safe to Windows Hello', exact: true }).click();
  await expect(page.getByText('Wrong password or damaged encrypted data.', { exact: true })).toBeVisible();
  await settings.getByLabel('Confirm file-safe master password', { exact: true }).fill('synthetic password');
  await settings.getByRole('button', { name: 'Connect file safe to Windows Hello', exact: true }).click();
  await expect(settings.locator('input[name="file-safe-hello-password"]')).toHaveCount(0);
  await expect(settings.getByRole('button', { name: 'Disable Hello and remove its keys', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).click();
  const unlock = page.getByRole('button', { name: 'Unlock file safe with Windows Hello', exact: true });
  await expect(unlock).toBeEnabled();
  await expect(page.getByLabel('File-safe master password', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.cancelHello());
  await unlock.click();
  await expect(page.getByText('Verification cancelled. Use Windows Hello again or enter your master password.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synthetic private canary 00000', exact: false })).toHaveCount(0);
  expect((await page.evaluate(() => (window as any).uiTest.helloCalls())).filter((r: any) => r.operation === 'unlock')).toHaveLength(1);
  await unlock.click();
  await expect(page.getByRole('button', { name: 'Synthetic private canary 00000', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'File-safe settings', exact: true }).click();
  await page.getByTestId('file-safe-hello').locator('summary').click();
  await page.getByRole('button', { name: 'Disable Hello and remove its keys', exact: true }).click();
  await expect(page.getByLabel('Confirm file-safe master password', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).click();
  await expect(unlock).toHaveCount(0);
  await expect(page.getByLabel('File-safe master password', { exact: true })).toBeVisible();
});

test('a late Hello reply cannot repopulate the file-safe screen after Lock All', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File-safe settings', exact: true }).click();
  await page.getByTestId('file-safe-hello').locator('summary').click();
  await page.getByLabel('Confirm file-safe master password', { exact: true }).fill('synthetic password');
  await page.getByRole('button', { name: 'Connect file safe to Windows Hello', exact: true }).click();
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).click();
  const unlock = page.getByRole('button', { name: 'Unlock file safe with Windows Hello', exact: true });
  await expect(unlock).toBeEnabled();
  await page.evaluate(() => (window as any).uiTest.delayHello());
  await unlock.click();
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.helloCalls().filter((r: any) => r.operation === 'unlock').length)).toBe(1);
  await page.evaluate(() => { (window as any).uiTest.lock(); (window as any).uiTest.releaseHello(); });
  await expect(page.getByLabel('File-safe master password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synthetic private canary 00000', exact: false })).toHaveCount(0);
  await expect(unlock).toBeEnabled();
});

test('Russian file-safe Hello controls fit mobile and desktop widths with exact labels', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File-safe settings', exact: true }).click();
  await page.evaluate(() => (window as any).uiTest.russian());
  const settings = page.getByTestId('file-safe-hello');
  await settings.locator('summary').click();
  await expect(settings.getByLabel('Срок действия привязки', { exact: true })).toHaveValue('session');
  for (const width of [360, 720, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await settings.scrollIntoViewIfNeeded();
    await expect(settings.getByLabel('Подтвердите мастер-пароль файлового сейфа', { exact: true })).toBeVisible();
    expect(await settings.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
});
