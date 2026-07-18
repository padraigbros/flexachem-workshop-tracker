import { useMemo } from "react";
import { AlertTriangle, Clock, CheckCircle2, Layers, Plus, Flame } from "lucide-react";
import { useWorkshop, riskScore } from "../state/WorkshopProvider";
import { useAuthCtx } from "../state/AuthProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { useShell } from "../components/layout/AppShell";
import { STATUS_ORDER } from "../lib/constants";
import { parseNotes } from "../lib/jobs";
import { parseISODate } from "../lib/dates";
import { Card, PanelHeader, Button, EmptyState } from "../components/ui/primitives";
import { CountUp, Sparkline, ProgressRing, Meter } from "../components/ui/dataviz";
import { statusTone } from "../components/ui/StatusChip";
import { RiskItem, UpdatesList } from "../components/jobs/JobBits";

// Build a 14-day daily count series from update timestamps matching a predicate.
function dailySeries(updates, predicate, days = 14) {
  const buckets = new Array(days).fill(0);
  const now = new Date(); now.setHours(12, 0, 0, 0);
  updates.forEach((u) => {
    if (!predicate(u)) return;
    const at = parseISODate(u.at);
    if (!at) return;
    const diff = Math.round((now - at.setHours(12, 0, 0, 0)) / 86400000);
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
  });
  return buckets;
}

const STAT_ICON = { red: AlertTriangle, brand: Clock, green: CheckCircle2, ink: Layers };
const STAT_COLOR = {
  red: "var(--danger)", brand: "var(--color-brand-500)", green: "var(--status-done)", ink: "var(--ink-soft)",
};

function StatCard({ tone, label, value, decimals, suffix, detail, series }) {
  const Icon = STAT_ICON[tone];
  return (
    <Card className="relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.11em] text-[var(--ink-muted)]">{label}</span>
        <Icon size={16} className="glow-svg" style={{ color: STAT_COLOR[tone] }} />
      </div>
      <div className="code mt-2 text-[2.5rem] font-extrabold leading-none text-[var(--ink)]">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-[0.72rem] text-[var(--ink-muted)]">{detail}</span>
        {series && <span className="glow-svg" style={{ color: STAT_COLOR[tone] }}><Sparkline data={series} width={80} height={26} stroke="currentColor" /></span>}
      </div>
    </Card>
  );
}

export function DashboardView() {
  const { filteredJobs: jobs, activeJobs, metrics, updates, people, auditPatch } = useWorkshop();
  const { isAdmin } = useAuthCtx();
  const { openJob, openUpdates } = useJobDrawer();
  const shell = useShell();

  const risky = useMemo(() => jobs.filter((j) => j.status !== "Complete").sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 5), [jobs]);
  const completedSeries = useMemo(() => dailySeries(updates, (u) => u.status === "Complete"), [updates]);
  const notesSeries = useMemo(() => dailySeries(updates, (u) => u.kind !== "audit"), [updates]);

  const maxStaffHours = Math.max(1, ...people.map((p) => jobs.filter((j) => j.alloc === p && j.status !== "Complete").reduce((s, j) => s + Number(j.hrs || 0), 0)));

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard tone="red" label="Overdue" value={metrics.overdue} detail="Needs attention" />
          <StatCard tone="brand" label="Hours booked" value={metrics.hours} suffix="h" detail="Filtered allocation" series={notesSeries} />
          <StatCard tone="green" label="Complete" value={metrics.complete} detail={`${metrics.progress}% done`} series={completedSeries} />
          <StatCard tone="ink" label="Total jobs" value={jobs.length} detail={`${activeJobs.length} in database`} />
        </div>

        <Card>
          <PanelHeader
            title="High-risk queue"
            subtitle="Sorted by due date, blocker status and priority."
            action={isAdmin && <Button size="sm" variant="ghost" onClick={shell.newJob} className="gap-1"><Plus size={14} />Add job</Button>}
          />
          <div className="grid gap-2.5">
            {risky.length
              ? risky.map((job) => <RiskItem key={job.id} job={job} onSelect={openJob} onStatus={auditPatch} />)
              : <EmptyState icon={Flame} text="No risk items in the current filter." />}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <PanelHeader title="Job status" subtitle="Filtered completion ratio." />
          <div className="flex items-center gap-5">
            <ProgressRing value={metrics.progress} label="done" />
            <div className="flex-1 space-y-2.5">
              {STATUS_ORDER.map((status) => {
                const count = jobs.filter((j) => j.status === status).length;
                const width = jobs.length ? Math.max(4, (count / jobs.length) * 100) : 0;
                const tone = { queued: "var(--status-queued)", active: "var(--status-active)", blocked: "var(--status-blocked)", done: "var(--status-done)" }[statusTone(status)];
                return (
                  <div key={status}>
                    <div className="mb-1 flex justify-between text-[0.72rem]">
                      <span className="font-semibold text-[var(--ink-soft)]">{status}</span>
                      <span className="text-[var(--ink-muted)] tnum">{count}</span>
                    </div>
                    <Meter value={width} tone={tone} />
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <PanelHeader title="Staff availability" subtitle="Open hours by staff member." />
          <div className="space-y-2.5">
            {people.map((person) => {
              const hours = jobs.filter((j) => j.alloc === person && j.status !== "Complete").reduce((s, j) => s + Number(j.hrs || 0), 0);
              return (
                <div key={person}>
                  <div className="mb-1 flex justify-between text-[0.72rem]">
                    <span className="font-semibold text-[var(--ink-soft)]">{person}</span>
                    <span className="text-[var(--ink-muted)] tnum">{hours}h</span>
                  </div>
                  <Meter value={(hours / maxStaffHours) * 100} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <PanelHeader
            title="Recent workshop updates"
            subtitle="Latest notes across the floor."
            action={<Button size="sm" variant="ghost" onClick={openUpdates}>View all</Button>}
          />
          <UpdatesList updates={updates.slice(0, 5)} onSelect={openJob} />
        </Card>
      </div>
    </div>
  );
}
