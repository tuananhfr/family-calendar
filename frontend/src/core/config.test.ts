import { describe, expect, it } from "vitest";
import { appConfig } from "./config";
import { t } from "@/i18n/vi";

describe("appConfig", () => {
  it("uses the versioned API base", () => {
    expect(appConfig.apiBase).toBe("/api/v1");
    expect(appConfig.defaultTimeZone).toBe("Asia/Ho_Chi_Minh");
  });
});

describe("t", () => {
  it("returns Vietnamese strings", () => {
    expect(t("tagline")).toBe("Hôm nay nhà mình có gì?");
  });

  it("interpolates variables", () => {
    expect(t("common.daysLeft", { n: 14 })).toBe("Còn 14 ngày");
  });

  it("throws on missing keys so empty labels never ship silently", () => {
    expect(() => t("missing.key")).toThrow();
  });
});
