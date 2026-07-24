import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ChartScatter, IdCard } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { accuracyRows } from "../lib/accuracy";
import { Card, PanelHeader, Button, Chip } from "../components/ui/primitives";
import { EstimateScatterPlot } from "../components/accuracy/EstimateScatterPlot";
import { StaffScorecards } from "../components/accuracy/StaffScorecards";

const VIEWS = [
  { key: "scatter", label: "Scatter Plot", icon: ChartScatter },
  { key: "scorecards", label: "Staff Scorecards", icon: IdCard },
];

const COPY = {
  scatter: ["Estimate vs actual hours", "Every completed job with hours logged. Tap a dot to open the job."],
  scorecards: ["Staff estimation scorecards", "Graded on the average size of the miss, not the direction. Tap a card to filter the board to that person."],
};

// Admin-only (see the /accuracy route guard): per-person grades are a management view.
export function AccuracyView() {
  const { filteredJobs: jobs, filters, updateFilter } = useWorkshop();
  const { openJob } = useJobDrawer();
  const [params, setParams] = useSearchParams();
  const active = VIEWS.some((v) => v.key === params.get("view")) ? params.get("view") : "scatter";

  const rows = useMemo(() => accuracyRows(jobs), [jobs]);
  const [title, subtitle] = COPY[active];

  return (
    <Card>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex shrink-0 gap-1.5">
            {VIEWS.map((view) => (
              <Button
                key={view.key}
                size="sm"
                variant={active === view.key ? "secondary" : "ghost"}
                aria-pressed={active === view.key}
                // The label collapses to an icon on narrow screens — keep the name for AT.
                aria-label={view.label}
                onClick={() => setParams(view.key === "scatter" ? {} : { view: view.key }, { replace: true })}
                className="gap-1.5"
              >
                <view.icon size={14} />
                <span className="hidden sm:inline">{view.label}</span>
              </Button>
            ))}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip>{rows.length} job{rows.length === 1 ? "" : "s"} scored</Chip>
        {jobs.length !== rows.length && (
          <span className="text-[0.72rem] text-[var(--ink-muted)]">
            {jobs.length - rows.length} job{jobs.length - rows.length === 1 ? "" : "s"} excluded — not complete, or no actual hours logged.
          </span>
        )}
      </div>

      {active === "scatter" ? (
        <EstimateScatterPlot rows={rows} onSelect={openJob} />
      ) : (
        <StaffScorecards
          rows={rows}
          onSelectPerson={(person) => updateFilter("employee", filters.employee === person ? "All" : person)}
        />
      )}
    </Card>
  );
}
