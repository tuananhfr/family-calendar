// Serves the static export in out/ like production does: route fallback, cache headers and an /api proxy.
// Used by `npm run preview`, the e2e package (port 3006 → backend 3007) and production behind nginx (`npm start`).
// The base path defaults to NEXT_PUBLIC_BASE_PATH so the server and the export it serves read one value.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../out", import.meta.url)));
const PORT = Number(process.env.PORT ?? 3006);
const HOST = process.env.HOST ?? "127.0.0.1";
const API_TARGET = new URL(process.env.API_TARGET ?? "http://127.0.0.1:3007");
const BASE_PATH = (process.env.BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

// Hashed build assets never change; everything else must revalidate so a deploy is picked up.
function cacheControl(urlPath, ext) {
  if (urlPath.startsWith("/_next/static/")) return "public, max-age=31536000, immutable";
  if (ext === ".html" || urlPath === "/sw.js" || ext === ".webmanifest") return "no-cache";
  return "public, max-age=3600, must-revalidate";
}

async function fileAt(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? { path, size: s.size } : null;
  } catch {
    return null;
  }
}

/** Maps a URL path to a file inside out/, never outside it. */
async function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const base = normalize(join(ROOT, decoded));
  if (base !== ROOT && !base.startsWith(ROOT + sep)) return null;
  const candidates = decoded.endsWith("/")
    ? [join(base, "index.html")]
    : [base, join(base, "index.html"), `${base}.html`];
  for (const c of candidates) {
    const hit = await fileAt(c);
    if (hit) return hit;
  }
  return null;
}

function send(res, req, file, status, urlPath) {
  const ext = extname(file.path).toLowerCase();
  res.writeHead(status, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Content-Length": file.size,
    "Cache-Control": cacheControl(urlPath, ext),
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file.path).pipe(res);
}

function proxy(req, res, path) {
  const headers = { ...req.headers, host: API_TARGET.host };
  // Behind nginx keep its forwarded values (real client IP, https); listening on loopback means only nginx can set them.
  headers["x-forwarded-host"] = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] ?? "http";
  headers["x-forwarded-for"] = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "";
  const upstream = httpRequest(
    {
      protocol: API_TARGET.protocol,
      hostname: API_TARGET.hostname,
      port: API_TARGET.port,
      method: req.method,
      path,
      headers,
    },
    (up) => {
      // Set-Cookie passes through untouched so the session cookie lands on this origin.
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: { code: "BAD_GATEWAY", message: "Không kết nối được máy chủ." } }));
  });
  req.pipe(upstream);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (BASE_PATH && url.pathname === BASE_PATH) {
    res.writeHead(308, { Location: `${BASE_PATH}/${url.search}` });
    return res.end();
  }
  if (BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  const pathname = url.pathname.slice(BASE_PATH.length);
  // The backend mounts /api at its root, so the base path is stripped before forwarding.
  if (pathname === "/api" || pathname.startsWith("/api/")) return proxy(req, res, `${pathname}${url.search}`);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  const file = await resolveStatic(pathname);
  if (file) return send(res, req, file, 200, pathname);
  const notFound = await fileAt(join(ROOT, "404.html"));
  if (notFound) return send(res, req, notFound, 404, "/404.html");
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${ROOT} on http://${HOST}:${PORT}${BASE_PATH}/ (api → ${API_TARGET.origin})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
