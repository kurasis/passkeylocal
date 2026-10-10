import { test, expect } from "@playwright/test";

test("nested folders, parent row, breadcrumbs and history follow the actual selected folder", async ({ page }) => {
  await page.goto("/?explorer=nested");
  const list = page.getByRole("table", { name: "Files", exact: true });
  const path = page.getByRole("navigation", { name: "Current folder", exact: true });
  await expect(list.locator(".file-safe-row").first()).toContainText("Documents");
  await expect(page.getByRole("button", { name: "Root readme.txt", exact: true })).toBeVisible();
  for (const folder of ["Documents", "2026", "Reports"]) {
    await page.getByRole("button", { name: `Open folder: ${folder}`, exact: true }).click();
    await expect(path.getByRole("button", { name: folder, exact: true })).toBeDisabled();
  }
  await expect(page.getByRole("button", { name: "Nested report.csv", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Root readme.txt", exact: true })).toHaveCount(0);
  await expect(list.locator(".file-safe-row").first()).toContainText("[..]");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: Reports", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Forward", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nested report.csv", exact: true })).toBeVisible();
  await list.getByRole("button", { name: "Parent folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: Reports", exact: true })).toBeVisible();
  await path.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("button", { name: "Invoice.pdf", exact: true })).toBeVisible();
  await path.getByRole("button", { name: "File Safe", exact: true }).click();
  await page.getByRole("button", { name: "Open folder: Images", exact: true }).click();
  await expect(path.getByRole("button", { name: "Images", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Forward", exact: true })).toBeDisabled();
});

test("new folders belong to the current parent and separate settings preserve the location", async ({ page }) => {
  await page.goto("/?explorer=nested");
  for (const name of ["Documents", "2026"]) await page.getByRole("button", { name: `Open folder: ${name}`, exact: true }).click();
  await page.getByLabel("Folder name", { exact: true }).fill("New subfolder");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: New subfolder", exact: true })).toBeVisible();
  const changes = await page.evaluate(() => (window as any).uiTest.changes());
  expect(changes.at(-1)).toMatchObject({ kind: "folder", parent_id: (101).toString(16).padStart(32, "0"), name: "New subfolder" });
  await expect(page.getByTestId("file-safe-hello")).toHaveCount(0);
  await page.getByRole("button", { name: "File-safe settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "File-safe settings", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Files", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Current folder", exact: true })).toHaveCount(0);
  await page.getByTestId("file-safe-hello").locator("summary").click();
  await page.getByLabel("Confirm file-safe master password", { exact: true }).fill("synthetic-not-submitted");
  await expect(page.getByLabel("Lock file safe after inactivity", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: New subfolder", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open folder: New subfolder", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Current folder", exact: true }).getByRole("button", { name: "New subfolder", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "File-safe settings", exact: true }).click();
  await page.getByTestId("file-safe-hello").locator("summary").click();
  await expect(page.getByLabel("Confirm file-safe master password", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => (window as any).uiTest.helloCalls())).toEqual([]);
});

test("locking discards a late folder reply and clears navigation history for a new session", async ({ page }) => {
  await page.goto("/?explorer=nested");
  await expect(page.getByRole("button", { name: "Root readme.txt", exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.setDelay());
  await page.getByRole("button", { name: "Open folder: Documents", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.readCounts().activeReads)).toBe(1);
  await page.evaluate(() => { (window as any).uiTest.lock(); (window as any).uiTest.resumeReads(); });
  await expect(page.getByRole("navigation", { name: "Current folder", exact: true })).toHaveCount(0);
  await expect(page.getByText("Documents", { exact: true })).toHaveCount(0);
  await page.getByLabel("File-safe master password", { exact: true }).fill("synthetic password");
  await page.getByRole("button", { name: "Unlock file safe", exact: true }).click();
  await expect(page.getByRole("button", { name: "Root readme.txt", exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).uiTest.release());
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.readCounts().activeReads)).toBe(0);
  await expect(page.getByRole("button", { name: "Root readme.txt", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invoice.pdf", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Forward", exact: true })).toBeDisabled();
});

test("child folders are independently paged, virtualized and reset their offset on navigation", async ({ page }) => {
  await page.goto("/?explorer=many");
  const list = page.getByRole("table", { name: "Files", exact: true });
  await expect(page.getByRole("button", { name: "Open folder: Folder 000", exact: true })).toBeVisible();
  expect(await list.locator(".file-safe-row").count()).toBeLessThanOrEqual(24);
  await list.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Open folder: Folder 199", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next folders", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: Folder 200", exact: true })).toBeVisible();
  await expect(list.locator(".file-safe-row")).toHaveCount(5);
  await page.getByRole("button", { name: "Open folder: Folder 200", exact: true }).click();
  await expect(list.getByRole("button", { name: "Parent folder", exact: true })).toBeVisible();
  expect((await page.evaluate(() => (window as any).uiTest.queries())).at(-1).folder_offset).toBe(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: Folder 000", exact: true })).toBeVisible();
});

test("Russian explorer and settings fit all palettes and small screens without losing long paths", async ({ page }) => {
  await page.goto("/?explorer=nested");
  await page.evaluate(() => (window as any).uiTest.russian());
  const longName = "Очень длинное название подпапки с документами за 2026 год";
  await page.getByLabel("Имя папки", { exact: true }).fill(longName);
  await page.getByRole("button", { name: "Новая папка", exact: true }).click();
  await page.getByRole("button", { name: `Открыть папку: ${longName}`, exact: true }).click();
  for (const theme of ["light", "color", "dark"]) {
    await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
    for (const width of [320, 720, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole("navigation", { name: "Текущая папка", exact: true }).getByRole("button", { name: longName, exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Настройки сейфа", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole("button", { name: "К файлам", exact: true }).click();
    }
  }
});


test("columns sort native file metadata while folders stay first and exact byte counts remain available", async ({ page }) => {
  await page.goto("/?explorer=nested");
  const list = page.getByRole("table", { name: "Files", exact: true });
  await expect(list.locator(".file-safe-row").nth(2)).toContainText("Alpha.txt");
  await page.getByRole("button", { name: "Sort by size", exact: true }).click();
  await expect(list.locator(".file-safe-row").nth(2)).toContainText("Alpha.txt");
  await expect(list.locator(".file-safe-row").nth(3)).toContainText("Root readme.txt");
  await expect(list.locator(".file-safe-row").first()).toContainText("Documents");
  await page.getByRole("button", { name: "Sort by date", exact: true }).click();
  await expect(list.locator(".file-safe-row").nth(2)).toContainText("Root readme.txt");
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(list.locator(".file-safe-row")).toHaveCount(1);
  await expect(list).toContainText("Zeta.log");
  await page.getByRole("button", { name: "Recycle bin", exact: true }).click();
  await expect(list).toContainText("old.bin");
  await page.getByRole("button", { name: "Files", exact: true }).click();
  for (const folder of ["Documents", "2026", "Reports"]) await page.getByRole("button", { name: `Open folder: ${folder}`, exact: true }).click();
  await expect(list.locator('[title="9007199254740993 B"]')).toBeVisible();
  await expect(list).toContainText("8 PiB");
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.getByLabel("Sort files", { exact: true }).selectOption("name");
  expect((await page.evaluate(() => (window as any).uiTest.queries())).at(-1).sort).toBe("name");
});
