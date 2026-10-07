import { test, expect } from '@playwright/test';

test('Russian desktop header, module buttons, sidebar and content never overlap', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  for (const [width, zoom] of [[1311, 1], [900, 1], [1311, 1.25], [1920, 1], [640, 1], [320, 1]]) {
    await page.setViewportSize({ width, height: 780 });
    await page.evaluate((scale) => { document.documentElement.style.zoom = String(scale); }, zoom);
    await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return { header: rect('.topbar'), modules: rect('.module-navigation'), nav: rect('.tabbar'), main: rect('main'), width: window.innerWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(geometry.overflow, `horizontal overflow at ${width}/${zoom}`).toBe(false);
    expect(geometry.modules.top).toBeGreaterThanOrEqual(geometry.header.bottom - 1);
    expect(geometry.main.top).toBeGreaterThanOrEqual(geometry.modules.bottom - 1);
    // The sidebar is in flow on desktop; mobile navigation occupies its own
    // fixed bottom area and the app already reserves its height.
    if (width >= 900) {
      expect(geometry.nav.top).toBeGreaterThanOrEqual(geometry.modules.bottom);
      expect(geometry.nav.right).toBeLessThanOrEqual(geometry.main.left + 1);
    }
    expect(geometry.modules.right).toBeLessThanOrEqual(geometry.width + 1);
  }
  expect(errors).toEqual([]);
});

test('configured Hello offers OS actions, preserves cancellation and handles policy changes', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await expect(hello.getByText('Windows Hello настроен и доступен', { exact: false })).toBeVisible();
  const verify = hello.getByRole('button', { name: 'Проверить отпечаток или PIN', exact: true });
  await verify.click();
  await expect(hello.getByText('Проверка Windows Hello пройдена.', { exact: false })).toBeVisible();
  await expect(hello.getByText('Для входа через Hello ещё нужно подтвердить аппаратную защиту ключа', { exact: false })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.outcome('cancelled'));
  await verify.click();
  await expect(hello.getByText('Проверка Windows Hello отменена.', { exact: false })).toBeVisible();
  await hello.getByRole('button', { name: 'Параметры входа Windows', exact: true }).click();
  expect(await page.evaluate(() => (window as any).helloTest.counts().settingsOpened)).toBe(1);
  await page.evaluate(() => (window as any).helloTest.configure('disabled-by-policy'));
  await hello.getByRole('button', { name: 'Проверить Windows Hello', exact: true }).click();
  await expect(hello.getByText('Windows Hello заблокирован политикой Windows.', { exact: false })).toBeVisible();
  await expect(verify).toBeDisabled();
  await expect(hello.getByRole('button', { name: 'Параметры входа Windows', exact: true })).toBeEnabled();
  await page.evaluate(() => (window as any).helloTest.failSettings());
  await hello.getByRole('button', { name: 'Параметры входа Windows', exact: true }).click();
  await expect(hello.getByText('Действие Windows не удалось выполнить.', { exact: false })).toBeVisible();
});

test('protected-key proof shows specific failures, cleanup and unresolved hardware gates', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const probe = hello.getByRole('button', { name: 'Проверить защищённый ключ', exact: true });
  await probe.click();
  await expect(hello.getByText('Проверка защищённого ключа остановилась', { exact: false })).toBeVisible();
  await expect(hello.getByText('Обязательное подтверждение и запрет экспорта', { exact: true })).toBeVisible();
  await expect(hello.getByText('0x80090029', { exact: true })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  await expect(hello.locator('pre')).toContainText('"eligible": false');
  await expect(hello.locator('pre')).toContainText('per-key-tpm-proof');
  await page.evaluate(() => (window as any).helloTest.proofOutcome('roundtrip-passed'));
  await probe.click();
  await expect(hello.getByText('Шифрование тестового секрета и обе расшифровки прошли.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await probe.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('protected-key probe cannot duplicate or show late success after Lock all', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => { (window as any).helloTest.defer(); (window as any).helloTest.proofOutcome('roundtrip-passed'); });
  const probe = page.getByRole('button', { name: 'Проверить защищённый ключ', exact: true });
  await probe.click();
  await expect(probe).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить отпечаток или PIN', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.getByText('Шифрование тестового секрета и обе расшифровки прошли.', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts().proofs)).toBe(1);
});

test('pending Hello diagnostic cannot be duplicated or reappear after locking', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  const verify = page.getByRole('button', { name: 'Проверить отпечаток или PIN', exact: true });
  await verify.click();
  await expect(verify).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.getByText('Проверка Windows Hello пройдена.', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts().verifies)).toBe(1);
});
