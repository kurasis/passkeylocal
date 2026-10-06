import { test, expect } from "@playwright/test";
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
    page.getByText("Preview is unavailable in this build.", { exact: false }),
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
