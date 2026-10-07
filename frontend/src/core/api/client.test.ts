import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearApiSession } from "./client";
import { ApiRequestError, isTransientError } from "./errors";

type Call = { url: string; init: RequestInit };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const envelope = (code: string, status: number, fields?: Record<string, string>) => json({ error: { code, message: code, ...(fields ? { fields } : {}) } }, status);
const session = (csrfToken: string) => json({ actorId: "a", deviceId: "d", accountId: null, csrfToken });

let calls: Call[];
function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name);

beforeEach(() => clearApiSession());
afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("GET carries cookies and no CSRF header", async () => {
    stubFetch(() => json({ status: "ok" }));
    expect(await api("GET", "/health")).toEqual({ status: "ok" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/v1/health");
    expect(calls[0].init).toMatchObject({ method: "GET", credentials: "include" });
    expect(header(calls[0], "X-CSRF-Token")).toBeNull();
  });

  it("POST fetches the CSRF token once from GET /session and reuses it", async () => {
    stubFetch((url) => (url.endsWith("/session") ? session("tok-1") : json({ ok: true })));
    await api("POST", "/spaces/s1/sync/operations", { operations: [] });
    await api("PATCH", "/x", { a: 1 });
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "GET /api/v1/session",
      "POST /api/v1/spaces/s1/sync/operations",
      "PATCH /api/v1/x",
    ]);
    expect(header(calls[1], "X-CSRF-Token")).toBe("tok-1");
    expect(header(calls[1], "Content-Type")).toBe("application/json");
    expect(calls[1].init.body).toBe(JSON.stringify({ operations: [] }));
    expect(header(calls[2], "X-CSRF-Token")).toBe("tok-1");
  });

  it("CSRF_INVALID → refetches the token and retries exactly once", async () => {
    let sessions = 0;
    stubFetch((url) => {
      if (url.endsWith("/session")) return session(`tok-${++sessions}`);
      return envelope("CSRF_INVALID", 403);
    });
    const err = await api("POST", "/x", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ code: "CSRF_INVALID", status: 403 });
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual(["GET /api/v1/session", "POST /api/v1/x", "GET /api/v1/session", "POST /api/v1/x"]);
    expect(header(calls[3], "X-CSRF-Token")).toBe("tok-2");
  });

  it("CSRF_INVALID then success returns the second response", async () => {
    let posts = 0;
    stubFetch((url) => (url.endsWith("/session") ? session("t") : ++posts === 1 ? envelope("CSRF_INVALID", 403) : json({ done: 1 })));
    expect(await api("DELETE", "/x")).toEqual({ done: 1 });
  });

  it("422 → VALIDATION_FAILED with fields", async () => {
    stubFetch((url) => (url.endsWith("/session") ? session("t") : envelope("VALIDATION_FAILED", 422, { title: "REQUIRED" })));
    await expect(api("POST", "/x", {})).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 422, fields: { title: "REQUIRED" } });
  });

  it("network TypeError → code NETWORK", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const err = await api("GET", "/health").catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "NETWORK", status: 0 });
    expect(isTransientError(err)).toBe(true);
  });

  it("a write without a session still goes out (device registration), without a CSRF header", async () => {
    stubFetch((url) => (url.endsWith("/session") ? envelope("AUTH_REQUIRED", 401) : json({ actorId: "a", deviceId: "d" }, 201)));
    expect(await api("POST", "/devices", { name: "x" })).toEqual({ actorId: "a", deviceId: "d" });
    expect(header(calls[1], "X-CSRF-Token")).toBeNull();
  });

  it("errors without an envelope map by status; 204 resolves undefined", async () => {
    stubFetch((url) => (url.endsWith("/a") ? new Response("<html>bad gateway</html>", { status: 502 }) : new Response(null, { status: 204 })));
    await expect(api("GET", "/a")).rejects.toMatchObject({ code: "TEMPORARILY_UNAVAILABLE", status: 502 });
    expect(await api("GET", "/b")).toBeUndefined();
  });

  it("raw bodies and extra headers pass through untouched; abort is not a network error", async () => {
    stubFetch((url) => (url.endsWith("/session") ? session("t") : json({})));
    const raw = new Uint8Array([1, 2, 3]);
    await api("POST", "/blobs/1", undefined, { raw, headers: { "Content-Type": "application/octet-stream" } });
    expect(calls[1].init.body).toBe(raw);
    expect(header(calls[1], "Content-Type")).toBe("application/octet-stream");

    const ctrl = new AbortController();
    ctrl.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );
    await expect(api("GET", "/x", undefined, { signal: ctrl.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("accepts absolute /api/v1 paths from the generated schema", async () => {
    stubFetch(() => json({}));
    await api("GET", "/api/v1/spaces");
    expect(calls[0].url).toBe("/api/v1/spaces");
  });
});
