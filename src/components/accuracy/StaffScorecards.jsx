import { useMemo } from "react";
import { TrendingDown, TrendingUp, Minus, Users } from "lucide-react";
import { byPerson } from "../../lib/accuracy";
import { Avatar } from "../ui/dataviz";
import { EmptyState } from "../ui/primitives";

const TREND_ICON = { improving: TrendingDown, slipping: TrendingUp, steady: Minus };
const TREND_TONE = { improving: "var(--status-done)", slipping: "var(--danger)", steady: "var(--ink-muted)" };

// Per-job error plotted against a zero baseline. Unlike the dashboard Sparkline (which
// floors at zero and fills an area), this one is symmetric around the middle so a dot
// above the line always means "over-ran" regardless of the person's scale.
function ErrorSparkline({ rows, width = 210, height = 44 }) {
  const scale = Math.max(20, ...rows.map((row) => Math.abs(row.pct)));
  const mid = height / 2;
  const points = rows.map((row, i) => {
    const x = rows.length === 1 ? width / 2 : (i / (rows.length - 1)) * width;
    const y = mid - (row.pct / scale) * (mid - 4);
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={mid} x2={width} y2={mid} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      {points.length > 1 && (
        <path d={line} fill="none" stroke="var(--ink-muted)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}
      {points.map(([x, y], i) => (
        <circle
          key={rows[i].id}
          cx={x}
          cy={y}
          r="2.75"
          fill={rows[i].delta > 0 ? "var(--danger)" : "var(--status-done)"}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function StaffScorecards({ rows, onSelectPerson }) {
  const cards = useMemo(() => byPerson(rows), [rows]);

  if (!cards.length) {
    return (
      <EmptyState
        icon={Users}
        title="No scorecards yet"
        text="A staff member appears here once one of their completed jobs has both an estimate and actual hours."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const TrendIcon = TREND_ICON[card.trend.key];
        const biased = Math.abs(card.stats.bias) > 10;
        return (
          <button
            key={card.person}
            type="button"
            onClick={() => onSelectPerson?.(card.person)}
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5 text-left transition-colors hover:border-[var(--color-brand-500)]"
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={card.person} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9rem] font-bold text-[var(--ink)]">{card.person}</div>
                <div className="text-[0.68rem] text-[var(--ink-muted)] tnum">
                  {card.stats.count} job{card.stats.count === 1 ? "" : "s"} scored
                </div>
              </div>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white"
                style={{ background: card.grade.tone }}
                title={`${card.grade.label} — average miss of ±${card.stats.spread}%`}
              >
                {card.grade.grade}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="code text-lg font-extrabold leading-none tnum" style={{ color: biased ? "var(--danger)" : "var(--status-done)" }}>
                {card.stats.bias > 0 ? "+" : ""}{card.stats.bias}%
              </span>
              <span className="text-[0.68rem] font-semibold text-[var(--ink-muted)]">
                {card.stats.bias > 0 ? "under-estimates" : card.stats.bias < 0 ? "over-estimates" : "balanced"} · ±{card.stats.spread}% typical
              </span>
            </div>

            <div className="mt-2 rounded-[var(--radius-field)] bg-[var(--surface-card)] px-2 py-1">
              <ErrorSparkline rows={card.rows} />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[0.68rem] text-[var(--ink-muted)]">
              <span className="tnum">{card.stats.within10} of {card.stats.count} within ±10%</span>
              <span className="flex items-center gap-1 font-semibold" style={{ color: TREND_TONE[card.trend.key] }}>
                <TrendIcon size={13} strokeWidth={2.5} />
                {card.trend.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
