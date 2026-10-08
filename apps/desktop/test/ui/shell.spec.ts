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

test('authorized OAEP capability is explicit and never reports a complete security proof', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await hello.getByRole('button', { name: 'Проверить OAEP с подтверждением', exact: true }).click();
  await expect(hello.getByText('Подтверждена только поддержка алгоритма;', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  await expect(hello.locator('pre')).toContainText('"purpose": "synthetic-oaep-capability"');
  await expect(hello.locator('pre')).toContainText('"eligible": false');
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.checks.find((check: { test: string }) => check.test === 'silent-before').status).toBe('not-run');
  expect(report.checks.find((check: { test: string }) => check.test === 'private-export').status).toBe('not-run');
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ capabilities: 1, proofs: 0, verifies: 0 });
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('OAEP capability shares single flight and discards a result after Lock all', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  const capability = page.getByRole('button', { name: 'Проверить OAEP с подтверждением', exact: true });
  await capability.click();
  await expect(capability).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить защищённый ключ', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить отпечаток или PIN', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.getByText('Подтверждена только поддержка алгоритма;', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ capabilities: 1, proofs: 0, verifies: 0 });
});

test('PKCS#1 compatibility needs its own action and never claims OAEP or unlock eligibility', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  // The OAEP action cannot silently run the legacy experiment.
  await hello.getByRole('button', { name: 'Проверить OAEP с подтверждением', exact: true }).click();
  expect(await page.evaluate(() => (window as any).helloTest.counts().compatibilities)).toBe(0);
  await hello.getByRole('button', { name: 'Проверить совместимость PKCS#1', exact: true }).click();
  await expect(hello.getByText('Подтверждена только совместимость со старым алгоритмом;', { exact: false })).toBeVisible();
  await expect(hello.getByText('Шифрование тестового секрета (RSA-PKCS#1 v1.5, только совместимость)', { exact: true })).toBeVisible();
  await expect(hello.locator('.hello-proof-checks')).not.toContainText('OAEP');
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report).toMatchObject({ purpose: 'synthetic-pkcs1-compatibility', algorithm: 'rsa-pkcs1-v1_5', outcome: 'compatibility-passed', eligible: false, enrolled: false, unlocked: false });
  for (const stage of ['silent-before', 'unwrap-second', 'private-export']) {
    expect(report.checks.find((check: { test: string }) => check.test === stage).status).toBe('not-run');
  }
  expect(report.remaining).toHaveLength(4);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ capabilities: 1, compatibilities: 1, proofs: 0, verifies: 0 });
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await hello.getByRole('button', { name: 'Проверить совместимость PKCS#1', exact: true }).click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
});

test('PKCS#1 compatibility shares single flight and discards late results after Lock all', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  const compatibility = page.getByRole('button', { name: 'Проверить совместимость PKCS#1', exact: true });
  await compatibility.click();
  for (const name of ['Проверить совместимость PKCS#1', 'Проверить OAEP с подтверждением', 'Проверить защищённый ключ', 'Проверить отпечаток или PIN']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.getByText('Подтверждена только совместимость со старым алгоритмом;', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ compatibilities: 1, capabilities: 0, proofs: 0, verifies: 0 });
});

test('PKCS#1 behavior is explicit, shows measured stages and cannot enable unlock', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await hello.getByRole('button', { name: 'Проверить совместимость PKCS#1', exact: true }).click();
  expect(await page.evaluate(() => (window as any).helloTest.counts().behaviors)).toBe(0);
  const behavior = hello.getByRole('button', { name: 'Проверить поведение ключа PKCS#1', exact: true });
  await behavior.click();
  await expect(hello.getByText('Две расшифровки PKCS#1 вернули тестовый секрет;', { exact: false })).toBeVisible();
  await expect(hello.locator('.hello-proof-checks')).not.toContainText('OAEP');
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report).toMatchObject({ purpose: 'synthetic-pkcs1-behavior', algorithm: 'rsa-pkcs1-v1_5', outcome: 'behavior-passed', eligible: false, enrolled: false, unlocked: false });
  expect(report.checks).toHaveLength(13);
  expect(report.checks.every((check: { status: string }) => check.status === 'passed')).toBe(true);
  expect(report.remaining).toHaveLength(4);
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.evaluate(() => (window as any).helloTest.behaviorFailure('silent-before'));
  await behavior.click();
  await expect(hello.getByText('Две расшифровки PKCS#1 вернули тестовый секрет;', { exact: false })).toHaveCount(0);
  await expect(behavior).toBeEnabled();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  await expect(hello.locator('pre')).toContainText('silent-decrypt-unexpected-success');
  const failed = JSON.parse(await hello.locator('pre').innerText());
  expect(failed.outcome).toBe('blocked');
  expect(failed.checks.find((check: { test: string }) => check.test === 'silent-before')).toMatchObject({ status: 'failed', operation: 'silent-decrypt-unexpected-success' });
  expect(failed.checks.find((check: { test: string }) => check.test === 'unwrap-first').status).toBe('not-run');
  expect(failed.checks.at(-1)).toMatchObject({ test: 'test-key-delete', status: 'passed' });
  await page.evaluate(() => (window as any).helloTest.behaviorFailure('test-key-delete'));
  await behavior.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
});

