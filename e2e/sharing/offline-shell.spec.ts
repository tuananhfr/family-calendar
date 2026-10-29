import { expect, test } from "@playwright/test";
import { onboard } from "../helpers/onboard";
import { addEvent } from "../helpers/items";
import { occurrenceOnBoard } from "../helpers/items-occurrence";
import { expectOfflineShellReady } from "../helpers/pwa";

test("production base path opens the app offline after reload and in another tab", async ({ page, context }) => {
  const base = "/lich-gia-dinh";
  await onboard(page, { basePath: base });
  await addEvent(page, { title: "Offline dưới đường dẫn con", start: "18:00", end: "19:00", members: ["Mẹ"] });
  await expectOfflineShellReady(page, base);
  await context.setOffline(true);
  await page.reload();
  await expect(occurrenceOnBoard(page, "Offline dưới đường dẫn con")).toBeVisible();
  const second = await context.newPage();
  await second.goto(base + "/hom-nay/");
  await expect(occurrenceOnBoard(second, "Offline dưới đường dẫn con")).toBeVisible();
});
