import { expect, type Locator, type Page } from "@playwright/test";

/** The visible "Thêm mới" (sidebar on desktop, centre button of the bottom nav on phones). */
export async function openAddNew(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Thêm mới" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radiogroup", { name: "Loại thông tin" })).toBeVisible();
  return dialog;
}

/** Picks members inside the item form; their buttons are named "<avatar alt> <label>". */
export async function pickMembers(dialog: Locator, names: string[]): Promise<void> {
  const group = dialog.getByRole("group", { name: /Thành viên|Ai cần nhắc|Giao cho/ });
  for (const n of names) await group.getByRole("button", { name: `${n} ${n}` }).click();
}

export async function addEvent(page: Page, e: { title: string; date?: string; start: string; end: string; members?: string[] }): Promise<void> {
  const dialog = await openAddNew(page);
  await dialog.getByRole("textbox", { name: "Tiêu đề" }).fill(e.title);
  if (e.date) await dialog.getByRole("textbox", { name: "Thời gian" }).fill(e.date);
  await dialog.getByRole("textbox", { name: "Giờ bắt đầu" }).fill(e.start);
  await dialog.getByRole("textbox", { name: "Giờ kết thúc" }).fill(e.end);
  await pickMembers(dialog, e.members ?? []);
  await dialog.getByRole("button", { name: "Lưu sự kiện" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