test('PKCS#1 behavior shares single flight and discards a late report after Lock all', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  await page.getByRole('button', { name: 'Проверить поведение ключа PKCS#1', exact: true }).click();
  for (const name of ['Проверить поведение ключа PKCS#1', 'Проверить совместимость PKCS#1', 'Проверить OAEP с подтверждением', 'Проверить защищённый ключ', 'Проверить отпечаток или PIN']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.getByText('Две расшифровки PKCS#1 вернули тестовый секрет;', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ behaviors: 1, compatibilities: 0, capabilities: 0, proofs: 0, verifies: 0 });
});

test('private export details distinguish unsupported formats from permission refusal', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.behaviorFailure('private-export'));
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await hello.getByRole('button', { name: 'Проверить поведение ключа PKCS#1', exact: true }).click();
  await expect(hello.getByText('Формат недоступен для этого ключа', { exact: false })).toBeVisible();
  await expect(hello.getByText('Доступ запрещён', { exact: false })).toBeVisible();
  await expect(hello.getByText('Проверка экспорта не прошла', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.outcome).toBe('blocked');
  expect(report.exportChecks).toHaveLength(3);
  expect(report.checks.at(-1)).toMatchObject({ test: 'test-key-delete', status: 'passed' });
  expect(report).toMatchObject({ eligible: false, enrolled: false, unlocked: false });
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('attestation capability remains unverified and shows bounded metadata or original failure', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const action = hello.getByRole('button', { name: 'Проверить возможность аттестации ключа', exact: true });
  await action.click();
  await expect(hello.getByText('Его подпись, доверие к подписавшему ключу', { exact: false })).toBeVisible();
  await expect(hello.getByText('Размер свидетельства в байтах: 1234.', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report).toMatchObject({ purpose: 'synthetic-attestation-capability', eligible: false, enrolled: false, unlocked: false,
    attestationClaim: { api: 'NCryptCreateClaim', claimType: 'subject-only', verification: 'not-performed', bytes: 1234 } });
  expect(report.remaining).toHaveLength(4);
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.evaluate(() => (window as any).helloTest.attestationResult('unavailable'));
  await action.click();
  await expect(hello.getByText('это не означает отсутствия TPM', { exact: false })).toBeVisible();
  await expect(hello.getByText('0x80090029', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await action.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
});

test('attestation capability shares single flight and discards a late result after Lock all', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  await page.getByRole('button', { name: 'Проверить возможность аттестации ключа', exact: true }).click();
  for (const name of ['Проверить возможность аттестации ключа', 'Проверить поведение ключа PKCS#1', 'Проверить защищённый ключ', 'Проверить отпечаток или PIN']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.getByText('Его подпись, доверие к подписавшему ключу', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ attestations: 1, behaviors: 0, proofs: 0, verifies: 0 });
});


test('PRF capability stays read-only while synthetic encryption cannot enable vault unlock', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await page.evaluate(() => (window as any).helloTest.configure('not-configured'));
  await hello.getByRole('button', { name: 'Проверить Windows Hello', exact: true }).click();
  const probe = hello.getByRole('button', { name: 'Проверить Windows Hello PRF', exact: true });
  await expect(probe).toBeDisabled();
  await hello.getByRole('button', { name: 'Проверить поддержку PRF', exact: true }).click();
  await expect(hello.getByText('Сборка Windows: 26200.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as any).helloTest.counts().prf)).toBe(0);
  await page.evaluate(() => (window as any).helloTest.configure('available'));
  await hello.getByRole('button', { name: 'Проверить Windows Hello', exact: true }).click();
  await probe.click();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.outcome).toBe('prf-roundtrip-passed');
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false, false, false]);
  expect(report.webauthn.tpmBinding).toBe('not-verified');
  expect(report.checks.at(-1)).toEqual({ test: 'test-passkey-delete', status: 'passed' });
  expect(report.remaining).toHaveLength(4);
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await probe.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
});

