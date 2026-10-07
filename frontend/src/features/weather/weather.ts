import provinces from "./provinces.json";

export interface Province {
  key: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Forecast {
  todayMax: number;
  todayMin: number;
  /** WMO weather code from Open-Meteo. */
  code: number;
}

/** The 63 provinces/cities with the coordinates of their capital (modules.md §17). */
export const PROVINCES: readonly Province[] = provinces;

export function provinceByKey(key: string | null | undefined): Province | undefined {
  return key ? PROVINCES.find((p) => p.key === key) : undefined;
}

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const FORECAST_CACHE_MS = 3 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

const cache = new Map<string, { at: number; value: Forecast }>();

/** Tests only. */
export function clearForecastCache(): void {
  cache.clear();
}

/**
 * Today's forecast for a point, or null on ANY failure (network, status, shape) — the chip just hides.
 * Only city coordinates are ever sent, never the device location (TEC-19).
 */
export async function fetchForecast(
  p: { lat: number; lon: number },
  fetchFn: typeof fetch = globalThis.fetch,
  now: () => number = Date.now,
): Promise<Forecast | null> {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || typeof fetchFn !== "function") return null;
  const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < FORECAST_CACHE_MS) return hit.value;

  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", p.lat.toFixed(3));
  url.searchParams.set("longitude", p.lon.toFixed(3));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("timezone", "Asia/Ho_Chi_Minh");
  url.searchParams.set("forecast_days", "1");

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url.toString(), { signal: abort.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok) return null;
    const body = (await res.json()) as { daily?: { temperature_2m_max?: unknown[]; temperature_2m_min?: unknown[]; weather_code?: unknown[] } };
    const [max, min, code] = [body.daily?.temperature_2m_max?.[0], body.daily?.temperature_2m_min?.[0], body.daily?.weather_code?.[0]];
    if (typeof max !== "number" || typeof min !== "number" || typeof code !== "number") return null;
    const value = { todayMax: Math.round(max), todayMin: Math.round(min), code };
    cache.set(key, { at: now(), value });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Entry point for the UI: no chosen city → no request at all. */
export async function forecastForCity(cityKey: string | null | undefined, fetchFn?: typeof fetch, now?: () => number): Promise<Forecast | null> {
  const province = provinceByKey(cityKey);
  return province ? fetchForecast(province, fetchFn, now) : null;
}

/** Short Vietnamese label for a WMO code. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Trời quang";
  if (code <= 2) return "Ít mây";
  if (code === 3) return "Nhiều mây";
  if (code === 45 || code === 48) return "Sương mù";
  if (code >= 51 && code <= 57) return "Mưa phùn";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Mưa";
  if (code >= 95) return "Dông";
  return "Thời tiết thay đổi";
}
