import { useMemo } from "react";
import { Scale } from "lucide-react";
import { niceMax, summarize } from "../../lib/accuracy";
import { EmptyState } from "../ui/primitives";

// Estimate vs actual hours, one dot per completed job. The dashed diagonal is a perfect
// estimate: dots above it over-ran, dots below came in early. Dot radius grows with the
// size of the miss so the outliers pull the eye without needing a legend lookup.
export function EstimateScatterPlot({ rows, onSelect }) {
  const max = useMemo(() => niceMax(rows.flatMap((row) => [row.est, row.actual])), [rows]);
  const stats = useMemo(() => summarize(rows), [rows]);

  if (!rows.length) {
    return (
      <EmptyState
        icon={Scale}
        title="Nothing to plot yet"
        text="Completed jobs appear here once both an estimate and actual hours are logged."
      />
    );
  }

  const width = 820;
  const height = 420;
  const padL = 52;
  const padR = 18;
  const padT = 16;
  const padB = 48;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const scaleX = (value) => padL + (value / max) * plotW;
  const scaleY = (value) => padT + plotH - (value / max) * plotH;

  const step = max <= 10 ? 2 : max <= 24 ? 4 : 8;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-[var(--ink-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--danger)" }} />
          Over-ran the estimate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--status-done)" }} />
          Came in under
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5" style={{ background: "var(--ink-muted)" }} />
          Perfect estimate
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block w-full max-w-[640px] rounded-[var(--radius-card)] bg-[var(--surface-sunken)]"
        role="img"
        aria-label={`Estimate versus actual hours for ${rows.length} completed jobs`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={scaleX(tick)} y1={padT} x2={scaleX(tick)} y2={padT + plotH} stroke="var(--line)" strokeWidth="1" />
            <line x1={padL} y1={scaleY(tick)} x2={padL + plotW} y2={scaleY(tick)} stroke="var(--line)" strokeWidth="1" />
            <text x={scaleX(tick)} y={padT + plotH + 18} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">{tick}h</text>
            <text x={padL - 9} y={scaleY(tick) + 4} textAnchor="end" fontSize="11" fill="var(--ink-muted)">{tick}h</text>
          </g>
        ))}

        <line
          x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(max)} y2={scaleY(max)}
          stroke="var(--ink-muted)" strokeWidth="2" strokeDasharray="6 5" opacity="0.7"
        />

        <text x={padL + plotW / 2} y={height - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--ink-soft)">
          Estimated hours →
        </text>
        <text
          x={13} y={padT + plotH / 2} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--ink-soft)"
          transform={`rotate(-90 13 ${padT + plotH / 2})`}
        >
          ← Actual hours
        </text>

        {rows.map((row) => {
          const over = row.delta > 0;
          const tone = over ? "var(--danger)" : "var(--status-done)";
          const radius = Math.min(5 + Math.abs(row.pct) * 0.12, 13);
          const label = `${row.job.asm || row.job.cust || "Job"} · ${row.person} — est ${row.est}h, actual ${row.actual}h (${row.pct > 0 ? "+" : ""}${row.pct}%)`;
          return (
            <circle
              key={row.id}
              cx={scaleX(Math.min(row.est, max))}
              cy={scaleY(Math.min(row.actual, max))}
              r={radius}
              fill={tone}
              fillOpacity="0.68"
              stroke="var(--surface-card)"
              strokeWidth="1.5"
              className="cursor-pointer"
              onClick={() => onSelect?.(row.job.id)}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Estimate bias"
          value={`${stats.bias > 0 ? "+" : ""}${stats.bias}%`}
          detail={stats.bias > 0 ? "jobs over-run" : stats.bias < 0 ? "jobs come in early" : "balanced"}
          tone={Math.abs(stats.bias) <= 10 ? "var(--status-done)" : "var(--danger)"}
        />
        <Stat label="Typical miss" value={`±${stats.spread}%`} detail="average error, either way" />
        <Stat label="Within ±10%" value={`${stats.within10Pct}%`} detail={`${stats.within10} of ${stats.count} jobs`} />
        <Stat label="Hours logged" value={`${stats.totalActual}h`} detail={`against ${stats.totalEst}h estimated`} />
      </div>
    </div>
  );
}

function Stat({ label, value, detail, tone }) {
  return (
    <div className="rounded-[var(--radius-field)] bg-[var(--surface-sunken)] px-3 py-2.5">
      <div className="text-[0.6rem] font-extrabold uppercase tracking-[0.11em] text-[var(--ink-muted)]">{label}</div>
      <div className="code mt-1 text-xl font-extrabold leading-none tnum" style={{ color: tone || "var(--ink)" }}>{value}</div>
      <div className="mt-1 text-[0.68rem] text-[var(--ink-muted)]">{detail}</div>
    </div>
  );
}
