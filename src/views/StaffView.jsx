import { useMemo, useState } from "react";
import { UserPlus, Trash2, Star, CalendarDays } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { useStatusPrompt } from "../state/StatusPromptProvider";
import { useAuthCtx } from "../state/AuthProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { supabase } from "../lib/supabase";
import { makeGroups } from "../lib/jobs";
import { WEEK_CAPACITY } from "../lib/constants";
import { Card, PanelHeader, Button, Input, Select, Field, IconButton, EmptyState, Chip, cx } from "../components/ui/primitives";
import { Avatar, Meter } from "../components/ui/dataviz";
import { StatusChip } from "../components/ui/StatusChip";
import { ConfirmDialog, Modal, ModalHeader } from "../components/ui/overlay";
import { MiniJob } from "../components/jobs/JobBits";
import { StaffCalendarModal } from "../components/staff/StaffCalendarModal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StaffView() {
  const {
    filteredJobs: jobs, activeJobs, staff, people, activePeople, profiles,
    calendar, holidays, setCalendarEntry, inviteStaff,
    addStaffMember, updateStaffMember, deleteStaffMember, reassignStaffJobs, updateProfile,
  } = useWorkshop();
  const { requestStatusChange } = useStatusPrompt();
  const { user } = useAuthCtx();
  const { openJob } = useJobDrawer();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" });
  const [addSubmitted, setAddSubmitted] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [reassignTargets, setReassignTargets] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [calendarMember, setCalendarMember] = useState(null);

  const groups = makeGroups(jobs, (j) => j.alloc);
  const staffByName = useMemo(() => new Map(staff.map((m) => [m.name, m])), [staff]);
  const activeCount = staff.filter((m) => m.active).length;
  const inactiveCount = staff.filter((m) => !m.active).length;

  const emailError = form.email && !EMAIL_RE.test(form.email.trim()) ? "Enter a valid email" : null;
  const resetForm = () => { setForm({ name: "", email: "", role: "staff" }); setAddSubmitted(false); };

  const submit = async (e) => {
    e.preventDefault();
    setAddSubmitted(true);
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || emailError) return;
    setInviting(true);
    addStaffMember({ name, email, role: "Workshop technician", active: true });
    try {
      await inviteStaff({ email, name, role: form.role });
    } finally {
      setInviting(false);
      setAddOpen(false);
      resetForm();
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader
          title="Staff management"
          subtitle="Deactivate leavers to remove them from future assignment, or invite new technicians."
          action={(
            <div className="flex items-center gap-1.5">
              <Chip>{activeCount} active</Chip><Chip>{inactiveCount} inactive</Chip>
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { resetForm(); setAddOpen(true); }}><UserPlus size={15} />Add staff</Button>
            </div>
          )}
        />
        <div className="grid gap-2.5">
          {staff.map((member) => {
            const openJobs = activeJobs.filter((j) => j.alloc === member.name && j.status !== "Complete");
            const choices = activePeople.filter((n) => n !== member.name);
            const target = reassignTargets[member.name] || "Unassigned";
            return (
              <div key={member.id} className={cx("grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] lg:items-center", !member.active && "opacity-70")}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={member.name} size={40} />
                  <div className="min-w-0">
                    <strong className="block truncate text-[0.9rem] text-[var(--ink)]">{member.name}</strong>
                    <span className="text-[0.75rem] text-[var(--ink-muted)]">{member.role || "Workshop technician"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <StatusChip status={member.active ? "Complete" : "Not Started"} size="sm" />
                  <Chip>{openJobs.length} open</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <IconButton label={`${member.name}'s calendar`} className="h-9 w-9" onClick={() => setCalendarMember(member)}><CalendarDays size={16} /></IconButton>
                  <Select className="w-auto min-w-[130px]" value={target} onChange={(e) => setReassignTargets((p) => ({ ...p, [member.name]: e.target.value }))}>
                    <option>Unassigned</option>{choices.map((n) => <option key={n}>{n}</option>)}
                  </Select>
                  <Button size="sm" variant="ghost" disabled={!openJobs.length} onClick={() => reassignStaffJobs(member.name, target)}>Move jobs</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateStaffMember(member.id, { active: !member.active })}>{member.active ? "Deactivate" : "Reactivate"}</Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(member)} className="gap-1"><Trash2 size={13} />Remove</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {supabase && (
        <Card>
          <PanelHeader
            title="Login accounts"
            subtitle="Admins get every section; staff see the Dashboard and Schedule. New signups start as staff."
            action={<Chip>{profiles.length} account{profiles.length === 1 ? "" : "s"}</Chip>}
          />
          <div className="grid gap-2.5">
            {profiles.length ? profiles.map((profile) => (
              <div key={profile.id} className={cx("grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3.5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center", profile.active === false && "opacity-70")}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={profile.name || profile.email} size={40} />
                  <div className="min-w-0"><strong className="block truncate text-[0.9rem] text-[var(--ink)]">{profile.name || "—"}</strong><span className="truncate text-[0.75rem] text-[var(--ink-muted)]">{profile.email}</span></div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold", profile.role === "admin" ? "bg-[var(--status-active-bg)] text-[var(--status-active)]" : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]")}>
                    {profile.role === "admin" && <Star size={10} />}{profile.role === "admin" ? "Admin" : "Staff"}
                  </span>
                  {profile.onboarded === false
                    ? <Chip>Pending</Chip>
                    : <StatusChip status={profile.active === false ? "Not Started" : "Complete"} size="sm" />}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button size="sm" variant="secondary" onClick={() => {
                    if (profile.id === user.id && !window.confirm("Change your own role? You will lose admin access immediately.")) return;
                    updateProfile(profile.id, { role: profile.role === "admin" ? "staff" : "admin" });
                  }}>{profile.role === "admin" ? "Make staff" : "Make admin"}</Button>
                  <Button size="sm" variant="ghost" disabled={profile.id === user.id} onClick={() => updateProfile(profile.id, { active: profile.active === false })}>
                    {profile.active === false ? "Enable" : "Disable"}
                  </Button>
                </div>
              </div>
            )) : <EmptyState text="No login accounts yet. Accounts appear here after people sign up." />}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => {
          const items = groups[person] || [];
          const open = items.filter((j) => j.status !== "Complete");
          const hours = open.reduce((s, j) => s + Number(j.hrs || 0), 0);
          const blocked = open.filter((j) => j.status === "Input Needed").length;
          const member = staffByName.get(person);
          const inactive = member && !member.active;
          return (
            <Card key={person} className={cx(inactive && "opacity-70")}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={person} size={42} />
                  <div>
                    <div className="flex items-center gap-2 text-[1.05rem] font-bold tracking-tight text-[var(--ink)]">{person}{inactive && <Chip>Inactive</Chip>}</div>
                    <div className="text-[0.72rem] text-[var(--ink-muted)] tnum">{hours}h of {WEEK_CAPACITY}h week</div>
                  </div>
                </div>
                <StatusChip status={blocked ? "Input Needed" : open.length ? "In Progress" : "Complete"} size="sm" />
              </div>
              <Meter className="mb-3 h-2.5" value={(hours / WEEK_CAPACITY) * 100} tone={hours > WEEK_CAPACITY ? "var(--danger)" : "var(--color-brand-500)"} />
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[["Open", open.length], ["Hours", `${hours}h`], ["Blocked", blocked]].map(([label, val]) => (
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
        message="Open jobs assigned to this person will be set to Unassigned. This cannot be undone."
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
            eyebrow="Invite technician"
            title="Add a staff member"
            subtitle={supabase ? "They'll get an email invite to set a password — no separate verification step." : "Demo mode: the staff record is added; email invites need a connected Supabase project."}
            onClose={() => setAddOpen(false)}
          />
          <div className="space-y-4 p-6">
            <Field label="Name" error={addSubmitted && !form.name.trim() ? "Required" : null}>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
            </Field>
            <Field label="Email address" error={(addSubmitted && !form.email.trim() ? "Required" : null) || emailError}>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
            </Field>
            <Field label="Role" hint="Admins get every section; staff see the Dashboard and Schedule.">
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
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
