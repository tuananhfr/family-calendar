import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearForecastCache, fetchForecast, forecastForCity, FORECAST_CACHE_MS, PROVINCES, provinceByKey, weatherLabel } from "./weather";

const okBody = { daily: { temperature_2m_max: [32.4], temperature_2m_min: [25.6], weather_code: [61] } };
const ok = () => vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 })) as unknown as typeof fetch;

beforeEach(() => clearForecastCache());

describe("provinces", () => {
  it("has the 63 provinces with unique keys and coordinates inside Vietnam", () => {
    expect(PROVINCES).toHaveLength(63);
    expect(new Set(PROVINCES.map((p) => p.key)).size).toBe(63);
    for (const p of PROVINCES) {
      expect(p.lat).toBeGreaterThan(8);
      expect(p.lat).toBeLessThan(24);
      expect(p.lon).toBeGreaterThan(102);
      expect(p.lon).toBeLessThan(110);
    }
    expect(provinceByKey("ha-noi")?.name).toBe("Hà Nội");
  });
});

describe("fetchForecast", () => {
  it("reads today's max/min/code from Open-Meteo with the city coordinates only", async () => {
    const f = ok();
    expect(await fetchForecast({ lat: 21.028, lon: 105.854 }, f)).toEqual({ todayMax: 32, todayMin: 26, code: 61 });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
    expect(url).toContain("latitude=21.028");
    expect(url).toContain("longitude=105.854");
    expect(url).toContain("timezone=Asia%2FHo_Chi_Minh");
    expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
  });

  it("returns null on any error", async () => {
    const reject = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await fetchForecast({ lat: 1, lon: 1 }, reject)).toBeNull();
    expect(await fetchForecast({ lat: 2, lon: 2 }, vi.fn(async () => new Response("x", { status: 500 })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchForecast({ lat: 3, lon: 3 }, vi.fn(async () => new Response("not json")) as unknown as typeof fetch)).toBeNull();
    expect(await fetchForecast({ lat: 4, lon: 4 }, vi.fn(async () => new Response(JSON.stringify({ daily: {} }))) as unknown as typeof fetch)).toBeNull();
    expect(await fetchForecast({ lat: Number.NaN, lon: 4 }, ok())).toBeNull();
  });

  it("caches for 3 hours", async () => {
    const f = ok();
    let t = 0;
    const now = () => t;
    await fetchForecast({ lat: 10, lon: 106 }, f, now);
    t = FORECAST_CACHE_MS - 1;
    await fetchForecast({ lat: 10, lon: 106 }, f, now);
    expect(f).toHaveBeenCalledTimes(1);
    t = FORECAST_CACHE_MS;
    await fetchForecast({ lat: 10, lon: 106 }, f, now);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("forecastForCity", () => {
  it("never fetches without an explicitly chosen city", async () => {
    const f = ok();
    expect(await forecastForCity(undefined, f)).toBeNull();
    expect(await forecastForCity(null, f)).toBeNull();
    expect(await forecastForCity("", f)).toBeNull();
    expect(await forecastForCity("atlantis", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(await forecastForCity("da-nang", f)).toMatchObject({ todayMax: 32 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("weatherLabel", () => {
  it("labels common WMO codes", () => {
    expect(weatherLabel(0)).toBe("Trời quang");
    expect(weatherLabel(61)).toBe("Mưa");
    expect(weatherLabel(95)).toBe("Dông");
  });
});