test('direct attestation reports none honestly, retains recovery and exposes cleanup failures', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const probe = hello.getByRole('button', { name: 'Получить удостоверение Windows Hello', exact: true });
  await page.evaluate(() => (window as any).helloTest.configure('not-configured'));
  await hello.getByRole('button', { name: 'Проверить Windows Hello', exact: true }).click();
  await expect(probe).toBeDisabled();
  await page.evaluate(() => (window as any).helloTest.configure('available'));
  await hello.getByRole('button', { name: 'Проверить Windows Hello', exact: true }).click();
  await probe.click();
  await expect(hello.getByText('Windows создала тестовый passkey без удостоверения.', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.directAttestation.format).toBe('none');
  expect(report.directAttestation.innerRsaKey).toBe('not-attested');
  expect(report.directAttestation.prfSecretProtection).toBe('not-verified');
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false, false, false]);
  expect(report.remaining).toHaveLength(4);
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await probe.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
});

test('pending direct attestation shares single flight and discards late metadata after Lock All', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  const probe = page.getByRole('button', { name: 'Получить удостоверение Windows Hello', exact: true });
  await probe.click();
  await expect(probe).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить Windows Hello PRF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.locator('.hello-proof-report')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ directAttestations: 1, prf: 0, tpmProofs: 0 });
});

test('pending native PRF cannot be duplicated or publish results after Lock All', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  const probe = page.getByRole('button', { name: 'Проверить Windows Hello PRF', exact: true });
  await probe.click();
  await expect(probe).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить поддержку PRF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await expect(page.getByLabel('Мастер-пароль', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.locator('.hello-proof-report')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts().prf)).toBe(1);
});

test('TPM diagnostic needs no Hello enrollment and cannot enable real unlock', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await page.evaluate(() => (window as any).helloTest.configure('not-configured'));
  await hello.getByRole('button', { name: 'Проверить Windows Hello', exact: true }).click();
  await hello.getByRole('button', { name: 'Проверить провайдер TPM', exact: true }).click();
  expect(await page.evaluate(() => (window as any).helloTest.counts().tpmProofs)).toBe(0);
  const probe = hello.getByRole('button', { name: 'Проверить внутренний слой TPM', exact: true });
  await expect(probe).toBeEnabled();
  await probe.click();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.purpose).toBe('synthetic-tpm-inner');
  expect(report.tpm).toMatchObject({ exportPolicy: 0, keyUsage: 1 });
  expect(report.checks).toHaveLength(11);
  expect(report.exportChecks.every((c: { result: string }) => c.result === 'refused')).toBe(true);
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false, false, false]);
  expect(report.perKeyTpmEvidence).toBe('not-verified');
  expect(report.authorization).toBe('no-hello-authorization');
  expect(report.processScope).toBe('same-process');
  await expect(page.getByRole('button', { name: 'Войти через Hello', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await probe.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
});

test('pending TPM work shares single flight and discards a late result after Lock All', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  await page.getByRole('button', { name: 'Проверить внутренний слой TPM', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Проверить провайдер TPM', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить Windows Hello PRF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.locator('.hello-proof-report')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts().tpmProofs)).toBe(1);
});

test('local TPM binding is a separate report, keeps unlock disabled and surfaces cleanup failure', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const probe = hello.getByRole('button', { name: 'Проверить привязку ключа к TPM', exact: true });
  await probe.click();
  await expect(hello.getByText('Тестовый ключ совпал с ответом TPM', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.purpose).toBe('synthetic-tpm-local-binding');
  expect(report.checks).toHaveLength(12);
  expect(report.perKeyTpmEvidence).toBe('local-read-public-observed');
  expect(report.exportChecks).toEqual([]);
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false, false, false]);
  expect(report.remaining).toHaveLength(4);
  expect(await page.evaluate(() => (window as any).helloTest.counts())).toMatchObject({ tpmLocalBindings: 1, tpmProofs: 0, directAttestations: 0 });
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await probe.click();
  await expect(hello.getByText('Windows не удалила тестовый ключ приложения.', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  expect(JSON.parse(await hello.locator('pre').innerText()).perKeyTpmEvidence).toBe('not-verified');
});

test('local binding shares single flight and late results cannot survive Lock All', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  const probe = page.getByRole('button', { name: 'Проверить привязку ключа к TPM', exact: true });
  await probe.click();
  await expect(probe).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Проверить Windows Hello PRF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.locator('.hello-proof-report')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.counts().tpmLocalBindings)).toBe(1);
});

