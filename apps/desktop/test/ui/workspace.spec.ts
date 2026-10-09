import { test, expect } from "@playwright/test";

test("unlock reloads metadata without concurrent reads or a permanently empty BUSY page", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: "Synthetic private canary 00000", exact: false });
  await expect(first).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.exclusiveReads());
  await page.getByRole("button", { name: "Lock file safe", exact: true }).click();
  await page.getByLabel("File-safe master password", { exact: true }).fill("synthetic password");
  await page.getByRole("button", { name: "Unlock file safe", exact: true }).click();
  await expect(first).toBeVisible();
  expect(await page.evaluate(() => (window as any).uiTest.readCounts())).toMatchObject({ activeReads: 0, peakReads: 1, busyReads: 0 });
  await expect(page.getByText("Another file operation is running.", { exact: true })).toHaveCount(0);
});

test("fresh password admission waits for native status after a lock", async ({
  page,
}) => {
  await page.goto("/");
  const firstFile = page.getByRole("button", {
    name: "Synthetic private canary 00000",
    exact: false,
  });
  await expect(firstFile).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { uiTest: { deferStatus(): void } }).uiTest.deferStatus(),
  );
  await page.getByRole("button", { name: "Lock file safe", exact: true }).click();
  await page
    .getByLabel("File-safe master password", { exact: true })
    .fill("synthetic password");
  const unlock = page.getByRole("button", {
    name: "Unlock file safe",
    exact: true,
  });
  await expect(unlock).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { uiTest: { pendingStatus(): number } }).uiTest.pendingStatus(),
      ),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() =>
    (window as unknown as { uiTest: { releaseStatus(): void } }).uiTest.releaseStatus(),
  );
  await expect(unlock).toBeEnabled();
  await unlock.click();
  await expect(firstFile).toBeVisible();
});

test("a new session loads without waiting for an old metadata reply and ignores it later", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: "Synthetic private canary 00000", exact: false });
  await expect(first).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.setDelay());
  await page.getByRole("searchbox").fill("00002");
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.readCounts().activeReads)).toBe(1);
  await page.evaluate(() => { (window as any).uiTest.lock(); (window as any).uiTest.resumeReads(); });
  await page.getByLabel("File-safe master password", { exact: true }).fill("synthetic password");
  await page.getByRole("button", { name: "Unlock file safe", exact: true }).click();
  await expect(first).toBeVisible();
  await expect(page.getByText("Page 1 · 10000", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.release());
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.readCounts().activeReads)).toBe(0);
  await expect(first).toBeVisible();
  await expect(page.getByText("Page 1 · 10000", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("");
});

test("10,000-entry synthetic metadata UI is paged, virtualized and keyboard scrollable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 00000",
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(12);
  await expect(page.getByText("Page 1 · 10000")).toBeVisible();
  const viewport = page.getByRole("list", { name: "Files", exact: true });
  await viewport.focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 00099",
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 · 10000")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 00100",
      exact: false,
    }),
  ).toBeVisible();
  const start = Date.now();
  await page.getByRole("searchbox").fill("09999");
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 09999",
      exact: false,
    }),
  ).toBeVisible();
  expect(Date.now() - start).toBeLessThan(2000);
  await page
    .getByRole("button", {
      name: "Synthetic private canary 09999",
      exact: false,
    })
    .click();
  await expect(
    page.getByText("Preview supports plain UTF-8 .txt files", { exact: false }),
  ).toBeVisible();
  for (const button of await page
    .getByRole("button", { name: "Export unencrypted copy", exact: true })
    .all())
    await expect(button).toBeDisabled();
  await expect(
    page.getByText("9007199254740993", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("native lock redacts names/search/details and refuses a late metadata reply", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 00000",
      exact: false,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { uiTest: { setDelay(): void } }).uiTest.setDelay(),
  );
  await page.getByRole("searchbox").fill("00002");
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    (window as unknown as { uiTest: { lock(): void } }).uiTest.lock(),
  );
  await expect(
    page.getByLabel("File-safe master password", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { uiTest: { release(): void } }).uiTest.release(),
  );
  await page.waitForTimeout(100);
  await expect(
    page.getByText("Synthetic private canary", { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
});

test("pending search survives a language change and lock still redacts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 00000",
      exact: false,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { uiTest: { setDelay(): void } }).uiTest.setDelay(),
  );
  await page.getByRole("searchbox").fill("00002");
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    (window as unknown as { uiTest: { russian(): void } }).uiTest.russian(),
  );
  await expect(
    page.getByRole("button", {
      name: "Заблокировать файловый сейф",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { uiTest: { release(): void } }).uiTest.release(),
  );
  await expect(
    page.getByRole("button", {
      name: "Synthetic private canary 00002",
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.evaluate(() =>
    (window as unknown as { uiTest: { lock(): void } }).uiTest.lock(),
  );
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(
    page.getByText("Synthetic private canary", { exact: false }),
  ).toHaveCount(0);
});
