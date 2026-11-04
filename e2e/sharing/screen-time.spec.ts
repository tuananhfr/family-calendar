import { test, expect } from "@playwright/test";
import { onboard } from "../helpers/onboard";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = (process.env.E2E_SCREEN_TIME_BASE_PATH ?? "/lich-gia-dinh").replace(/\/+$/, "");

test("public Android guide downloads the actual signed release APK", async ({
  page,
  request,
}, info) => {
  await page.goto(base + "/tai-ung-dung/");
  await expect(
    page.getByRole("heading", { name: "Tải ứng dụng Android", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(base + "/tai-ung-dung/$"));
  const manifestResponse = await request.get(
    base + "/downloads/android-release.json",
  );
  expect(manifestResponse.ok()).toBe(true);
  const release = await manifestResponse.json();
  expect(release.buildType).toBe("release");
  expect(release.applicationId).toBe("vn.lichgiadinh.screentime");
  const apkResponse = await request.get(
    base + "/downloads/" + release.fileName,
  );
  expect(apkResponse.status()).toBe(200);
  expect(apkResponse.headers()["content-type"]).toBe(
    "application/vnd.android.package-archive",
  );
  expect(apkResponse.headers()["content-disposition"]).toContain("attachment;");
  expect(apkResponse.headers()["cache-control"]).toBe("no-cache");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("link", { name: "Tải app Android (.apk)", exact: true })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe(release.fileName);
  const downloadedPath = info.outputPath("android-release.apk");
  await download.saveAs(downloadedPath);
  const bytes = await readFile(downloadedPath);
  expect(bytes.length).toBe(release.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(release.sha256);
  expect(await (await request.get(base + "/sw.js")).text()).not.toContain(
    "/downloads/" + release.fileName,
  );
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("android-install-320.png"),
    fullPage: true,
  });
});

test("screen-time report, goals, pairing, responsive states and revoked access", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-11-03T03:00:00Z"));
  await onboard(page, {
    basePath: base,
    people: [{ preset: "Bố" }, { preset: "Con trai", name: "Minh" }],
  });
  await page.goto(base + "/thoi-gian-man-hinh/");
  await expect(
    page.getByRole("link", { name: "Tải app Android (.apk)", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('nav a[href$="/thoi-gian-man-hinh/"]:visible'),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kết nối điện thoại với gia đình" }),
  ).toBeVisible();

  const seeded = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("family-calendar");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const read = (store: string) =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const space = (await read("spaces"))[0];
    const member = (await read("members")).find((m) => m.profile === "CHILD")!;
    const identity = (await read("localIdentity"))[0];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["spaces", "settings"], "readwrite");
      tx.objectStore("spaces").put({ ...space, sharingState: "SHARED" });
      tx.objectStore("settings").put({
        key: "online.identity",
        value: {
          actorId: identity.actorId,
          deviceId: identity.deviceId,
          accountId: null,
        },
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { memberId: String(member.id) };
  });

  let revoked = false;
  let goal: {
    limit_minutes: number;
    reminders_enabled: boolean;
    version: number;
  } | null = null;
  let deviceState = "ACTIVE";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.pathname.endsWith("/session"))
      return json({ csrfToken: "test-csrf" });
    if (url.pathname.endsWith("/notifications"))
      return json({ notifications: [], unread_count: 0 });
    if (url.pathname.endsWith("/screen-time/members"))
      return json({
        members: [
          {
            id: seeded.memberId,
            display_name: "Minh",
            profile: "CHILD",
            can_manage: true,
          },
        ],
      });
    if (url.pathname.endsWith("/summary")) {
      if (revoked)
        return json(
          { error: { code: "FORBIDDEN", message: "Bạn không có quyền." } },
          403,
        );
      const days = [];
      for (
        let date = url.searchParams.get("from")!;
        date <= url.searchParams.get("to")!;
      ) {
        const hasData = date === "2026-11-03";
        days.push({
          date,
          total_seconds: hasData ? 8100 : null,
          coverage: hasData ? "PARTIAL" : "UNKNOWN",
          updated_at: hasData ? "2026-11-03T02:38:00Z" : null,
          device_count: hasData ? 1 : 0,
          apps: hasData
            ? [
                {
                  package_name: "com.google.android.youtube",
                  label: "YouTube",
                  seconds: 1800,
                },
                {
                  package_name: "com.google.android.apps.classroom",
                  label: "Google Classroom",
                  seconds: 6300,
                },
              ]
            : [],
        });
        date = new Date(Date.parse(date + "T00:00:00Z") + 86400_000)
          .toISOString()
          .slice(0, 10);
      }
      return json({
        member_id: seeded.memberId,
        time_zone: "Asia/Ho_Chi_Minh",
        can_manage: true,
        source: "ANDROID_USAGE_EVENTS",
        goal,
        devices: [
          {
            id: "phone",
            label: "Điện thoại của Minh",
            state: deviceState,
            last_seen_at: "2026-11-03T02:38:00Z",
            consent_at: "2026-11-03T00:00:00Z",
          },
        ],
        days,
      });
    }
    if (url.pathname.endsWith("/goal") && request.method() === "PUT") {
      const body = request.postDataJSON();
      goal = { ...body, version: body.version + 1 };
      return json({ version: goal!.version });
    }
    if (url.pathname.endsWith("/pairings")) {
      expect(request.postDataJSON().consent).toBe(true);
      return json(
        { code: "ABCDEF123456", expires_at: "2026-11-03T03:10:00Z" },
        201,
      );
    }
    if (request.method() === "DELETE" && url.pathname.includes("/devices/")) {
      deviceState = "DISCONNECTED";
      return route.fulfill({ status: 204 });
    }
    return json({ error: { code: "NOT_FOUND" } }, 404);
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chi tiết ứng dụng · 2026-11-03" }),
  ).toBeVisible();
  await expect(
    page.getByText("Có ngày chỉ thu thập được một phần.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("YouTube", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Hôm nay", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Phân bổ ứng dụng", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xem thời gian màn hình của Minh" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Số phút mỗi ngày").fill("180");
  await page.getByRole("button", { name: "Tăng mục tiêu 30 phút" }).click();
  await expect(page.getByLabel("Số phút mỗi ngày")).toHaveValue("210");
  await page.getByRole("button", { name: "Giảm mục tiêu 30 phút" }).click();
  await expect(page.getByLabel("Số phút mỗi ngày")).toHaveValue("180");
  await page.getByRole("button", { name: "Lưu mục tiêu", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu mục tiêu." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo mã liên kết", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Tôi được phép liên kết", exact: false })
    .check();
  await page
    .getByRole("button", { name: "Tạo mã liên kết", exact: true })
    .click();
  await expect(page.getByText("ABCDEF123456", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Địa chỉ máy chủ nhập trên điện thoại"),
  ).toHaveValue(`${new URL(page.url()).origin}${base}/api/v1`);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`screen-time-${width}.png`),
      fullPage: true,
    });
  }
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.screenshot({
    path: info.outputPath("screen-time-dark-320.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "7 ngày", exact: true }).click();
  await page
    .getByRole("button", { name: "2026-11-02: Chưa có dữ liệu", exact: true })
    .click();
  await expect(
    page.getByText("Chưa nhận được dữ liệu ngày này.", { exact: true }),
  ).toBeVisible();
  revoked = true;
  // The page must refresh automatically and clear reports if access is revoked.
  await expect(
    page.getByText("Bạn không còn quyền xem dữ liệu này.", { exact: true }),
  ).toBeVisible({ timeout: 22_000 });
  await expect(page.getByText("YouTube", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
