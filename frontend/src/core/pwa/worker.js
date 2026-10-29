const config = self.__FC_PWA__;
const namespace = `fc-shell:${config.basePath || "root"}:`;
const cacheName = namespace + config.version;
const assets = new Set(config.assets.map((path) => new URL(path, self.location.origin).href));

function staticKey(request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  const bare = new URL(url.pathname, url.origin).href;
  if (!assets.has(bare)) return null;
  if (request.mode !== "navigate" && [...url.searchParams.keys()].some((key) => key !== "_rsc")) return null;
  return bare;
}

function notificationUrl(raw) {
  const fallback = new URL(config.basePath + "/thong-bao/", self.location.origin);
  if (typeof raw !== "string") return fallback.href;
  try {
    const url = new URL(raw, self.location.origin);
    const allowed = ["/thong-bao/", "/hom-nay/", "/nhac/", "/sos/"].map((path) => config.basePath + path);
    if (url.origin !== fallback.origin || !allowed.includes(url.pathname)) return fallback.href;
    url.username = ""; url.password = ""; url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (!["event", "space", "item"].includes(key) || !/^[A-Za-z0-9_-]{1,80}$/.test(url.searchParams.get(key))) url.searchParams.delete(key);
    return url.href;
  } catch { return fallback.href; }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll([...assets])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(namespace) && name !== cacheName) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  const key = staticKey(event.request);
  if (!key) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const stored = await cache.match(key);
    if (stored) return stored;
    const response = await fetch(key, { credentials: "omit", cache: "no-cache" });
    if (response.ok && response.type !== "opaque" && !response.redirected) await cache.put(key, response.clone());
    return response;
  })());
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      const parsed = event.data?.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
    } catch { /* Untrusted push payloads must still produce generic feedback. */ }
    const ref = payload.data;
    const rawUrl = ref?.type === "SOS" && typeof ref.eventId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(ref.eventId) && typeof ref.spaceId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(ref.spaceId)
      ? config.basePath + "/sos/?event=" + ref.eventId + "&space=" + ref.spaceId
      : payload.url ?? ref?.url;
    const url = notificationUrl(rawUrl);
    const isSos = new URL(url).pathname === config.basePath + "/sos/";
    await self.registration.showNotification(config.messages.title, {
      body: isSos ? config.messages.sosBody : config.messages.body,
      icon: config.basePath + "/icons/icon-192.png",
      badge: config.basePath + "/icons/icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "family-calendar",
      data: { url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = notificationUrl(event.notification.data?.url);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find((candidate) => new URL(candidate.url).origin === self.location.origin && new URL(candidate.url).pathname.startsWith(config.basePath + "/"));
    if (client) { await client.navigate(url); await client.focus(); }
    else await self.clients.openWindow(url);
  })());
});
