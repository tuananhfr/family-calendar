export function ProgressRing({ value, size = 72, stroke = 8, label, colorVar = "--color-success" }: { value: number; size?: number; stroke?: number; label: string; colorVar?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span role="img" aria-label={`${label}: ${Math.round(clamped)}%`} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-text">{Math.round(clamped)}%</span>
    </span>
  );
}
