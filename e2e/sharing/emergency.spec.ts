import { expect, test } from "@playwright/test";
import { onboard } from "../helpers/onboard";
import { emergencyRows, triggerEmergency } from "../helpers/emergency";
import { expectOfflineShellReady } from "../helpers/pwa";

test("SOS works offline at the production base path and does not enqueue LOCAL_ONLY delivery", async ({ page, context }) => {
  const base = "/lich-gia-dinh";
  await onboard(page, { basePath: base });
  await page.goto(base + "/sos/");
  await expectOfflineShellReady(page, base);
  await context.setOffline(true);
  await triggerEmergency(page);
  const original = (await emergencyRows(page)).events[0];
  await page.reload();
  await expect(page.getByRole("heading", { name: "Đang cần trợ giúp", exact: true })).toBeVisible();
  expect((await emergencyRows(page)).events[0]).toMatchObject({ id: original.id, createdAt: original.createdAt });
  expect((await emergencyRows(page)).queue).toEqual([]);
  await page.getByRole("button", { name: "Tôi an toàn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã an toàn", exact: true })).toBeVisible();
});
