import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { nameHue, initials } from "../../lib/jobs";
import { cx } from "./primitives";

// Animated integer/number counter. Falls back to the final value under reduced motion.
export function CountUp({ value, decimals = 0, suffix = "", className }) {
  const [display, setDisplay] = useState(value);
  const reduce = useReducedMotion();
  const prev = useRef(value);
  useEffect(() => {
    if (reduce) { setDisplay(value); prev.current = value; return; }
    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={cx("tnum", className)}>{Number(display).toFixed(decimals)}{suffix}</span>;
}

// Deterministic-colour initials avatar.
export function Avatar({ name, size = 36, className }) {
  const hue = nameHue(name);
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-xl font-bold text-white", className)}
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 52%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

// SVG progress ring with an animated sweep on mount.
export function ProgressRing({ value, size = 118, stroke = 11, label }) {
  const reduce = useReducedMotion();
  const [pct, setPct] = useState(reduce ? value : 0);
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  useEffect(() => {
    if (reduce) { setPct(value); return; }
    const controls = animate(pct, value, { duration: 0.9, ease: "easeOut", onUpdate: setPct });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        <circle
          className="glow-svg" style={{ color: "var(--color-brand-500)" }}
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--color-brand-500)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        />
      </svg>
      <div className="absolute grid place-items-center text-center">
        <strong className="code text-2xl font-extrabold text-[var(--ink)]">{Math.round(pct)}%</strong>
        {label && <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">{label}</span>}
      </div>
    </div>
  );
}

// Horizontal meter bar.
export function Meter({ value, max = 100, className, tone = "var(--color-brand-500)" }) {
  const width = Math.min(100, Math.max(2, (value / (max || 1)) * 100));
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]", className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${tone}, var(--color-brand-300))` }} />
    </div>
  );
}

// Paired estimate/actual bars on a shared scale — one row per job. Over-estimate rows
// are tinted with the danger token so the gap reads at a glance without a legend lookup.
export function EstimateActualBars({ rows, max }) {
  const scale = Math.max(1, max || Math.max(1, ...rows.flatMap((r) => [r.est, r.actual])));
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const over = row.actual > row.est;
        const actualTone = over ? "var(--danger)" : "var(--status-done)";
        return (
          <button
            key={row.id}
            type="button"
            onClick={row.onSelect}
            className="block w-full rounded-xl px-2 py-1 text-left transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[0.72rem]">
              <span className="truncate font-semibold text-[var(--ink-soft)]">{row.label}</span>
              <span className="shrink-0 pl-2 font-bold tnum" style={{ color: actualTone }}>
                {row.actual}h / {row.est}h{row.delta !== 0 && ` · ${row.delta > 0 ? "+" : ""}${row.delta}h`}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Est</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (row.est / scale) * 100)}%`, background: "var(--ink-muted)" }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Act</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, (row.actual / scale) * 100)}%`, background: actualTone }} />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Compact inline-SVG sparkline (area + line). No chart library.
export function Sparkline({ data, width = 132, height = 38, stroke = "var(--color-brand-500)" }) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((d, i) => [i * step, height - ((d - min) / range) * (height - 4) - 2]);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={stroke} />
    </svg>
  );
}
