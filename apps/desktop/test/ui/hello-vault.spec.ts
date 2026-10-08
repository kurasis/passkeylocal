import { test, expect } from '@playwright/test';
test('Hello opt-in defaults to session, offers bounded remembered modes and unlocks only explicitly', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByText('Windows Hello для этого хранилища отключён.', { exact: true })).toBeVisible();
  const mode = page.getByLabel('Срок действия привязки');
  await expect(mode).toHaveValue('session');
  await expect(mode.locator('option')).toHaveCount(4);
  await mode.selectOption('remember6');
  await page.locator('input[name="hello-master-password"]').fill('Synthetic test password');
  await page.getByRole('button', { name: 'Подключить Windows Hello', exact: true }).click();
  await expect(page.getByText('Windows Hello подключён.', { exact: true })).toBeVisible();
  await expect(page.locator('input[name="hello-master-password"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  const unlock = page.getByRole('button', { name: 'Войти через Windows Hello', exact: true });
  await expect(unlock).toBeVisible();
  expect(await page.evaluate(() => (window as any).helloVaultTest.calls)).toEqual(['enable']);
  await page.evaluate(() => (window as any).helloVaultTest.cancel());
  await unlock.click();
  await expect(page.getByText('Проверка отменена.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await unlock.click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Отключить Hello и удалить его ключи', exact: true }).click();
  await expect(page.getByText('Windows Hello для этого хранилища отключён.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).helloVaultTest.calls)).toEqual(['enable', 'unlock', 'unlock', 'disable']);
});

test('real vault worker receives component through desktop bridge, opens KDBX after worker restart and wipes transport', async ({ page }) => {
  await page.goto('/hello-worker.html');
  await page.waitForFunction(() => !!(window as any).helloWorker);
  const result = await page.evaluate(async () => {
    const h = (window as any).helloWorker;
    await h.call('create', { password: 'Synthetic worker password 2026!' });
    const state = await h.call('enableHelloVault', { password: 'Synthetic worker password 2026!', mode: 'session' });
    h.restart();
    const opened = await h.call('unlockHelloVault');
    const overview = await h.call('overview');
    await h.call('disableHelloVault');
    return { state, opened, overview, wiped: h.wiped(), calls: h.calls };
  });
  expect(result.state.state).toBe('enabled');
  expect(Object.keys(result.opened)).toEqual(['warnings']);
  expect(result.overview.generation).toBe(1);
  expect(result.wiped).toBe(true);
  expect(result.calls).toEqual(['enroll', 'unlock', 'revoke']);
});
test('late native component is erased when the owning worker has been locked', async ({ page }) => {
  await page.goto('/hello-worker.html');
  await page.waitForFunction(() => !!(window as any).helloWorker);
  await page.evaluate(async () => {
    const h = (window as any).helloWorker;
    await h.call('create', { password: 'Synthetic worker password 2026!' });
    await h.call('enableHelloVault', { password: 'Synthetic worker password 2026!', mode: 'session' });
    h.restart(); h.block();
    void h.call('unlockHelloVault').then(() => (window as any).lateSuccess = true, () => {});
  });
  await expect.poll(() => page.evaluate(() => (window as any).helloWorker.calls)).toContain('unlock');
  await page.evaluate(() => { (window as any).helloWorker.restart(); (window as any).helloWorker.release(); });
  await expect.poll(() => page.evaluate(() => (window as any).helloWorker.wiped())).toBe(true);
  expect(await page.evaluate(() => (window as any).lateSuccess)).toBeUndefined();
  expect(await page.evaluate(() => (window as any).helloWorker.call('state'))).toMatchObject({ state: 'locked' });
});
