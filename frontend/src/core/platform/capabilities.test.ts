import { describe, expect, it } from "vitest";
import { detectCapabilities } from "./capabilities";

describe("detectCapabilities", () => {
  it("reports nothing in a bare environment (Node)", async () => {
    expect(await detectCapabilities({})).toEqual({
      notification: "unsupported",
      push: false,
      standalone: false,
      mediaRecorder: false,
      geolocation: false,
      storagePersist: false,
      iosNeedsHomeScreen: false,
    });
  });

  it("reads real permission and features from the environment", async () => {
    const caps = await detectCapabilities({
      Notification: { permission: "denied" },
      PushManager: {},
      MediaRecorder: {},
      navigator: {
        serviceWorker: {},
        geolocation: {},
        storage: { persist: async () => true },
        mediaDevices: { getUserMedia: async () => ({}) },
        userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      },
      matchMedia: () => ({ matches: true }),
    });
    expect(caps).toEqual({
      notification: "denied",
      push: true,
      standalone: true,
      mediaRecorder: true,
      geolocation: true,
      storagePersist: true,
      iosNeedsHomeScreen: false,
    });
  });

  it("iPhone Safari outside the Home Screen needs installing for push", async () => {
    const caps = await detectCapabilities({
      navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
      matchMedia: () => ({ matches: false }),
    });
    expect(caps.iosNeedsHomeScreen).toBe(true);
    expect(caps.push).toBe(false);
  });
});
