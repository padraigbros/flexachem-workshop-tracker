import { useMemo, useState } from "react";
import { UserPlus, Trash2, Star, CalendarDays, Send } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { useAuthCtx } from "../state/AuthProvider";
import { supabase } from "../lib/supabase";
import { buildRoster, rosterRole, rosterActive, rosterPending } from "../lib/staff";
import { ACCOUNT_ROLES, ACCOUNT_ROLE_META } from "../lib/constants";
import { Card, PanelHeader, Button, Input, Select, Field, IconButton, EmptyState, Chip, cx } from "../components/ui/primitives";
import { Avatar } from "../components/ui/dataviz";
import { ConfirmDialog, Modal, ModalHeader } from "../components/ui/overlay";
import { StaffCalendarModal } from "../components/staff/StaffCalendarModal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cloud = Boolean(supabase);

export function StaffView() {
  const {
    staff, accounts, calendar, holidays, setCalendarEntry, inviteStaff,
    addStaffMember, updateStaffMember, deleteStaffMember, updateAccount, setPersonRole,
  } = useWorkshop();
  const { user, isAdmin } = useAuthCtx();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "technician" });
  const [addSubmitted, setAddSubmitted] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [calendarMember, setCalendarMember] = useState(null);
  const [resending, setResending] = useState(null);

  // Unified roster: one row per person, reconciling the staff record (assignable to jobs,
  // has a calendar) with the login account (role, sign-in status). Matched by email.
  // Shared with the Team Availability calendar via buildRoster.
  const roster = useMemo(() => buildRoster(staff, accounts), [staff, accounts]);

  const roleOf = rosterRole;
  const isActiveRow = rosterActive;
  const isPending = rosterPending;

  const technicianCount = roster.filter((r) => roleOf(r) === "technician").length;
  const staffCount = roster.filter((r) => roleOf(r) === "staff").length;
  const adminCount = roster.filter((r) => roleOf(r) === "admin").length;
  const pendingCount = roster.filter(isPending).length;

  const emailError = form.email && !EMAIL_RE.test(form.email.trim()) ? "Enter a valid email" : null;
  const resetForm = () => { setForm({ name: "", email: "", role: "technician" }); setAddSubmitted(false); };

  const submit = async (e) => {
    e.preventDefault();
    setAddSubmitted(true);
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || emailError) return;
    setInviting(true);
    // Only technicians are assignable and get a calendar, and that needs a `staff` record —
    // the account role alone is not enough. In demo mode (no accounts at all) always create
    // the record so the person is visible.
    if (!cloud || form.role === "technician") addStaffMember({ name, email, role: "Workshop technician", active: true });
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

  // The staff-record backfill that assignability depends on lives in setPersonRole, so the
  // roster and the availability drawer cannot drift apart. Only the self-demotion warning is
  // kept here, because it needs the signed-in user.
  const changeRole = (row, nextRole) => {
    const p = row.account;
    if (!p || nextRole === p.role) return;
    if (p.id === user?.id && p.role === "admin"
      && !window.confirm("Change your own role? You will lose admin access immediately.")) return;
    setPersonRole(row, nextRole);
  };

  const resend = async (row) => {
    setResending(row.key);
    try { await inviteStaff({ email: row.email, name: row.name, role: roleOf(row) }); }
    finally { setResending(null); }
  };

  return (
    <div className="space-y-5">
      {isAdmin && <Card>
        <PanelHeader
          title="Team"
          subtitle="Everyone who signs in or gets assigned work. Technicians are assignable to jobs and have an availability calendar; staff (sales and managers) and admins are not."
          action={(
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip>{technicianCount} technician</Chip>
              {cloud && <Chip>{staffCount} staff</Chip>}
              {cloud && <Chip>{adminCount} admin</Chip>}
              {pendingCount > 0 && <Chip>{pendingCount} pending</Chip>}
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { resetForm(); setAddOpen(true); }}><UserPlus size={15} />Add person</Button>
            </div>
          )}
        />
        <div className="grid gap-2.5">
          {roster.length ? roster.map((row) => {
            const role = roleOf(row);
            const admin = role === "admin";
            const technician = role === "technician";
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
                  {/* Three roles, three weights: admin is the privileged one (starred), a
                      technician is the one who can hold work, and staff is the quiet default. */}
                  <span className={cx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold",
                    admin && "bg-[var(--status-active-bg)] text-[var(--status-active)]",
                    technician && "bg-[var(--status-done-bg)] text-[var(--status-done)]",
                    !admin && !technician && "bg-[var(--surface-sunken)] text-[var(--ink-muted)]",
                  )}>
                    {admin && <Star size={10} />}{ACCOUNT_ROLE_META[role].label}
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
                  {/* Slot 1 — calendar, technicians only (they are the only people with one).
                      Everyone else keeps the empty placeholder so the remaining controls stay
                      in the same columns. */}
                  {member && technician
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
                      // A Select rather than a button: with three roles a toggle would need two
                      // clicks to reach the third. It must stay inside the 6.625rem slot — the
                      // name column is minmax(0,1fr) and pays for any width added here.
                      <Select
                        aria-label={`Role for ${row.name}`}
                        className="h-9 !px-2 text-[0.78rem] lg:w-full"
                        value={role}
                        onChange={(e) => changeRole(row, e.target.value)}
                      >
                        {ACCOUNT_ROLES.map((key) => <option key={key} value={key}>{ACCOUNT_ROLE_META[key].label}</option>)}
                      </Select>
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
          }) : <EmptyState text="No one on the team yet. Use “Add person” to invite your first technician." />}
        </div>
      </Card>}

      {isAdmin && <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Remove ${confirmDelete?.name}?`}
        message="Open jobs assigned to this person will be set to Unassigned. This removes their staff record; any login account is unaffected. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmDelete && deleteStaffMember(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />}

      <StaffCalendarModal
        member={calendarMember}
        open={Boolean(calendarMember)}
        calendar={calendar}
        holidays={holidays}
        onSetEntry={setCalendarEntry}
        onClose={() => setCalendarMember(null)}
      />

      {isAdmin && <Modal open={addOpen} onClose={() => setAddOpen(false)} size="md">
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
            <Field label="Role" hint={ACCOUNT_ROLE_META[form.role]?.hint}>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ACCOUNT_ROLES.map((key) => (
                  <option key={key} value={key}>{ACCOUNT_ROLE_META[key].label} — {ACCOUNT_ROLE_META[key].hint}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-6 py-4">
            <Button type="button" variant="subtle" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={inviting} className="gap-1.5"><UserPlus size={16} />{inviting ? "Sending…" : "Add & invite"}</Button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
