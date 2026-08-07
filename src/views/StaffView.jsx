import { useMemo, useState } from "react";
import { UserPlus, Trash2, Star, CalendarDays, Send, CalendarRange } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { useStatusPrompt } from "../state/StatusPromptProvider";
import { useAuthCtx } from "../state/AuthProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { supabase } from "../lib/supabase";
import { makeGroups } from "../lib/jobs";
import { buildRoster, rosterRole, rosterActive, rosterPending } from "../lib/staff";
import { indexEntries, holidayIndex, weekAvailableHours } from "../lib/calendar";
import { today, toISODate } from "../lib/dates";
import { WEEK_CAPACITY } from "../lib/constants";
import { formatHours } from "../lib/format";
import { Card, PanelHeader, Button, Input, Select, Field, IconButton, EmptyState, Chip, cx } from "../components/ui/primitives";
import { Avatar, Meter } from "../components/ui/dataviz";
import { StatusChip } from "../components/ui/StatusChip";
import { ConfirmDialog, Modal, ModalHeader } from "../components/ui/overlay";
import { MiniJob } from "../components/jobs/JobBits";
import { StaffCalendarModal } from "../components/staff/StaffCalendarModal";
import { TeamAvailabilityView } from "../components/staff/TeamAvailabilityView";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cloud = Boolean(supabase);