test('combined preparation requires a full restart, blocks duplicate work and exposes cleanup', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const prepare = hello.getByRole('button', { name: '1. Создать тест Hello + TPM', exact: true });
  const resume = hello.getByRole('button', { name: '2. Продолжить после перезапуска', exact: true });
  const cleanup = hello.getByRole('button', { name: 'Удалить тест и временные ключи', exact: true });
  await expect(prepare).toBeEnabled(); await expect(resume).toBeDisabled(); await expect(cleanup).toBeDisabled();
  await page.evaluate(() => (window as any).helloTest.defer());
  await prepare.click();
  await expect(prepare).toBeDisabled(); await expect(hello.getByRole('button', { name: 'Проверить Windows Hello PRF', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(hello.getByText('Тест сохранён. Полностью закройте', { exact: false })).toBeVisible();
  await expect(resume).toBeDisabled(); await expect(cleanup).toBeEnabled();
  await cleanup.click();
  await expect(hello.getByText('Тестовый контейнер и временные ключи удалены.', { exact: true })).toBeVisible();
  await expect(prepare).toBeEnabled();
  expect(await page.evaluate(() => (window as any).helloTest.combinedCounts())).toEqual({ combinedPrepares: 1, combinedResumes: 0, combinedCleanups: 1 });
});

test('saved combined test resumes, cancellation preserves retry, success never enables vault unlock', async ({ page }) => {
  await page.goto('/shell.html');
  await page.evaluate(() => (window as any).helloTest.combinedState('ready-to-resume'));
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const resume = hello.getByRole('button', { name: '2. Продолжить после перезапуска', exact: true });
  await expect(resume).toBeEnabled();
  await page.evaluate(() => (window as any).helloTest.proofOutcome('cancelled'));
  await resume.click();
  await expect(resume).toBeEnabled();
  await page.evaluate(() => (window as any).helloTest.proofOutcome('roundtrip-passed'));
  await resume.click();
  await expect(hello.getByText('Обе новые проверки Hello и расшифровки TPM после перезапуска пройдены.', { exact: false })).toBeVisible();
  await expect(resume).toBeDisabled();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false, false, false]);
  expect(report.processScope).toBe('fresh-process');
  expect(report.combinedState).toBe('no-test');
});

