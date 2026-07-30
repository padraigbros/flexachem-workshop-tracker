import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText, X, Check, AlertTriangle } from "lucide-react";
import { JOB_TYPES, PRIORITIES, STATUS_ORDER, HOURS_STEP } from "../../lib/constants";
import { roundHours } from "../../lib/jobs";
import { offsetDate, daysBetween } from "../../lib/dates";
import { indexEntries, holidayIndex, unavailableReason, holidaysInRange, weekAvailableHours, weekdaysOfWeek } from "../../lib/calendar";
import { customerKey } from "../../lib/customers";
import { importAssemblyOrderPdf } from "../../lib/pdfImport";
import { Modal, ModalHeader } from "../ui/overlay";
import { Button, Field, Input, Select, Textarea, cx } from "../ui/primitives";

function Section({ title, children, cols = 2 }) {
  return (
    <div>
      <h4 className="mb-2.5 text-[0.66rem] font-extrabold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{title}</h4>
      <div className={cx("grid gap-3", cols === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>{children}</div>
    </div>
  );
}

export function JobModal({ job, open, people, staff = [], calendar = [], holidays = [], jobs = [], jobTypes, customers, businessUnits, onClose, onSave, onAddCustomer }) {
  const assignablePeople = useMemo(() => {
    const set = new Set(people);
    // Keep the job's current assignee selectable even if they are no longer active, so the
    // job re-saves unchanged. But `alloc` is one text column carrying two meanings — a
    // person's name, or the literal "Unassigned" standing for nobody — and adding the latter
    // as if it were a technician is what put TWO "Unassigned" entries in this dropdown
    // (the hardcoded option below, plus this one) on all 12 unassigned jobs.
    if (job.alloc && job.alloc.trim().toLowerCase() !== "unassigned") set.add(job.alloc);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [people, job.alloc]);

  const [fields, setFields] = useState(() => ({
    asm: job.asm || "", so: job.so || "", cust: job.cust || "",
    type: job.type || jobTypes?.[0] || JOB_TYPES[0],
    owner: job.owner || "", alloc: job.alloc || assignablePeople[0] || "Unassigned",
    bus: job.bus || businessUnits[0] || "Other",
    start: job.start || offsetDate(0), due: job.due || offsetDate(7),
    hrs: job.hrs ?? 1, actualHrs: job.actualHrs ?? 0,
    status: job.status || "Not Started", priority: job.priority || "Normal",
    details: job.details || "",
  }));
  const [touched, setTouched] = useState({});
  const touchedRef = useRef(new Set());
  const fileInputRef = useRef(null);
  const [attachment, setAttachment] = useState(job.attachment || null);
  const [pdfFile, setPdfFile] = useState(null);
  const [importFound, setImportFound] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Placeholder first, the active catalogue, plus the currently-selected value so any
  // customer (legacy, PDF-imported, or freshly created) always has a matching <option>.
  const customerOptions = useMemo(() => {
    const catalogue = (customers?.length ? customers : []).slice().sort((a, b) => a.localeCompare(b));
    return ["", ...Array.from(new Set([...catalogue, fields.cust].filter(Boolean)))];
  }, [customers, fields.cust]);

  const set = (key, value) => {
    touchedRef.current.add(key);
    setFields((prev) => ({ ...prev, [key]: value }));
  };
  const blur = (key) => setTouched((prev) => ({ ...prev, [key]: true }));

  // Availability-aware assignment. Map staff names → ids, then flag anyone unavailable across
  // the job's start..due range (weekdays only) so the dropdown can grey them out with a reason.
  const staffByName = useMemo(() => new Map(staff.map((m) => [m.name, m])), [staff]);
  const entriesByKey = useMemo(() => indexEntries(calendar), [calendar]);
  const holidays_ = useMemo(() => holidayIndex(holidays), [holidays]);
  const availability = useMemo(() => {
    const map = new Map();
    assignablePeople.forEach((name) => {
      const member = staffByName.get(name);
      map.set(name, member ? unavailableReason(member.id, fields.start, fields.due, entriesByKey, holidays_.set) : null);
    });
    return map;
  }, [assignablePeople, staffByName, entriesByKey, holidays_, fields.start, fields.due]);

  // Public holidays in the job's range. Stated once, against the range they belong to —
  // they close the shop for everyone, so they are context for the dates, not a mark against
  // any individual (see unavailableReason in lib/calendar.js).
  const rangeHolidays = useMemo(
    () => holidaysInRange(fields.start, fields.due, holidays_),
    [fields.start, fields.due, holidays_],
  );

  // Non-blocking capacity check for the currently-selected assignee: their remaining hours for
  // the job's start-week, minus hours already booked to them that week, vs this job's hours.
  const capacityWarning = useMemo(() => {
    const member = staffByName.get(fields.alloc);
    if (!member || !fields.start) return null;
    const remaining = weekAvailableHours(member.id, fields.start, entriesByKey, holidays_.set);
    const weekSet = new Set(weekdaysOfWeek(fields.start));
    const alreadyBooked = jobs
      .filter((j) => j.id !== job.id && j.alloc === fields.alloc && j.status !== "Complete" && weekSet.has(String(j.start).slice(0, 10)))
      .reduce((sum, j) => sum + (Number(j.hrs) || 0), 0);
    const free = remaining - alreadyBooked;
    const need = Number(fields.hrs) || 0;
    if (need > free) {
      return `${fields.alloc} has ${Math.max(0, free)}h free that week (${remaining}h available − ${alreadyBooked}h booked); this job needs ${need}h.`;
    }
    return null;
  }, [staffByName, fields.alloc, fields.start, fields.hrs, entriesByKey, holidays_, jobs, job.id]);

  // Map a customer name parsed from a PDF onto the catalogue: return the canonical
  // catalogue name if one matches (case/punctuation-insensitive), otherwise create a new
  // customer and return its name so the dropdown selects it.
  const resolveCustomer = (raw) => {
    const name = String(raw || "").trim();
    if (!name) return "";
    const match = (customers || []).find((c) => customerKey(c) === customerKey(name));
    if (match) return match;
    onAddCustomer?.({ name, active: true });
    toast.info(`Added new customer "${name}" to the catalogue`);
    return name;
  };

  const errors = {
    asm: !fields.asm.trim() ? "Required" : null,
    cust: !fields.cust.trim() ? "Required" : null,
    // jobs.due_date is NOT NULL in the database, and toDbPayload sends `job.due || null` —
    // so clearing this field produced a raw 23502 from Postgres instead of a field error.
    // Catch it here, where we can point at the actual input.
    due: !fields.due ? "Required" : null,
    // Same gate the status-change prompt applies. Without it the Status dropdown here is a
    // back door to completing a job with no hours, and it drops out of the dashboard's
    // estimate-vs-actual figures with no indication anything is missing.
    actualHrs: fields.status === "Complete" && roundHours(fields.actualHrs) <= 0
      ? "Required to mark a job complete" : null,
  };
  const showError = (key) => (touched[key] || submitted) && errors[key];

  const handlePdfFile = async (file) => {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      toast.error("Please choose a PDF file.");
      return;
    }
    setImportBusy(true);
    try {
      const { fields: parsed, found } = await importAssemblyOrderPdf(file, { staffNames: people, jobTypes });
      const allowDefaults = !job.id;
      // Resolve the parsed customer to a catalogue entry (or create one) up front, so the
      // dropdown gets a real selectable value instead of an unmatched free-text string.
      const resolvedCust = (parsed.cust && !touchedRef.current.has("cust") && !fields.cust)
        ? resolveCustomer(parsed.cust)
        : null;
      setFields((prev) => {
        const next = { ...prev };
        Object.entries(parsed).forEach(([key, value]) => {
          if (key === "cust" || !value || touchedRef.current.has(key)) return;
          const isEmpty = next[key] === "" || next[key] == null;
          const hasDefault = ["type", "start", "due"].includes(key);
          if (isEmpty || (allowDefaults && hasDefault)) next[key] = value;
        });
        if (resolvedCust && (next.cust === "" || next.cust == null)) next.cust = resolvedCust;
        return next;
      });
      setPdfFile(file);
      setImportFound(found);
      toast.success(found.length ? `Auto-filled ${found.length} field${found.length === 1 ? "" : "s"} from ${file.name}` : `${file.name} attached — no fields recognised`);
    } catch (err) {
      toast.error("Could not read PDF", { description: err?.message || String(err) });
    } finally {
      setImportBusy(false);
    }
  };

  // The modal owns the outcome of the save. It stays open and keeps the typed values when the
  // write is rejected — closing on a failed save is what let two jobs disappear on 29 Jul 2026.
  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.asm || errors.cust || errors.due || errors.actualHrs) return;
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    // Snapped to the half hour on save so a typed 1.25 can't slip past the stepper.
    const result = await onSave({ ...fields, hrs: roundHours(fields.hrs), actualHrs: roundHours(fields.actualHrs), attachment, attachmentFile: pdfFile });
    setSaving(false);
    // A caller that returns nothing is treated as success so demo mode and any not-yet-migrated
    // call site keep working.
    if (result && result.ok === false) setSaveError(result);
  };

  const plannedSpan = Math.max(1, daysBetween(fields.start, fields.due) + 1);

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit} className="flex max-h-[100dvh] flex-col sm:max-h-[calc(100dvh-2.5rem)]" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e); }}>
        <ModalHeader
          eyebrow={job.id ? "Edit workshop job" : "New workshop job"}
          title={job.id ? `${job.asm} · ${job.cust}` : "Create a production record"}
          subtitle="Track booked hours separately from the calendar start and due dates."
          onClose={onClose}
        />

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Save failure. role="alert" so it is announced, not just drawn. */}
          {saveError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-bg)] px-3.5 py-3"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--danger)]" />
              <div className="min-w-0">
                <div className="text-[0.82rem] font-bold text-[var(--danger)]">
                  {job.id ? "Couldn't save your changes" : "Couldn't create this job"}
                </div>
                <div className="mt-0.5 text-[0.75rem] leading-snug text-[var(--danger)]">{saveError.message}</div>
                <div className="mt-1 text-[0.7rem] leading-snug text-[var(--ink-muted)]">
                  Nothing has been lost — your details are still here. This job is not on the board yet.
                </div>
              </div>
            </div>
          )}

          {/* Import */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handlePdfFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
            className={cx(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed p-5 text-center transition-colors",
              dragActive ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/8" : "border-[var(--line-strong)] bg-[var(--surface-sunken)]",
            )}
          >
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { handlePdfFile(e.target.files?.[0]); e.target.value = ""; }} />
            {importBusy ? (
              <span className="text-[0.82rem] text-[var(--ink-muted)]">Reading PDF…</span>
            ) : pdfFile ? (
              <span className="flex items-center gap-2 text-[0.82rem] text-[var(--ink)]"><FileText size={16} /><strong>{pdfFile.name}</strong> attached on save
                <button type="button" className="text-[var(--danger)]" onClick={(e) => { e.stopPropagation(); setPdfFile(null); setImportFound(null); }}><X size={15} /></button>
              </span>
            ) : attachment ? (
              <span className="flex items-center gap-2 text-[0.82rem] text-[var(--ink)]"><FileText size={16} /><strong>{attachment.name}</strong> attached
                <button type="button" className="text-[var(--danger)]" onClick={(e) => { e.stopPropagation(); setAttachment(null); }}><X size={15} /></button>
              </span>
            ) : (
              <>
                <UploadCloud size={24} className="text-[var(--ink-muted)]" />
                <span className="text-[0.82rem] text-[var(--ink-soft)]"><strong className="text-[var(--ink)]">Drop an Assembly Order PDF</strong> — details auto-fill and the PDF is saved on the job.</span>
              </>
            )}
          </div>
          {importFound?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {importFound.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-[var(--status-done-bg)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--status-done)]"><Check size={11} />{f}</span>
              ))}
            </div>
          )}

          <Section title="Identity">
            <Field label="Assembly / Tag" required error={showError("asm")}>
              <Input value={fields.asm} onChange={(e) => set("asm", e.target.value)} onBlur={() => blur("asm")} className={cx(showError("asm") && "border-[var(--danger)]")} />
            </Field>
            <Field label="Sales Order"><Input value={fields.so} onChange={(e) => set("so", e.target.value)} /></Field>
            <Field
              label="Customer"
              required
              error={showError("cust")}
              hint={fields.cust && !(customers || []).includes(fields.cust) ? "Not in the catalogue — add it in Customers to reuse it." : undefined}
            >
              <Select value={fields.cust} onChange={(e) => set("cust", e.target.value)} onBlur={() => blur("cust")} className={cx(showError("cust") && "border-[var(--danger)]")}>
                {customerOptions.map((c) => <option key={c} value={c}>{c || "Select customer…"}</option>)}
              </Select>
            </Field>
            <Field label="Project Owner"><Input value={fields.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
          </Section>

          <Section title="Classification">
            <Field label="Job Type">
              <Select value={fields.type} onChange={(e) => set("type", e.target.value)}>
                {Array.from(new Set([...(jobTypes?.length ? jobTypes : JOB_TYPES), fields.type].filter(Boolean))).map((v) => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Staff / Technician">
              <Select value={fields.alloc} onChange={(e) => set("alloc", e.target.value)}>
                <option>Unassigned</option>
                {assignablePeople.map((p) => {
                  const reason = availability.get(p);
                  // Keep the current assignee selectable even if now unavailable, so the job re-saves.
                  const disabled = Boolean(reason) && p !== job.alloc;
                  return <option key={p} value={p} disabled={disabled}>{reason ? `${p} — ${reason}` : p}</option>;
                })}
              </Select>
              {rangeHolidays.length > 0 && (
                <span className="mt-1 block text-[0.7rem] font-semibold text-[var(--cal-holiday)]">
                  Shop closed in this range: {rangeHolidays.join(", ")}
                </span>
              )}
              {capacityWarning && (
                <span className="mt-1 flex items-start gap-1 text-[0.7rem] font-semibold text-[var(--cal-leave)]">
                  <AlertTriangle size={12} className="mt-px shrink-0" />{capacityWarning}
                </span>
              )}
            </Field>
            <Field label="Business Unit">
              <Select value={fields.bus} onChange={(e) => set("bus", e.target.value)}>{businessUnits.map((b) => <option key={b}>{b}</option>)}</Select>
            </Field>
            <Field label="Priority">
              <Select value={fields.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select>
            </Field>
          </Section>

          <Section title="Schedule">
            <Field label="Start / To be done"><Input type="date" value={fields.start} onChange={(e) => set("start", e.target.value)} /></Field>
            <Field label="Due date" required error={showError("due")}>
              <Input type="date" value={fields.due} onChange={(e) => set("due", e.target.value)} onBlur={() => blur("due")} className={cx(showError("due") && "border-[var(--danger)]")} />
            </Field>
            <Field label="Estimated hours"><Input type="number" step={HOURS_STEP} min="0" value={fields.hrs} onChange={(e) => set("hrs", e.target.value)} /></Field>
            {/* Conditionally required: the asterisk appears as soon as Status is set to
                Complete, so the hours gate is visible before the save is attempted. */}
            <Field label="Actual hours" required={fields.status === "Complete"} error={showError("actualHrs")}>
              <Input type="number" step={HOURS_STEP} min="0" value={fields.actualHrs} onChange={(e) => set("actualHrs", e.target.value)} onBlur={() => blur("actualHrs")} className={cx(showError("actualHrs") && "border-[var(--danger)]")} />
            </Field>
            <Field label="Status"><Select value={fields.status} onChange={(e) => set("status", e.target.value)}>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Planned span">
              <div className="flex min-h-[42px] items-center rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3 text-[0.8rem] font-semibold text-[var(--ink)]">
                {plannedSpan} day window for {fields.hrs || 0}h work
              </div>
            </Field>
          </Section>

          <Section title="Scope" cols={1}>
            <Field>
              <Textarea value={fields.details} onChange={(e) => set("details", e.target.value)} placeholder="Scope, work order path, testing notes, customer blockers…" />
            </Field>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-6 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <span className="hidden text-[0.7rem] text-[var(--ink-muted)] sm:block">Press ⌘/Ctrl + Enter to save</span>
          <div className="flex flex-1 justify-end gap-2">
            <Button type="button" variant="subtle" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : saveError ? "Try again" : job.id ? "Save changes" : "Create job"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
