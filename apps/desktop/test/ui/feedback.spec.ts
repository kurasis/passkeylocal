import { test, expect } from '@playwright/test';

test('unchanged recently verified vaults stay quiet, changes remind and overdue unchanged vaults warn', async ({ page }) => {
  await page.goto('/backup.html');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.evaluate(() => (window as any).backupTest.render(1, false));
  await expect(page.getByText('Есть изменения, которых нет в проверенной копии.', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).backupTest.render(0, true));
  await expect(page.getByRole('status')).toContainText('прошло 30 дней с последней проверки копии');
  await page.evaluate(() => (window as any).backupTest.render(0, false));
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.reminder')).toHaveCount(0);
});

test('safe admission is quiet and action notices sit beside its title in the shared visual identity', async ({ page }) => {
  await page.goto('/?explorer=nested');
  await expect(page.getByRole('button', { name: 'Root readme.txt', exact: true })).toBeVisible();
  await expect(page.locator('.file-safe-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Lock file safe', exact: true }).click();
  await page.getByLabel('File-safe master password', { exact: true }).fill('synthetic password');
  await page.getByRole('button', { name: 'Unlock file safe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Root readme.txt', exact: true })).toBeVisible();
  await expect(page.locator('.file-safe-feedback')).toHaveCount(0);
  const identity = await page.context().newPage();
  await identity.goto('/shell.html');
  const passwordNavigation = identity.locator('.tabbar button').first();
  await expect(passwordNavigation).toBeVisible();
  for (const theme of ['color', 'light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await identity.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
    await identity.evaluate((value) => document.documentElement.dataset.theme = value, theme);
    const style = (node: Element) => { const s = getComputedStyle(node); return [s.padding, s.borderRadius, s.fontSize, s.fontWeight, s.minHeight, s.backgroundColor, s.color]; };
    expect(await page.getByRole('button', { name: 'Files', exact: true }).evaluate(style)).toEqual(await passwordNavigation.evaluate(style));
    await page.getByLabel('Folder name', { exact: true }).fill(`Notice ${theme}`);
    await page.getByRole('button', { name: 'New folder', exact: true }).click();
    const notice = page.locator('.file-safe-title-line').getByRole('status');
    await expect(notice).toHaveText('Verified and saved');
    const title = await page.getByRole('heading', { name: 'File Safe', exact: true }).boundingBox();
    const box = await notice.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(title!.x + title!.width);
    expect(box!.y).toBeLessThan(title!.y + title!.height);
    for (const width of [360, 760]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }
  await identity.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => (window as any).uiTest.russian());
  await page.getByLabel('Имя папки', { exact: true }).fill('Русский статус');
  await page.getByRole('button', { name: 'Новая папка', exact: true }).click();
  const russianNotice = page.locator('.file-safe-title-line').getByRole('status');
  await expect(russianNotice).toHaveText('Проверено и сохранено');
  const russianTitle = await page.getByRole('heading', { name: 'Файловый сейф', exact: true }).boundingBox();
  const russianBox = await russianNotice.boundingBox();
  expect(russianBox!.x).toBeGreaterThanOrEqual(russianTitle!.x + russianTitle!.width);
  expect(russianBox!.y).toBeLessThan(russianTitle!.y + russianTitle!.height);
  await expect(page.locator('.file-safe-feedback')).toHaveCount(0, { timeout: 8000 });
});
