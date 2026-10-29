import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("./worker.js", import.meta.url), "utf8");

function setup(basePath = "") {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const cache = { addAll: vi.fn(async () => {}), match: vi.fn(async () => new Response("shell")), put: vi.fn() };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => [`fc-shell:${basePath || "root"}:old`, "fc-shell:other:keep"]), delete: vi.fn() };
  const registration = { showNotification: vi.fn() };
  const self = { __FC_PWA__: { basePath, version: "test", assets: [basePath + "/hom-nay/", basePath + "/_next/static/app.js"], messages: { title: "Lịch Gia Đình", body: "Bạn có thông báo mới. Mở ứng dụng để xem.", sosBody: "Có cảnh báo SOS gia đình. Mở ứng dụng để xem trạng thái hiện tại." } }, location: { origin: "https://app.example" }, registration, clients: { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow: vi.fn() }, skipWaiting: vi.fn(), addEventListener: (name: string, callback: (event: Record<string, unknown>) => void) => handlers.set(name, callback) };
  const fetch = vi.fn(async () => new Response("network"));
  runInContext(source, createContext({ self, caches, fetch, URL, Set }));
  return { handlers, cache, caches, self, fetch };
}

describe("PWA worker privacy boundary", () => {
  it.each([null, [], "private string"])("handles malformed push payloads without exposing them: %s", async (payload) => {
    const runtime = setup();
    let done: Promise<void> | undefined;
    runtime.handlers.get("push")!({ data: { json: () => payload }, waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
    expect(runtime.self.registration.showNotification).toHaveBeenCalledWith("Lịch Gia Đình", expect.objectContaining({ body: "Bạn có thông báo mới. Mở ứng dụng để xem." }));
  });
  it.each(["", "/lich-gia-dinh"])("serves only exported static assets for scope %s", async (basePath) => {
    const runtime = setup(basePath);
    const respondWith = vi.fn();
    for (const path of ["/api/v1/spaces/id/sync/snapshot", "/api/v1/spaces/id/files/id/blob", "/unknown", "/_next/static/app.js?search=private"]) {
      runtime.handlers.get("fetch")!({ request: { method: "GET", mode: "cors", url: "https://app.example" + basePath + path }, respondWith });
    }
    runtime.handlers.get("fetch")!({ request: { method: "GET", mode: "cors", url: "https://other.example" + basePath + "/hom-nay/" }, respondWith });
    runtime.handlers.get("fetch")!({ request: { method: "POST", mode: "cors", url: "https://app.example" + basePath + "/hom-nay/" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    runtime.handlers.get("fetch")!({ request: { method: "GET", mode: "navigate", url: "https://app.example" + basePath + "/hom-nay/?item=private-id" }, respondWith });
    expect(await (respondWith.mock.calls[0][0] as Promise<Response>).then((response) => response.text())).toBe("shell");
    expect(runtime.cache.match).toHaveBeenCalledWith("https://app.example" + basePath + "/hom-nay/");
    expect(runtime.fetch).not.toHaveBeenCalled();
  });

  it("never renders private payload content or external notification targets", async () => {
    const runtime = setup("/lich-gia-dinh");
    let done: Promise<void> | undefined;
    runtime.handlers.get("push")!({ data: { json: () => ({ title: "Secret medication", body: "GPS coordinates", url: "https://attacker.example/" }) }, waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
    expect(runtime.self.registration.showNotification).toHaveBeenCalledWith("Lịch Gia Đình", expect.objectContaining({ body: "Bạn có thông báo mới. Mở ứng dụng để xem.", data: { url: "https://app.example/lich-gia-dinh/thong-bao/" } }));
  });

  it("cleans only outdated caches owned by its deployment scope", async () => {
    const runtime = setup("/lich-gia-dinh");
    let done: Promise<void> | undefined;
    runtime.handlers.get("activate")!({ waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
    expect(runtime.caches.delete).toHaveBeenCalledTimes(1);
    expect(runtime.caches.delete).toHaveBeenCalledWith("fc-shell:/lich-gia-dinh:old");
    expect(runtime.self.clients.claim).toHaveBeenCalled();
    expect(runtime.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("opens a real SOS reference at the correct base path without showing location or identity", async () => {
    const runtime = setup("/lich-gia-dinh");
    let done: Promise<void> | undefined;
    runtime.handlers.get("push")!({ data: { json: () => ({ data: { type: "SOS", eventId: "event-123", spaceId: "family-123", latitude: 10, displayName: "Private name" } }) }, waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
    expect(runtime.self.registration.showNotification).toHaveBeenCalledWith("Lịch Gia Đình", expect.objectContaining({ body: "Có cảnh báo SOS gia đình. Mở ứng dụng để xem trạng thái hiện tại.", data: { url: "https://app.example/lich-gia-dinh/sos/?event=event-123&space=family-123" } }));
  });
});
