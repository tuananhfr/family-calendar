import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const base = "/lich-gia-dinh";
test("identity entry and error screens remain readable in light and dark themes", async ({ browser }, info) => {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ locale: "vi-VN" });
    await context.addInitScript((theme) => localStorage.setItem("fc.theme", theme), theme);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, title] of [["/dang-nhap/", "Đăng nhập bằng email"], ["/khoi-phuc/", "Khôi phục quyền truy cập"],
        ["/xac-thuc/", "Xác thực email"], ["/tham-gia/", "Tham gia gia đình"]]) {
        await page.goto(base + route);
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(await page.locator("body").innerText()).not.toMatch(/sharing\.[a-zA-Z_]+|�/);
        await page.screenshot({ path: info.outputPath(theme + "-" + width + "-" + route.replaceAll("/", "") + ".png"), fullPage: true });
      }
    }
    expect(errors).toEqual([]);
    await context.close();
  }
  if (process.env.VISUAL_QA_SCRIPT) {
    const result = await promisify(execFile)(process.execPath, [process.env.VISUAL_QA_SCRIPT,
      "--url", "http://127.0.0.1:3006" + base + "/dang-nhap/", "--page-type", "app",
      "--viewport", "1440x900", "--viewport", "768x900", "--viewport", "390x900", "--viewport", "320x900",
      "--out", info.outputPath("mechanical-layout-audit")], { cwd: process.cwd(), timeout: 60_000 });
    console.log(result.stdout);
  }
});
