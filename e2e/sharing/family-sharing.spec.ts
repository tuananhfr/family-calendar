import { test, expect, type Page, type Locator } from "@playwright/test";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { addEvent } from "../helpers/items";
import { onboard } from "../helpers/onboard";
import { resetTestDb } from "../helpers/db";
const base = "/lich-gia-dinh";
async function emailLink(purpose: string, after: number) {
  const dir = resolve(__dirname, "../../backend/var/e2e-mail");
  const files = await readdir(dir);
  for (const name of files.reverse()) {
    const path = resolve(dir, name);
    if ((await stat(path)).mtimeMs < after) continue;
    const text = (await readFile(path, "utf8")).replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    const link = text.match(new RegExp("http[^\\s<>]+/xac-thuc/#purpose=" + purpose + "&token=[A-Za-z0-9_-]+"));
    if (link) return link[0];
  }
  throw new Error("Test mail not found");
}
async function select(page: Page, label: string, option: string, scope: Locator | Page = page) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function rows(page: Page, store: string) {
  return page.evaluate(async (store) => {
    const idb = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("family-calendar"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const rows = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => { const req = idb.transaction(store).objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    idb.close(); return rows;
  }, store);
}
test("family sharing, new-device login and responsive screens under production base path", async ({ page, browser }, info) => {
  await resetTestDb();
  const consoleErrors: string[] = [];
  page.setDefaultTimeout(15_000);
  console.log("Starting onboarding and email verification");
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await onboard(page, { basePath: base, people: [{ preset: "Bố" }, { preset: "Mẹ" }] });
  await page.goto(base + "/cai-dat/?tab=account");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("sharing-owner@example.com");
  const sentAt = Date.now();
  await page.getByRole("button", { name: "Xác minh email", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nếu email phù hợp" })).toBeVisible();
  const link = await emailLink("link", sentAt);
  await page.goto(link);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByText("Email đã xác minh:", { exact: false })).toBeVisible();
  const father = (await rows(page, "members")).find((m) => m.displayName === "Bố")!;
  await page.goto(base + "/thanh-vien/them/?id=" + father.id);
  await page.locator('input[type="file"]').setInputFiles(resolve(__dirname, "../../frontend/public/illustrations/family-logo-02-mark.webp"));
  await expect(page.getByRole("button", { name: "Bỏ ảnh", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(base + "/thanh-vien/"));
  console.log("Opening sharing wizard");
  await page.goto(base + "/cai-dat/?tab=sharing");
  await select(page, "Bạn là ai trong gia đình?", "Bố");
  await page.getByRole("checkbox", { name: "Tôi đồng ý đưa dữ liệu", exact: false }).check();
  await page.screenshot({ path: info.outputPath("wizard-local.png"), fullPage: true });
  await page.getByRole("button", { name: "Bật chia sẻ gia đình", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã chia sẻ", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Mời người thân", exact: true }).click();
  await page.getByRole("button", { name: "Tạo lời mời", exact: true }).click();
  const invite = await page.locator("p").filter({ hasText: /^http.*\/tham-gia\/#token=/ }).innerText();
  await page.screenshot({ path: info.outputPath("invite-qr.png"), fullPage: true });
  expect(invite).toContain(base + "/tham-gia/#token=");
  console.log("Inviting second browser");
  const guestContext = await browser.newContext({ locale: "vi-VN" });
  const guest = await guestContext.newPage();
  await guest.goto(invite);
  await guest.getByRole("textbox", { name: "Tên người tham gia", exact: true }).fill("Mẹ");
  await guest.getByRole("button", { name: "Gửi yêu cầu tham gia", exact: true }).click();
  await expect(guest.getByText("Đã gửi yêu cầu — chờ chủ gia đình duyệt.")).toBeVisible();
  await guest.screenshot({ path: info.outputPath("join-pending.png"), fullPage: true });
  expect((await rows(guest, "members")).length).toBe(0);
  const decision = page.locator("div.rounded-control").filter({ has: page.getByRole("button", { name: "Duyệt tham gia", exact: true }) }).last();
  await select(page, "Gắn với thành viên", "Mẹ", decision);
  await decision.getByRole("button", { name: "Duyệt tham gia", exact: true }).click();
  await expect(guest.getByRole("button", { name: "Mở lịch gia đình" })).toBeVisible({ timeout: 15_000 });
  await guest.getByRole("button", { name: "Mở lịch gia đình" }).click();
  await expect(guest).toHaveURL(new RegExp(base + "/hom-nay/"));
  await expect.poll(async () => (await rows(guest, "members")).length).toBe(2);
  await page.goto(base + "/hom-nay/");
  await addEvent(page, { title: "Shared family appointment", start: "10:00", end: "11:00", members: ["Mẹ"] });
  await expect.poll(async () => (await rows(page, "items")).find((i) => i.title === "Shared family appointment")?.syncState, { timeout: 15_000 }).toBe("SYNCED");
  await guest.goto(base + "/cai-dat/?tab=sharing");
  await guest.getByRole("button", { name: "Đồng bộ ngay" }).click();
  await expect.poll(async () => (await rows(guest, "blobs")).length).toBeGreaterThan(0);
  await expect.poll(async () => (await rows(guest, "items")).some((i) => i.title === "Shared family appointment")).toBe(true);
  const spaces = await rows(page, "spaces");
  const shared = spaces.find((s) => s.sharingState === "SHARED")!;
  const request = page.context().request;
  const session = (await (await request.get(base + "/api/v1/session")).json()) as { csrfToken: string };
  const snapshot = await (await request.get(base + "/api/v1/spaces/" + shared.id + "/sync/snapshot")).json();
  const guestActor = snapshot.memberships.find((m: { actorId: string }) => m.actorId !== snapshot.access.actorId).actorId;
  console.log("Checking responsive screens");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/cai-dat/?tab=account", "/cai-dat/?tab=sharing", "/thanh-vien/them/?tab=link", "/quyen/"]) {
      await page.goto(base + route);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + " at " + width).toBe(true);
      await page.screenshot({ path: info.outputPath("screen-" + width + "-" + route.replace(/[^a-z]/gi, "_") + ".png"), fullPage: true });
      const missing = await page.locator("body").innerText();
      expect(missing).not.toMatch(/sharing\.[a-zA-Z_]+/);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/cai-dat/?tab=account");
  await page.getByRole("button", { name: "Tạo mã khôi phục", exact: true }).click();
  const recovery = await page.locator("code").innerText();
  const recoveryContext = await browser.newContext({ locale: "vi-VN" });
  const recovered = await recoveryContext.newPage();
  await recovered.goto("http://127.0.0.1:3006" + base + "/khoi-phuc/");
  await recovered.getByRole("textbox", { name: "Mã khôi phục", exact: true }).fill(recovery);
  await recovered.getByRole("button", { name: "Khôi phục quyền truy cập", exact: true }).click();
  await expect(recovered.getByText("Mã thay thế — lưu lại ngay")).toBeVisible();
  await recovered.getByRole("link", { name: "Mở lịch gia đình" }).click();
  await expect.poll(async () => (await rows(recovered, "members")).length).toBe(2);
  await recoveryContext.close();
  console.log("Checking new-device login");
  await page.goto(base + "/dang-nhap/");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("sharing-owner@example.com");
  const loginAt = Date.now();
  await page.getByRole("button", { name: "Gửi link đăng nhập" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nếu email phù hợp" })).toBeVisible();
  const newContext = await browser.newContext({ locale: "vi-VN" });
  const newDevice = await newContext.newPage();
  await onboard(newDevice, { basePath: base, people: [{ preset: "Bố" }] });
  const privateIdentity = (await rows(newDevice, "localIdentity"))[0];
  const localFamily = (await rows(newDevice, "spaces"))[0];
  await newDevice.goto(await emailLink("login", loginAt));
  await expect(newDevice.getByRole("combobox")).toBeVisible();
  await newDevice.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(newDevice).toHaveURL(new RegExp(base + "/hom-nay/"));
  await expect.poll(async () => (await rows(newDevice, "members")).filter((m) => m.spaceId === shared.id).length).toBe(2);
  expect((await rows(newDevice, "members")).filter((m) => m.spaceId === localFamily.id)).toHaveLength(1);
  expect((await rows(newDevice, "localIdentity"))[0]).toEqual(privateIdentity);
  const revoked = await request.post(base + "/api/v1/spaces/" + shared.id + "/memberships/" + guestActor + "/remove", { headers: { "X-CSRF-Token": session.csrfToken } });
  expect(revoked.status()).toBe(200);
  await guest.goto(base + "/cai-dat/?tab=sharing");
  await expect.poll(async () => (await rows(guest, "members")).length).toBe(0);
  await expect(guest.getByRole("heading", { name: "Quyền truy cập đã bị thu hồi." })).toBeVisible();
  expect(consoleErrors).toEqual([]);
  await guestContext.close(); await newContext.close();
});
