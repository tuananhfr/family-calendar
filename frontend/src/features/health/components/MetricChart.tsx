"use client";

import { useEffect, useRef, useState } from "react";
import type { HealthMetric } from "@/core/model/health";
import { zonedToInstant } from "@/core/time/zoned";
import { t } from "@/i18n/vi";
import { formatMetricValue } from "../model/metrics";
import { vnDate } from "../model/health-view";

const H = 240;
const FALLBACK_WIDTH = 600;
const PAD = { left: 44, right: 16, top: 16, bottom: 28 };
const GRID = 4;

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/**
 * Line chart of one member's readings over time (x is real time, so a gap in measuring shows as a gap).
 * Plain SVG: no reference bands or "normal range" shading, which would read as a judgement (modules.md §8).
 */
export function MetricChart({ series, label }: { series: HealthMetric[]; label: string }) {
  // The viewBox follows the real width so axis text stays 12px instead of scaling with the card.
  const box = useRef<HTMLElement>(null);
  const [W, setW] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const times = series.map((m) => zonedToInstant(m.measuredAt, "UTC").getTime());
  const values = series.flatMap((m) => (m.value2 === undefined ? [m.value] : [m.value, m.value2]));
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  lo -= pad;
  hi += pad;
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (time: number) => (t1 === t0 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((time - t0) / (t1 - t0)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const line = (pick: (m: HealthMetric) => number | undefined) =>
    series
      .map((m, i) => [times[i], pick(m)] as const)
      .filter((p): p is readonly [number, number] => p[1] !== undefined)
      .map(([time, v], i) => `${i === 0 ? "M" : "L"}${x(time).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  const last = series.at(-1);
  const hasSecond = series.some((m) => m.value2 !== undefined);

  return (
    <figure ref={box} className="flex min-w-0 flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}. ${last ? `${series.length} lần đo, gần nhất ${formatMetricValue(last)} ngày ${vnDate(last.measuredAt.slice(0, 10))}.` : ""}`}
        width={W}
        height={H}
        className="block max-w-full overflow-visible"
        data-testid="metric-chart"
      >
        {Array.from({ length: GRID + 1 }, (_, i) => {
          const v = lo + ((hi - lo) * i) / GRID;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={i === 0 ? undefined : "3 4"} />
              <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="var(--color-muted)">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {series.length > 0 ? (
          <>
            <text x={PAD.left} y={H - 6} fontSize="12" fill="var(--color-muted)">
              {vnDate(series[0].measuredAt.slice(0, 10))}
            </text>
            {series.length > 1 ? (
              <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="12" fill="var(--color-muted)">
                {vnDate(last!.measuredAt.slice(0, 10))}
              </text>
            ) : null}
          </>
        ) : null}
        <path d={line((m) => m.value)} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {hasSecond ? <path d={line((m) => m.value2)} fill="none" stroke="var(--cat-health-dot)" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" /> : null}
        {series.map((m, i) => (
          <g key={m.id} data-testid="metric-point">
            <circle cx={x(times[i])} cy={y(m.value)} r="4.5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2.5">
              <title>{`${vnDate(m.measuredAt.slice(0, 10))}: ${formatMetricValue(m)}`}</title>
            </circle>
            {m.value2 !== undefined ? <circle cx={x(times[i])} cy={y(m.value2)} r="4" fill="var(--color-surface)" stroke="var(--cat-health-dot)" strokeWidth="2.5" /> : null}
          </g>
        ))}
      </svg>
      {series.length === 1 ? <figcaption className="text-xs text-muted">{t("health.metrics.chartOne")}</figcaption> : null}
    </figure>
  );
}
