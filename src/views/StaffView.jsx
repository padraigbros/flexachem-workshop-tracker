import { useMemo, useState } from "react";
import { UserPlus, Trash2, Star } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { useAuthCtx } from "../state/AuthProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { supabase } from "../lib/supabase";
import { PEOPLE } from "../lib/constants";
import { makeGroups } from "../lib/jobs";
import { Card, PanelHeader, Button, Input, Select, EmptyState, Chip, cx } from "../components/ui/primitives";
import { Avatar, Meter } from "../components/ui/dataviz";
import { StatusChip } from "../components/ui/StatusChip";
import { ConfirmDialog } from "../components/ui/overlay";
import { MiniJob } from "../components/jobs/JobBits";

const WEEK_CAPACITY = 40;

export function StaffView() {
  const {
    filteredJobs: jobs, activeJobs, staff, people, activePeople, profiles,
    auditPatch, addStaffMember, updateStaffMember, deleteStaffMember, reassignStaffJobs, updateProfile,
  } = useWorkshop();
  const { user } = useAuthCtx();
  const { openJob } = useJobDrawer();

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Workshop technician");
  const [reassignTargets, setReassignTargets] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const groups = makeGroups(jobs, (j) => j.alloc);
  const staffByName = useMemo(() => new Map(staff.map((m) => [m.name, m])), [staff]);
  const activeCount = staff.filter((m) => m.active).length;
  const inactiveCount = staff.filter((m) => !m.active).length;

  const submit = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addStaffMember({ name, role: newRole.trim() || "Workshop technician", active: true });
    setNewName(""); setNewRole("Workshop technician");
  };

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader
          title="Staff management"
          subtitle="Deactivate leavers to remove them from future assignment, or add new technicians."
          action={<div className="flex gap-1.5"><Chip>{activeCount} active</Chip><Chip>{inactiveCount} inactive</Chip></div>}
        />
        <form className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]" onSubmit={submit}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New staff member name" />
          <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Role" />
          <Button type="submit" variant="primary" className="gap-1.5"><UserPlus size={16} />Add staff</Button>
        </form>
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
                  <Select className="w-auto min-w-[130px]" value={target} onChange={(e) => setReassignTargets((p) => ({ ...p, [member.name]: e.target.value }))}>
                    <option>Unassigned</option>{choices.map((n) => <option key={n}>{n}</option>)}
                  </Select>
                  <Button size="sm" variant="ghost" disabled={!openJobs.length} onClick={() => reassignStaffJobs(member.name, target)}>Move jobs</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateStaffMember(member.id, { active: !member.active })}>{member.active ? "Deactivate" : "Reactivate"}</Button>
                  {!PEOPLE.includes(member.name) && <Button size="sm" variant="danger" onClick={() => setConfirmDelete(member)} className="gap-1"><Trash2 size={13} />Remove</Button>}
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
                  <StatusChip status={profile.active === false ? "Not Started" : "Complete"} size="sm" />
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
                {items.length ? items.map((job) => <MiniJob key={job.id} job={job} onSelect={openJob} onStatus={auditPatch} />) : <EmptyState text="No filtered work allocated." />}
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
    </div>
  );
}
