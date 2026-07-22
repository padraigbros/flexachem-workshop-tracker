import { useWorkshop } from "../state/WorkshopProvider";
import { useStatusPrompt } from "../state/StatusPromptProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { makeGroups, dueBucket } from "../lib/jobs";
import { parseISODate } from "../lib/dates";
import { DUE_BUCKETS } from "../lib/constants";
import { Chip, EmptyState, cx } from "../components/ui/primitives";
import { TimelineJob } from "../components/jobs/JobBits";

export function DueDatesView() {
  const { filteredJobs: jobs } = useWorkshop();
  const { requestStatusChange } = useStatusPrompt();
  const { openJob } = useJobDrawer();
  const groups = makeGroups(jobs, dueBucket);

  return (
    <div className="space-y-4">
      {DUE_BUCKETS.map((bucket) => {
        const items = (groups[bucket] || []).sort((a, b) => (parseISODate(a.due)?.getTime() || 0) - (parseISODate(b.due)?.getTime() || 0));
        const overdue = bucket === "Overdue";
        return (
          <section key={bucket} className={cx("card p-4", overdue && items.length && "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-bg)]")}>
            <div className="sticky top-[8.5rem] z-10 mb-3 flex items-center justify-between gap-2">
              <h3 className={cx("text-lg font-bold tracking-tight", overdue && items.length ? "text-[var(--danger)]" : "text-[var(--ink)]")}>{bucket}</h3>
              <Chip>{items.length} job{items.length === 1 ? "" : "s"}</Chip>
            </div>
            <div className="grid gap-2.5">
              {items.length ? items.map((job) => <TimelineJob key={job.id} job={job} onSelect={openJob} onStatus={requestStatusChange} />) : <EmptyState text="No jobs in this due-date bucket." />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