test('unfinished combined cleanup stays available when Hello is disabled', async ({ page }) => {
  await page.goto('/shell.html');
  await page.evaluate(() => { (window as any).helloTest.combinedState('cleanup-required'); (window as any).helloTest.configure('disabled-by-policy'); });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const cleanup = hello.getByRole('button', { name: 'Удалить тест и временные ключи', exact: true });
  await expect(cleanup).toBeEnabled();
  await expect(hello.getByRole('button', { name: '1. Создать тест Hello + TPM', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await cleanup.click();
  await expect(cleanup).toBeEnabled();
  await expect(hello.getByText('Незавершённый тест требует очистки.', { exact: false })).toBeVisible();
});

test('key-loss experiment is single-flight, shows exact absence evidence and never enrolls', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const loss = hello.getByRole('button', { name: 'Проверить потерю временных ключей', exact: true });
  await expect(loss).toBeEnabled();
  await page.evaluate(() => (window as any).helloTest.defer());
  await loss.click();
  await expect(loss).toBeDisabled();
  await expect(hello.getByRole('button', { name: '1. Создать тест Hello + TPM', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(hello.getByText('До удаления расшифровка прошла.', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.purpose).toBe('synthetic-combined-key-loss');
  expect(report.processScope).toBe('same-process');
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false, false, false]);
  expect(report.checks.find((c: any) => c.test === 'loss-tpm-reopen').nativeCode).toBe('0x80090016');
  expect(await page.evaluate(() => (window as any).helloTest.keyLossCalls())).toBe(1);
});

test('key-loss experiment preserves existing work and exposes cleanup after partial deletion', async ({ page }) => {
  await page.goto('/shell.html');
  await page.evaluate(() => (window as any).helloTest.combinedState('ready-to-resume'));
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const loss = hello.getByRole('button', { name: 'Проверить потерю временных ключей', exact: true });
  await expect(loss).toBeDisabled();
  await hello.getByRole('button', { name: 'Удалить тест и временные ключи', exact: true }).click();
  await expect(loss).toBeEnabled();
  await page.evaluate(() => (window as any).helloTest.failCleanup());
  await loss.click();
  await expect(loss).toBeDisabled();
  await expect(hello.getByRole('button', { name: 'Удалить тест и временные ключи', exact: true })).toBeEnabled();
  await expect(hello.getByText('Незавершённый тест требует очистки.', { exact: false })).toBeVisible();
});

test('late key-loss reports stay redacted after Lock All', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  await page.getByRole('button', { name: 'Проверить потерю временных ключей', exact: true }).click();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.locator('.hello-proof-report')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.keyLossCalls())).toBe(1);
});

test('copy creation preserves source keys and enables re-export while blocking other creations', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  await hello.getByRole('button', { name: 'Создать файл проверки переноса', exact: true }).click();
  await expect(hello.getByText('Зашифрованный тестовый файл сохранён и проверен чтением.', { exact: false })).toBeVisible();
  await expect(hello.getByRole('button', { name: 'Сохранить тестовый файл ещё раз', exact: true })).toBeEnabled();
  await expect(hello.getByRole('button', { name: '1. Создать тест Hello + TPM', exact: true })).toBeDisabled();
  await expect(hello.getByRole('button', { name: '2. Продолжить после перезапуска', exact: true })).toBeDisabled();
  await expect(hello.getByRole('button', { name: 'Проверить потерю временных ключей', exact: true })).toBeDisabled();
  await expect(hello.getByRole('button', { name: 'Удалить тест и временные ключи', exact: true })).toBeEnabled();
});

test('copy import works without configured Hello, reports correlation, and preserves source UI state', async ({ page }) => {
  await page.goto('/shell.html');
  await page.evaluate(() => { (window as any).helloTest.combinedState('copy-ready'); (window as any).helloTest.configure('disabled-by-policy'); });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const hello = page.getByRole('region', { name: 'Windows Hello', exact: true });
  const check = hello.getByRole('button', { name: 'Проверить тестовый файл', exact: true });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(hello.locator('.hello-copy-fingerprint')).toHaveText('ab'.repeat(32));
  await expect(hello.getByText('Тест переноса сохранён.', { exact: false })).toBeVisible();
  await expect(hello.getByText('В другом контексте Windows отсутствует', { exact: false })).toBeVisible();
  await hello.getByText('Технический отчёт', { exact: true }).click();
  const report = JSON.parse(await hello.locator('pre').innerText());
  expect(report.combinedState).toBeUndefined();
  expect([report.eligible, report.enrolled, report.unlocked]).toEqual([false,false,false]);
  await page.evaluate(() => (window as any).helloTest.copyRelation('same-account-and-installation'));
  await check.click();
  await expect(hello.getByText('Файл расшифрован через Hello и TPM', { exact: false })).toBeVisible();
});

test('copy import is single-flight and ignores late replies after Lock All', async ({ page }) => {
  await page.goto('/shell.html');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.defer());
  await page.getByRole('button', { name: 'Проверить тестовый файл', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Создать файл проверки переноса', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Заблокировать всё', exact: true }).click();
  await page.evaluate(() => (window as any).helloTest.release());
  await expect(page.locator('.hello-proof-report')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).helloTest.copyChecks())).toBe(1);
});
