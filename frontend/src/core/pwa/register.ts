import { appConfig, withBase } from "../config";

let pending: Promise<ServiceWorkerRegistration | null> | undefined;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!appConfig.production || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  pending ??= navigator.serviceWorker.register(withBase("/sw.js"), { scope: withBase("/"), updateViaCache: "none" }).catch((error) => { pending = undefined; throw error; });
  return pending;
}
