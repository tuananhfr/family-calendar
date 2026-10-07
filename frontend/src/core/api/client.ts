import { appConfig } from "../config";
import { ApiRequestError, codeForStatus, isErrorCode } from "./errors";

export { ApiRequestError, ErrorCode, isTransientError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiOptions {
  signal?: AbortSignal;
  /** Sent as-is (uploads); `body` is ignored when set. */
  raw?: BodyInit;
  headers?: Record<string, string>;
}

let csrfToken: string | null = null;
let csrfPending: Promise<string | null> | null = null;

/** Forget the cached CSRF token (logout, device re-registration). */
export function clearApiSession(): void {
  csrfToken = null;
  csrfPending = null;
}

function urlFor(path: string): string {
  return path.startsWith("/api/") ? `${appConfig.basePath}${path}` : `${appConfig.apiBase}${path}`;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function send(method: HttpMethod, path: string, body: unknown, opts: ApiOptions, token: string | null): Promise<Response> {
  const headers = new Headers(opts.headers);
  let payload: BodyInit | undefined = opts.raw;
  if (payload === undefined && body !== undefined) {
    payload = JSON.stringify(body);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && token) headers.set("X-CSRF-Token", token);
  try {
    return await fetch(urlFor(path), { method, headers, body: payload, credentials: "include", cache: "no-store", signal: opts.signal });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiRequestError("NETWORK", 0, "NETWORK");
  }
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toError(res: Response, body: unknown): ApiRequestError {
  const envelope = (body as { error?: { code?: unknown; message?: unknown; fields?: unknown } } | undefined)?.error;
  const code = isErrorCode(envelope?.code) ? envelope.code : codeForStatus(res.status);
  const message = typeof envelope?.message === "string" ? envelope.message : code;
  const fields = envelope?.fields && typeof envelope.fields === "object" ? (envelope.fields as Record<string, string>) : undefined;
  return new ApiRequestError(code, res.status, message, fields);
}

function rememberToken(body: unknown): void {
  const token = (body as { csrfToken?: unknown } | undefined)?.csrfToken;
  if (typeof token === "string" && token) csrfToken = token;
}

// No session yet (device registration) is not an error here: the write goes out without a token and the server decides.
async function loadCsrfToken(signal?: AbortSignal): Promise<string | null> {
  if (csrfToken) return csrfToken;
  csrfPending ??= (async () => {
    try {
      const res = await send("GET", "/session", undefined, { signal }, null);
      const body = await readBody(res);
      if (res.ok) rememberToken(body);
      return csrfToken;
    } finally {
      csrfPending = null;
    }
  })();
  return csrfPending;
}

/**
 * The one HTTP entry point: cookies included, X-CSRF-Token on writes (refetched once on CSRF_INVALID),
 * `{error:{code}}` → ApiRequestError, no HTTP response → code `NETWORK`. `path` is relative to /api/v1.
 */
export async function api<T>(method: HttpMethod, path: string, body?: unknown, opts: ApiOptions = {}): Promise<T> {
  const write = method !== "GET";
  let token = write ? await loadCsrfToken(opts.signal) : null;
  for (let attempt = 0; ; attempt++) {
    const res = await send(method, path, body, opts, token);
    const parsed = await readBody(res);
    if (res.ok) {
      rememberToken(parsed);
      return parsed as T;
    }
    const error = toError(res, parsed);
    if (write && error.code === "CSRF_INVALID" && attempt === 0) {
      clearApiSession();
      token = await loadCsrfToken(opts.signal);
      continue;
    }
    throw error;
  }
}
