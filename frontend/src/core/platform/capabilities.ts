export type NotificationCapability = "unsupported" | "default" | "granted" | "denied";

export interface Capabilities {
  notification: NotificationCapability;
  push: boolean;
  /** Running as an installed PWA (display-mode: standalone). */
  standalone: boolean;
  mediaRecorder: boolean;
  geolocation: boolean;
  storagePersist: boolean;
  /** iOS Safari only allows Web Push once the app is added to the Home Screen. */
  iosNeedsHomeScreen: boolean;
}

/** The parts of `window` this module reads; tests pass plain objects. */
export interface CapabilityEnv {
  Notification?: { permission?: string };
  PushManager?: unknown;
  MediaRecorder?: unknown;
  navigator?: {
    serviceWorker?: unknown;
    geolocation?: unknown;
    storage?: { persist?: unknown };
    mediaDevices?: { getUserMedia?: unknown };
    userAgent?: string;
    standalone?: boolean;
  };
  matchMedia?: (query: string) => { matches: boolean };
}

const IOS_UA = /iPhone|iPad|iPod/;

function notificationState(env: CapabilityEnv): NotificationCapability {
  const p = env.Notification?.permission;
  return p === "default" || p === "granted" || p === "denied" ? p : "unsupported";
}

/** Feature detection only — never prompts for a permission. */
export async function detectCapabilities(env: CapabilityEnv = globalThis as unknown as CapabilityEnv): Promise<Capabilities> {
  const nav = env.navigator;
  let standalone = false;
  try {
    standalone = env.matchMedia?.("(display-mode: standalone)").matches === true || nav?.standalone === true;
  } catch {
    standalone = false;
  }
  const ios = IOS_UA.test(nav?.userAgent ?? "");
  const pushApi = env.PushManager !== undefined && nav?.serviceWorker !== undefined;
  return {
    notification: notificationState(env),
    push: pushApi && (!ios || standalone),
    standalone,
    mediaRecorder: env.MediaRecorder !== undefined && typeof nav?.mediaDevices?.getUserMedia === "function",
    geolocation: nav?.geolocation !== undefined,
    storagePersist: typeof nav?.storage?.persist === "function",
    iosNeedsHomeScreen: ios && !standalone,
  };
}
