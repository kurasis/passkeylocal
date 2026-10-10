import { test, expect } from '@playwright/test';

test('virtual table preserves focus offscreen and keyboard navigation reaches every row', async ({ page }) => {
  await page.goto('/');
  const table = page.getByRole('table', { name: 'Files', exact: true });
  await expect(table).toHaveAttribute('aria-rowcount', '101');
  await expect(table.getByRole('columnheader')).toHaveCount(5);
  const first = table.getByRole('button', { name: 'Synthetic private canary 00000', exact: true });
  await first.focus();
  await page.locator('.file-safe-viewport').evaluate(node => node.scrollTop = node.scrollHeight);
  await expect(first).toBeFocused();
  expect(await table.locator('.file-safe-row').count()).toBeLessThanOrEqual(25);
  await page.keyboard.press('End');
  const last = table.getByRole('button', { name: 'Synthetic private canary 00099', exact: true });
  await expect(last).toBeFocused();
  await expect(last.locator('xpath=ancestor::tr')).toHaveAttribute('aria-rowindex', '101');
  await page.keyboard.press('ArrowUp');
  await expect(table.getByRole('button', { name: 'Synthetic private canary 00098', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
});

test('native folder modal traps focus, makes the background inert and returns to its trigger', async ({ page }) => {
  await page.goto('/?explorer=nested');
  const folder = page.getByRole('button', { name: 'Open folder: Images', exact: true });
  await folder.focus();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Remove empty folder', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Remove empty folder', exact: true });
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await folder.evaluate(node => (node as HTMLElement).focus());
  expect(await modal.evaluate(node => node.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
    expect(await modal.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  expect(await modal.evaluate(node => getComputedStyle(node).overscrollBehavior)).toBe('contain');
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(folder).toBeFocused();
});

test('metadata drafts survive rejected close and navigation; saving clears the guard', async ({ page }) => {
  await page.goto('/?explorer=nested');
  await page.getByRole('button', { name: 'Root readme.txt', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const name = page.getByLabel('Name', { exact: true });
  await name.fill('Synthetic draft.txt');
  let confirms = 0;
  const reject = async (dialog: import('@playwright/test').Dialog) => { confirms++; await dialog.dismiss(); };
  page.on('dialog', reject);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await expect(name).toHaveValue('Synthetic draft.txt');
  await page.getByRole('button', { name: 'File-safe settings', exact: true }).click();
  await expect(name).toHaveValue('Synthetic draft.txt');
  expect(confirms).toBe(2);
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Synthetic draft.txt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await expect(name).toHaveCount(0);
  expect(confirms).toBe(2);
  page.off('dialog', reject);
});

test('restoring a version needs consent and history uses localized dates and sizes', async ({ page }) => {
  await page.goto('/?explorer=nested');
  await page.getByRole('button', { name: 'Root readme.txt', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Version history', exact: true }).click();
  const older = page.locator('.file-safe-version').last();
  await expect(older).toContainText('1 KiB');
  await expect(older).not.toContainText('2026-09-01T');
  page.once('dialog', dialog => dialog.dismiss());
  await older.getByRole('button', { name: 'Make current', exact: true }).click();
  expect(await page.evaluate(() => (window as any).uiTest.changes())).toEqual([]);
  page.once('dialog', dialog => dialog.accept());
  await older.getByRole('button', { name: 'Make current', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.changes().map((value: any) => value.kind))).toEqual(['restore_version']);
});

test('danger actions retain readable contrast across all palettes', async ({ page }) => {
  await page.goto('/?explorer=nested');
  for (const theme of ['color', 'light', 'dark']) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    await page.getByRole('button', { name: 'Root readme.txt', exact: true }).click({ button: 'right' });
    const contrast = await page.getByRole('menuitem', { name: 'Move to recycle bin', exact: true }).evaluate(node => {
      const luminance = (value: string) => {
        const channels = value.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
      };
      const foreground = luminance(getComputedStyle(node).color);
      const background = luminance(getComputedStyle(node.closest('.file-safe-context')!).backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('Escape');
  }
});

test('search failures are announced and clear when the query is removed', async ({ page }) => {
  await page.goto('/shell.html');
  await page.evaluate(() => (window as any).searchTest.fail());
  await page.getByRole('searchbox', { name: 'Поиск', exact: true }).fill('synthetic');
  await expect(page.getByRole('alert')).toContainText('Поиск');
  await page.getByRole('searchbox', { name: 'Поиск', exact: true }).fill('');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('desktop close modal protects a draft, traps focus and cancels safely', async ({ page }) => {
  await page.goto('/shell.html');
  const add = page.getByRole('button', { name: 'Добавить запись', exact: true });
  await add.click();
  await page.getByLabel('Название', { exact: true }).fill('Synthetic close draft');
  await page.evaluate(() => { void (window as any).closeTest.request(); });
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Отмена', exact: true })).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await modal.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Synthetic close draft');
  await page.getByRole('button', { name: 'Заблокировать', exact: true }).click();
  await expect(page.getByLabel('Название', { exact: true })).toHaveCount(0);
});

test('failed and cancelled actions use distinct persistent feedback instead of a saved notice', async ({ page }) => {
  await page.goto('/?explorer=nested');
  await expect(page.getByRole('button', { name: 'Root readme.txt', exact: true })).toBeVisible();
  await page.clock.install();
  await page.evaluate(() => (window as any).uiTest.failNextChange('CONFLICT'));
  await page.getByLabel('Folder name', { exact: true }).fill('Synthetic failed folder');
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  const notice = page.locator('.file-safe-title-line .banner');
  await expect(notice).toHaveAttribute('role', 'alert');
  await expect(notice).toHaveClass(/error/);
  await page.clock.fastForward(9000);
  await expect(notice).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.failNextChange('CANCELLED'));
  await page.getByLabel('Folder name', { exact: true }).fill('Synthetic cancelled folder');
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toHaveClass(/warn/);
  await expect(notice).not.toHaveText('Verified and saved');
  await page.clock.fastForward(9000);
  await expect(notice).toBeVisible();
});
