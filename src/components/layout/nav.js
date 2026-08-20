import { LayoutDashboard, KanbanSquare, Users, Wrench, Building2, CalendarClock, CalendarRange, Table2, Handshake, Target } from "lucide-react";

// Single source of truth for navigation, shared by the sidebar, the mobile tab bar and the
// command palette.
//
// ORDER IS LOAD-BEARING. The mobile tab bar (and therefore the Android APK's) renders only
// the first 5 admin-visible items, and on mobile there is no other menu — anything past
// slot 5 is reachable only through the command palette. So the first five entries are a
// budget, and the admin-visible ones are: Dashboard, Schedule, Calendar, Staff, Job Types.
// Business Units was pushed off that bar deliberately when Calendar took its own tab on
// 20 Aug 2026; it remains in the desktop sidebar and the palette.
//
// Adding a NON-admin item costs an admin one tab slot. Adding an admin item after index 4
// costs nothing. Decide which you are doing before you add a row here.
export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", hint: "Live command centre", icon: LayoutDashboard, end: true, admin: false },
  { to: "/schedule", label: "Schedule", hint: "Drag status columns", icon: KanbanSquare, admin: false },
  { to: "/calendar", label: "Calendar", hint: "Team availability week & month", icon: CalendarRange, admin: false },
  { to: "/staff", label: "Staff", hint: "Team roster & workload", icon: Users, admin: false },
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
  "/calendar": ["Team Availability", "Every technician's week at a glance — set Training, Leave, Sick or Booked days."],
  "/staff": ["Team & Workload", "The roster, and what each technician is carrying."],
  "/job-types": ["Job Type Management", "Add job types, batch-move jobs, deactivate or remove unused types."],
  "/customers": ["Customer Management", "Add customers, batch-move jobs, deactivate or remove unused ones."],
  "/business-units": ["Business Unit Portfolio", "Roll up jobs by Pumps, Valves, Mechanical Seals, Process and Venting."],
  "/due-dates": ["Due Date Control", "Understand overdue work, delivery windows and multi-day jobs."],
  "/master-list": ["Master Job Register", "Dense, searchable production list for admin and planning."],
  "/accuracy": ["Estimate Accuracy", "How close booked hours land to actuals, per job and per staff member."],
};
