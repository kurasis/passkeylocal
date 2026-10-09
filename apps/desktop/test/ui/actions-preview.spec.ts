import { test, expect } from "@playwright/test";

test("right-click file actions edit, favorite, recycle and retain explicit export consent", async ({ page }) => {
  await page.goto("/?explorer=nested");
  const file = page.getByRole("button", { name: "Root readme.txt", exact: true });
  await file.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Renamed.txt");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await page.getByRole("button", { name: "Close details", exact: true }).click();
  const renamed = page.getByRole("button", { name: "Renamed.txt", exact: true });
  await renamed.focus(); await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Favorite", exact: true }).click();
  await expect(page.getByRole("button", { name: "★ Renamed.txt", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "★ Renamed.txt", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Export unencrypted copy", exact: true }).click();
  await expect(page.getByLabel("I understand that this creates an unencrypted copy.", { exact: true })).toBeFocused();
  for (const button of await page.getByRole("button", { name: "Export unencrypted copy", exact: true }).all()) await expect(button).toBeDisabled();
  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await page.getByRole("button", { name: "★ Renamed.txt", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to recycle bin", exact: true }).click();
  await expect(page.getByRole("button", { name: "★ Renamed.txt", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Recycle bin", exact: true }).click();
  await page.getByRole("button", { name: "★ Renamed.txt", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Restore from recycle bin", exact: true }).click();
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await expect(page.getByRole("button", { name: "★ Renamed.txt", exact: true })).toBeVisible();
});

test("folder menu creates in its target, renames and removes only empty folders", async ({ page }) => {
  await page.goto("/?explorer=nested");
  const documents = page.getByRole("button", { name: "Open folder: Documents", exact: true });
  await documents.click({ button: "right" });
  await page.getByRole("menuitem", { name: "New subfolder", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New subfolder", exact: true });
  await dialog.getByLabel("Folder name", { exact: true }).fill("Child from menu");
  await dialog.getByRole("button", { name: "New folder", exact: true }).click();
  await documents.click();
  const child = page.getByRole("button", { name: "Open folder: Child from menu", exact: true });
  await child.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await page.getByRole("dialog", { name: "Rename", exact: true }).getByLabel("Folder name", { exact: true }).fill("Renamed child");
  await page.getByRole("dialog", { name: "Rename", exact: true }).getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("button", { name: "Open folder: Renamed child", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove empty folder", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove empty folder", exact: true }).getByRole("button", { name: "Remove empty folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open folder: Renamed child", exact: true })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Current folder" }).getByRole("button", { name: "File Safe", exact: true }).click();
  await documents.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove empty folder", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove empty folder", exact: true }).getByRole("button", { name: "Remove empty folder", exact: true }).click();
  await expect(page.getByText("The folder contains files or subfolders, including recycled files. Move them first.", { exact: true })).toBeVisible();
  await expect(documents).toBeVisible();
});

test("context menus stay inside every theme viewport and keyboard dismissal restores focus", async ({ page }) => {
  await page.goto("/?explorer=nested");
  for (const theme of ["color", "light", "dark"]) {
    await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
    await page.setViewportSize({ width: 360, height: 800 });
    const file = page.getByRole("button", { name: "Root readme.txt", exact: true });
    await file.scrollIntoViewIfNeeded(); await file.focus(); await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    const box = await menu.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(360); expect(box!.y + box!.height).toBeLessThanOrEqual(800);
    await page.keyboard.press("End"); await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0); await expect(file).toBeFocused();
  }
});

test("TXT preview renders inert UTF-8, virtualizes long output and closes its request", async ({ page }) => {
  await page.goto("/?explorer=nested");
  await page.getByRole("button", { name: "Root readme.txt", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "TXT preview", exact: true });
  await expect(dialog.getByText("Synthetic inert <script>alert(1)</script>", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Привет 🗂", { exact: true })).toBeVisible();
  await expect(dialog.locator("script,a,iframe,object,img")).toHaveCount(0);
  expect(await dialog.locator("pre").count()).toBeLessThanOrEqual(24);
  await dialog.getByLabel("Text section", { exact: true }).fill("6");
  const text = dialog.getByRole("region", { name: "TXT preview", exact: true });
  await text.focus(); await page.keyboard.press("End");
  await expect(dialog.getByText("Synthetic line 99999", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Larger text", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).uiTest.previewCalls().map((r: any) => r.operation))).toEqual(["read", "cancel"]);
});

test("lock during delayed preview redacts it and a late reply cannot populate a new unlock", async ({ page }) => {
  await page.goto("/?explorer=nested");
  await page.evaluate(() => (window as any).uiTest.delayPreview());
  await page.getByRole("button", { name: "Root readme.txt", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Reading verified file");
  await page.getByRole("dialog").getByRole("button", { name: "Lock file safe", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("File-safe master password", { exact: true }).fill("synthetic password");
  await page.getByRole("button", { name: "Unlock file safe", exact: true }).click();
  await page.evaluate(() => (window as any).uiTest.releasePreview());
  await expect(page.getByRole("button", { name: "Root readme.txt", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic inert", { exact: false })).toHaveCount(0);
});

test("imports belong to sidebar and explorer path/search start alongside it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/?explorer=nested");
  const sidebar = page.locator(".file-safe-sidebar");
  await expect(sidebar.getByRole("button", { name: "Copy files into safe", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Copy folder into safe", exact: true })).toBeVisible();
  await expect(sidebar.getByLabel("Folder name", { exact: true })).toBeVisible();
  const left = await sidebar.boundingBox(); const path = await page.getByRole("navigation", { name: "Current folder", exact: true }).boundingBox();
  expect(path!.x).toBeGreaterThan(left!.x + left!.width); expect(Math.abs(path!.y - left!.y)).toBeLessThan(10);
  for (const width of [320, 720, 1280]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});
