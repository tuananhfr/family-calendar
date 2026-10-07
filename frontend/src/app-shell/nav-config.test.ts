import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accessContextFor } from "@/core/access/evaluate";
import { FAMILY_SHEET_ITEMS, FOOTER_LINKS, MOBILE_TABS, QUICK_TOOLS, SIDEBAR_ITEMS, TOPNAV_ITEMS, isActive, visibleNav, type NavItem } from "./nav-config";

const appDir = path.resolve(__dirname, "../app");

// Route groups like "(app)" do not appear in URLs, so collect every page path with groups stripped.
function collectRoutes(dir: string, segments: string[] = []): Set<string> {
  const routes = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const isGroup = /^\(.+\)$/.test(entry.name);
      for (const r of collectRoutes(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name])) routes.add(r);
    } else if (entry.name === "page.tsx") {
      routes.add("/" + segments.join("/"));
    }
  }
  return routes;
}

const routes = collectRoutes(appDir);
const pathnameOf = (href: string) => new URL(href, "http://x").pathname.replace(/\/$/, "") || "/";
const lists: Record<string, NavItem[]> = { SIDEBAR_ITEMS, TOPNAV_ITEMS, QUICK_TOOLS, MOBILE_TABS, FAMILY_SHEET_ITEMS, FOOTER_LINKS };

describe("nav-config", () => {
  it("mobile bottom nav is exactly today, week, add, upcoming, family", () => {
    expect(MOBILE_TABS.map((k) => k.key)).toEqual(["today", "week", "add", "upcoming", "family"]);
  });

  it.each(Object.entries(lists))("%s hrefs all resolve to a page file", (_name, items) => {
    for (const item of items) expect(routes, `${item.key} -> ${item.href}`).toContain(pathnameOf(item.href));
  });

  it.each(Object.entries(lists))("%s has unique keys and non-empty labels", (_name, items) => {
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of items) expect(i.label.trim()).not.toBe("");
  });

  it("every screen route in the spec exists", () => {
    const required = [
      "/", "/lich", "/sap-den-han", "/viec", "/nhac", "/thoi-khoa-bieu", "/ngay-dac-biet", "/thanh-vien", "/thanh-vien/them",
      "/nhom", "/quyen", "/bao-cao", "/tai-chinh", "/suc-khoe", "/kho-luu-tru", "/tro-ly", "/cai-dat", "/mau-ke-hoach",
      "/bat-dau", "/tham-gia", "/sos", "/thong-bao", "/tim-kiem",
      "/gioi-thieu", "/dieu-khoan", "/quyen-rieng-tu", "/lien-he", "/tro-giup",
    ];
    for (const r of required) expect(routes, r).toContain(r);
  });

  it("family sheet reaches every screen hidden from the mobile bottom nav", () => {
    const sheet = FAMILY_SHEET_ITEMS.map((i) => pathnameOf(i.href));
    for (const r of ["/viec", "/nhac", "/thoi-khoa-bieu", "/suc-khoe", "/tai-chinh", "/ngay-dac-biet", "/thanh-vien", "/nhom", "/kho-luu-tru", "/bao-cao", "/tro-ly", "/cai-dat"]) {
      expect(sheet, r).toContain(r);
    }
  });

  it("isActive matches nested routes but keeps the root exact", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/lich/")).toBe(false);
    expect(isActive("/thanh-vien/", "/thanh-vien/them/")).toBe(true);
    expect(isActive("/lich/?view=week", "/lich")).toBe(true);
    expect(isActive("/nhac/", "/nhac-khac/")).toBe(false);
  });

  it("a child profile loses finance, health and their quick tools; gated items wait for access", () => {
    const ctx = (role: "OWNER" | "MEMBER") => accessContextFor(role, { actorId: "a", spaceKind: "FAMILY", representedMemberIds: [], representedProfiles: [role === "OWNER" ? "PARENT" : "CHILD"] });
    const childKeys = visibleNav(SIDEBAR_ITEMS, ctx("MEMBER")).map((i) => i.key);
    expect(childKeys).not.toContain("finance");
    expect(childKeys).not.toContain("health");
    expect(childKeys).toContain("today");
    expect(visibleNav(QUICK_TOOLS, ctx("MEMBER")).map((i) => i.key)).not.toContain("medication");
    expect(visibleNav(SIDEBAR_ITEMS, ctx("OWNER"))).toHaveLength(SIDEBAR_ITEMS.length);
    expect(visibleNav(SIDEBAR_ITEMS, undefined).some((i) => i.capability)).toBe(false);
  });
});
