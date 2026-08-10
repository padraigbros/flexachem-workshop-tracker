import { LayoutDashboard, KanbanSquare, Users, Wrench, Building2, CalendarClock, Table2, Handshake, Target } from "lucide-react";

// Single source of truth for navigation, shared by the sidebar and the mobile tab bar.
// NOTE: the mobile tab bar shows the first 5 admin-visible items — keep Customers and
// anything new after Business Units (index 4) so the mobile tab set doesn't shift.
export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", hint: "Live command centre", icon: LayoutDashboard, end: true, admin: false },
  { to: "/schedule", label: "Schedule", hint: "Drag status columns", icon: KanbanSquare, admin: false },
  { to: "/staff", label: "Staff", hint: "Availability & workload", icon: Users, admin: false },
  { to: "/job-types", label: "Job Types", hint: "Maintain the catalogue", icon: Wrench, admin: true },
  { to: "/business-units", label: "Business Units", hint: "Pumps, valves, mechanical seals", icon: Building2, admin: true },
  { to: "/customers", label: "Customers", hint: "Customer catalogue & reports", icon: Handshake, admin: true },
  { to: "/due-dates", label: "Due Dates", hint: "Delivery windows", icon: CalendarClock, admin: true },
  { to: "/master-list", label: "Master List", hint: "Full job register", icon: Table2, admin: true },
  { to: "/accuracy", label: "Accuracy", hint: "Estimate vs actual by job and person", icon: Target, admin: true },
];

export const PAGE_META = {
  "/": ["Workshop Command Centre", "Live visibility across staff, business units and due-date risk."],
  "/schedule": ["Schedule Production Board", "Drag cards between status lanes or use the quick status controls."],
  "/staff": ["Team & Workload", "Availability, schedules and workload at a glance."],
  "/job-types": ["Job Type Management", "Add job types, batch-move jobs, deactivate or remove unused types."],
  "/customers": ["Customer Management", "Add customers, batch-move jobs, deactivate or remove unused ones."],
  "/business-units": ["Business Unit Portfolio", "Roll up jobs by Pumps, Valves, Mechanical Seals, Process and Venting."],
  "/due-dates": ["Due Date Control", "Understand overdue work, delivery windows and multi-day jobs."],
  "/master-list": ["Master Job Register", "Dense, searchable production list for admin and planning."],
  "/accuracy": ["Estimate Accuracy", "How close booked hours land to actuals, per job and per staff member."],
};
