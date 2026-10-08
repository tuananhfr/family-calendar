import { expect, type Page } from "@playwright/test";

export interface OnboardPerson {
  /** Preset button label on step 1, e.g. "Bố", "Con trai". */
  preset: string;
  /** Typed name for presets that start empty (children, guardian, other). */
  name?: string;
}

/** Drives the three onboarding steps through the UI; leaves the page on Today. */
export async function onboard(
  page: Page,
  opts: { people?: OnboardPerson[]; start?: string; usedBy?: string; basePath?: string } = {},
): Promise<void> {
  const people = opts.people ?? [{ preset: "Bố" }, { preset: "Mẹ" }, { preset: "Con trai", name: "Minh" }];
  await page.goto(`${opts.basePath ?? ""}/`);
  await page.getByRole("link", { name: "Bắt đầu dùng", exact: true }).first().click();
  await page.waitForURL("**/bat-dau/");
  const presets = page.getByRole("group", { name: "Bấm để thêm người" });
  for (const p of people) {
    // The avatar's alt text is part of the button name, so match on the visible label span instead.
    await presets.locator("button", { has: page.locator("span", { hasText: new RegExp(`^${p.preset}$`) }) }).click();
    if (p.name) await page.keyboard.type(p.name);
  }
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  if (opts.start) await page.getByRole("radio", { name: new RegExp(opts.start) }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  if (opts.usedBy) await page.getByRole("button", { name: opts.usedBy, exact: true }).click();
  await page.getByRole("button", { name: "Dùng trên máy này" }).click();
  await page.waitForURL((u) => u.pathname === `${opts.basePath ?? ""}/hom-nay/`);
  await expect(page.getByRole("main")).toBeVisible();
}
