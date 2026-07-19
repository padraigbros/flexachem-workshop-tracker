import { useWorkshop } from "../state/WorkshopProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { makeGroups } from "../lib/jobs";
import { EmptyState } from "../components/ui/primitives";
import { MiniJob } from "../components/jobs/JobBits";

export function BusinessUnitsView() {
  const { filteredJobs: jobs, businessUnits, auditPatch } = useWorkshop();
  const { openJob } = useJobDrawer();
  const groups = makeGroups(jobs, (j) => j.bus);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {businessUnits.map((unit) => {
        const items = groups[unit] || [];
        const open = items.filter((j) => j.status !== "Complete");
        const hours = open.reduce((s, j) => s + Number(j.hrs || 0), 0);
        return (
          <section key={unit} className="card overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 bg-[linear-gradient(135deg,var(--color-navy-900),var(--color-navy-500))] p-5 text-white">
              <div>
                <h3 className="text-2xl font-extrabold tracking-tight">{unit}</h3>
                <div className="mt-0.5 text-[0.8rem] text-[#d8e8fb] tnum">{open.length} open · {hours}h booked</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2 text-center">
                <strong className="block text-2xl font-extrabold tnum">{items.length}</strong>
                <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[#bdd0e6]">Total</span>
              </div>
            </div>
            <div className="grid gap-2 p-3.5">
              {items.length ? items.map((job) => <MiniJob key={job.id} job={job} onSelect={openJob} onStatus={auditPatch} />) : <EmptyState text="No filtered jobs for this business unit." />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