export function StaffView() {
  const {
    filteredJobs: jobs, staff, people, accounts,
    calendar, holidays, setCalendarEntry, inviteStaff,
    addStaffMember, updateStaffMember, deleteStaffMember, updateAccount,
  } = useWorkshop();
  const { requestStatusChange } = useStatusPrompt();
  const { user } = useAuthCtx();
  const { openJob } = useJobDrawer();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" });
  const [addSubmitted, setAddSubmitted] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [calendarMember, setCalendarMember] = useState(null);
  const [resending, setResending] = useState(null);

  const groups = makeGroups(jobs, (j) => j.alloc);
  const staffByName = useMemo(() => new Map(staff.map((m) => [m.name, m])), [staff]);

  // Availability indexes for the per-person workload cards: a card's weekly capacity is the
  // person's *available* hours this week (37.5h minus 7.5h per leave/training/sick/holiday
  // day), not a flat 37.5h — so the meter reflects the calendar. Reuses the calendar helpers.
  const entriesByKey = useMemo(() => indexEntries(calendar), [calendar]);
  const holidaySet = useMemo(() => holidayIndex(holidays).set, [holidays]);
  const todayISO = toISODate(today());

  // Unified roster: one row per person, reconciling the staff record (assignable to jobs,
  // has a calendar) with the login account (role, sign-in status). Matched by email.
  // Shared with the Team Availability calendar via buildRoster.
  const roster = useMemo(() => buildRoster(staff, accounts), [staff, accounts]);

  const roleOf = rosterRole;
  const isActiveRow = rosterActive;
  const isPending = rosterPending;

  const staffCount = roster.filter((r) => roleOf(r) !== "admin").length;
  const adminCount = roster.filter((r) => roleOf(r) === "admin").length;
  const pendingCount = roster.filter(isPending).length;

  const emailError = form.email && !EMAIL_RE.test(form.email.trim()) ? "Enter a valid email" : null;
  const resetForm = () => { setForm({ name: "", email: "", role: "staff" }); setAddSubmitted(false); };

  const submit = async (e) => {
    e.preventDefault();
    setAddSubmitted(true);
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || emailError) return;
    setInviting(true);
    // Staff are assignable technicians (staff record + calendar); admins manage only. In demo
    // mode (no accounts) always create the record so the person is visible.
    if (!cloud || form.role === "staff") addStaffMember({ name, email, role: "Workshop technician", active: true });
    try {
      await inviteStaff({ email, name, role: form.role });
    } finally {
      setInviting(false);
      setAddOpen(false);
      resetForm();
    }
  };

  const setPersonActive = (row, active) => {
    if (row.staff) updateStaffMember(row.staff.id, { active });
    if (row.account) updateAccount(row.account.id, { active });
  };

  const toggleRole = (row) => {
    const p = row.account;
    if (!p) return;
    if (p.id === user?.id && !window.confirm("Change your own role? You will lose admin access immediately.")) return;
    const nextRole = p.role === "admin" ? "staff" : "admin";
    updateAccount(p.id, { role: nextRole });
    // Becoming staff means becoming assignable — which needs a staff record, not just the
    // account role. Without this an admin demoted to staff got no calendar and no jobs.
    if (nextRole === "staff" && !row.staff) {
      addStaffMember({ name: row.name, email: row.email, role: "Workshop technician", active: true });
    }
  };

  const resend = async (row) => {
    setResending(row.key);
    try { await inviteStaff({ email: row.email, name: row.name, role: roleOf(row) }); }
    finally { setResending(null); }
  };

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader
          title="Team"
          subtitle="Everyone who signs in or gets assigned work. Staff are assignable to jobs and have an availability calendar; admins manage the shop but aren't assignable."
          action={(
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip>{staffCount} staff</Chip>
              {cloud && <Chip>{adminCount} admin</Chip>}
              {pendingCount > 0 && <Chip>{pendingCount} pending</Chip>}
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { resetForm(); setAddOpen(true); }}><UserPlus size={15} />Add person</Button>
            </div>
          )}
        />
        <div className="grid gap-2.5">
          {roster.length ? roster.map((row) => {
            const admin = roleOf(row) === "admin";
            const member = row.staff;
            const active = isActiveRow(row);
            const pending = isPending(row);
            const isSelf = row.account?.id === user?.id;
            return (
              // Fixed tracks, not `auto`/`fr`, because each row is its OWN grid: an `auto`
              // column resolves to that row's content width, so a longer badge group or a
              // different set of buttons shifted every control to its right out of line with
              // the row above. The badge track is a fixed width and the action cluster below
              // is a fixed-width grid of slots, so every row resolves identically.
              //
              // Keep the fixed tracks SMALL. `minmax(0,1fr)` on the name column means it will
              // happily collapse to zero width to satisfy them: an earlier, wider action
              // cluster did exactly that at 1280px, hiding every name and failing the smoke
              // suite. Anything added here has to earn its width.
              <div key={row.key} className={cx("grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3.5 lg:grid-cols-[minmax(0,1fr)_9rem_auto] lg:items-center", !active && "opacity-70")}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={row.name} size={40} />
                  <div className="min-w-0">
                    <strong className="block truncate text-[0.9rem] text-[var(--ink)]">{row.name}</strong>
                    <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">{row.email || (member?.role || "Workshop technician")}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold", admin ? "bg-[var(--status-active-bg)] text-[var(--status-active)]" : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]")}>
                    {admin && <Star size={10} />}{admin ? "Admin" : "Staff"}
                  </span>
                  {/* No Active/Inactive chip: the Deactivate/Reactivate button already says
                      which state the person is in, and the row dims when inactive. Pending
                      stays — it means "invited, never signed in", which no button conveys,
                      and it pairs with Resend. */}
                  {pending && <Chip>Pending</Chip>}
                </div>
                {/* One fixed-width slot per control, in a fixed order, so the same control
                    sits in the same column on every row. A row that doesn't use a slot
                    renders an empty placeholder rather than collapsing it — collapsing is
                    what pulled the admin rows out of line with the staff rows. Below `lg`
                    this reverts to the wrapping flex row. */}
                <div className="flex flex-wrap items-center gap-2 lg:grid lg:grid-cols-[2.125rem_6.625rem_6.625rem] lg:gap-2">
                  {/* Slot 1 — calendar, staff only. Admins keep the empty placeholder so
                      their remaining controls stay in the same columns. */}
                  {member && !admin
                    ? <IconButton label={`${row.name}'s calendar`} className="h-9 w-9" onClick={() => setCalendarMember(member)}><CalendarDays size={16} /></IconButton>
                    : <span className="hidden lg:block" />}

                  {/* Slot 2 — role toggle, or Remove, or Resend. These are mutually exclusive
                      by construction, which is why they share one slot and no gap is left
                      behind: the role toggle needs an account; Remove is only offered for a
                      staff record with NO account (an active staff-role account always gets a
                      staff record back from the reconciler in WorkshopProvider, so deleting
                      one for a person who can log in just recreates it); Resend needs an
                      account that has never signed in. */}
                  {row.account ? (
                    pending && row.email ? (
                      <Button size="sm" variant="secondary" className="gap-1 whitespace-nowrap lg:w-full" disabled={resending === row.key} onClick={() => resend(row)}><Send size={13} />{resending === row.key ? "Sending…" : "Resend"}</Button>
                    ) : (
                      <Button size="sm" variant="secondary" className="whitespace-nowrap lg:w-full" onClick={() => toggleRole(row)}>{admin ? "Make staff" : "Make admin"}</Button>
                    )
                  ) : member ? (
                    <Button size="sm" variant="danger" disabled={isSelf} onClick={() => setConfirmDelete(member)} className="gap-1 whitespace-nowrap lg:w-full"><Trash2 size={13} />Remove</Button>
                  ) : <span className="hidden lg:block" />}

                  {/* Slot 3 — Deactivate / Reactivate. Doubles as the active-state indicator,
                      which is why there is no Active chip. */}
                  <Button size="sm" variant="ghost" className="whitespace-nowrap lg:w-full" disabled={isSelf} onClick={() => setPersonActive(row, !active)}>{active ? "Deactivate" : "Reactivate"}</Button>
                </div>
              </div>
            );
          }) : <EmptyState text="No one on the team yet. Use “Add person” to invite your first staff member or admin." />}
        </div>
      </Card>

      {/* Team Availability — a permanent section (was a List/Calendar toggle). */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <CalendarRange size={18} className="shrink-0 text-[var(--color-brand-500)]" />
          <div className="min-w-0">
            <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--ink)]">Team Availability</h3>
            <p className="text-[0.78rem] text-[var(--ink-muted)]">Everyone&apos;s week at a glance — set Training, Leave or Sick days across the whole team.</p>
          </div>
        </div>
        <TeamAvailabilityView onOpenFullCalendar={setCalendarMember} />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => {
          const items = groups[person] || [];
          const open = items.filter((j) => j.status !== "Complete");
          const estimated = open.reduce((s, j) => s + Number(j.hrs || 0), 0);
          const actual = open.reduce((s, j) => s + Number(j.actualHrs || 0), 0);
          const blocked = open.filter((j) => j.status === "Input Needed").length;
          const member = staffByName.get(person);
          const inactive = member && !member.active;
          // Availability-aware weekly capacity: this week's free hours (falls back to a flat
          // 37.5h for job-allocation names that have no staff record / calendar).
          const capacity = member ? weekAvailableHours(member.id, todayISO, entriesByKey, holidaySet) : WEEK_CAPACITY;
          return (
            <Card key={person} className={cx(inactive && "opacity-70")}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={person} size={42} />
                  <div>
                    <div className="flex items-center gap-2 text-[1.05rem] font-bold tracking-tight text-[var(--ink)]">{person}{inactive && <Chip>Inactive</Chip>}</div>
                    <div className="text-[0.72rem] text-[var(--ink-muted)] tnum">{formatHours(estimated)}h of {formatHours(capacity)}h week</div>
                  </div>
                </div>
                <StatusChip status={blocked ? "Input Needed" : open.length ? "In Progress" : "Complete"} size="sm" />
              </div>
              <Meter className="mb-3 h-2.5" value={(estimated / (capacity || 1)) * 100} tone={estimated > capacity ? "var(--danger)" : "var(--color-brand-500)"} />
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[["Assigned", open.length], ["Estimated", `${formatHours(estimated)}h`], ["Actual", `${formatHours(actual)}h`]].map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-[var(--surface-sunken)] p-2.5 text-center">
                    <strong className="block text-lg font-extrabold text-[var(--ink)] tnum">{val}</strong>
                    <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{label}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                {items.length ? items.map((job) => <MiniJob key={job.id} job={job} onSelect={openJob} onStatus={requestStatusChange} />) : <EmptyState text="No filtered work allocated." />}
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Remove ${confirmDelete?.name}?`}
        message="Open jobs assigned to this person will be set to Unassigned. This removes their staff record; any login account is unaffected. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmDelete && deleteStaffMember(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />

      <StaffCalendarModal
        member={calendarMember}
        open={Boolean(calendarMember)}
        calendar={calendar}
        holidays={holidays}
        onSetEntry={setCalendarEntry}
        onClose={() => setCalendarMember(null)}
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} size="md">
        <form onSubmit={submit} className="flex flex-col">
          <ModalHeader
            eyebrow="Invite to the team"
            title="Add a person"
            subtitle={cloud ? "They'll get an email invite to set a password — no separate verification step." : "Demo mode: the staff record is added; email invites need a connected Supabase project."}
            onClose={() => setAddOpen(false)}
          />
          <div className="space-y-4 p-6">
            <Field label="Name" error={addSubmitted && !form.name.trim() ? "Required" : null}>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
            </Field>
            <Field label="Email address" error={(addSubmitted && !form.email.trim() ? "Required" : null) || emailError}>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
            </Field>
            <Field label="Role" hint="Staff are assignable to jobs and get a calendar. Admins get every section but aren't assignable.">
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="staff">Staff — assignable technician</option>
                <option value="admin">Admin — manage only</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-6 py-4">
            <Button type="button" variant="subtle" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={inviting} className="gap-1.5"><UserPlus size={16} />{inviting ? "Sending…" : "Add & invite"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
