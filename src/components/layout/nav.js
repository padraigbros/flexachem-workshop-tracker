import { LayoutDashboard, KanbanSquare, Users, Wrench, Building2, CalendarClock, Table2 } from "lucide-react";

// Single source of truth for navigation, shared by the sidebar and the mobile tab bar.
export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", hint: "Live command centre", icon: LayoutDashboard, end: true, admin: false },
  { to: "/schedule", label: "Schedule", hint: "Drag status columns", icon: KanbanSquare, admin: false },
  { to: "/staff", label: "Staff", hint: "Manage staff & workload", icon: Users, admin: true },
  { to: "/job-types", label: "Job Types", hint: "Maintain the catalogue", icon: Wrench, admin: true },
  { to: "/business-units", label: "Business Units", hint: "Pharma, mining, industrial", icon: Building2, admin: true },
  { to: "/due-dates", label: "Due Dates", hint: "Delivery windows", icon: CalendarClock, admin: true },
  { to: "/master-list", label: "Master List", hint: "Full job register", icon: Table2, admin: true },
];

export const PAGE_META = {
  "/": ["Workshop Command Centre", "Live visibility across staff, business units and due-date risk."],
  "/schedule": ["Schedule Production Board", "Drag cards between status lanes or use the quick status controls."],
  "/staff": ["Staff Management", "Add staff, deactivate leavers, reassign open jobs and monitor workload."],
  "/job-types": ["Job Type Management", "Add job types, batch-move jobs, deactivate or remove unused types."],
  "/business-units": ["Business Unit Portfolio", "Roll up jobs by Pharma, Industrial, Engineering, Mining and Other."],
  "/due-dates": ["Due Date Control", "Understand overdue work, delivery windows and multi-day jobs."],
  "/master-list": ["Master Job Register", "Dense, searchable production list for admin and planning."],
};
