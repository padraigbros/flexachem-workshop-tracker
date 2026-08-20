import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequireAdmin, RedirectIfAuthed } from "./components/layout/guards";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { LoginView } from "./views/LoginView";
import { InviteView } from "./views/InviteView";
import { PrivacyPolicyView } from "./views/PrivacyPolicyView";
import { DashboardView } from "./views/DashboardView";
import { ScheduleView } from "./views/ScheduleView";
import { Skeleton } from "./components/ui/primitives";

// Heavy views are code-split so they are only downloaded when visited.
const CalendarView = lazy(() => import("./views/CalendarView").then((m) => ({ default: m.CalendarView })));
const StaffView = lazy(() => import("./views/StaffView").then((m) => ({ default: m.StaffView })));
const JobTypesView = lazy(() => import("./views/JobTypesView").then((m) => ({ default: m.JobTypesView })));
const CustomersView = lazy(() => import("./views/CustomersView").then((m) => ({ default: m.CustomersView })));
const BusinessUnitsView = lazy(() => import("./views/BusinessUnitsView").then((m) => ({ default: m.BusinessUnitsView })));
const DueDatesView = lazy(() => import("./views/DueDatesView").then((m) => ({ default: m.DueDatesView })));
const MasterListView = lazy(() => import("./views/MasterListView").then((m) => ({ default: m.MasterListView })));
const AccuracyView = lazy(() => import("./views/AccuracyView").then((m) => ({ default: m.AccuracyView })));

function Lazy({ children }) {
  return (
    <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>}>
      {children}
    </Suspense>
  );
}

function admin(node) {
  return <RequireAdmin><Lazy>{node}</Lazy></RequireAdmin>;
}

export const router = createBrowserRouter([
  {
    // Pathless wrapper so a single errorElement catches errors from every route below,
    // including a lazy-loaded chunk 404 after a new deploy (see RouteErrorBoundary).
    id: "root",
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/login", element: <RedirectIfAuthed><LoginView /></RedirectIfAuthed> },
      // Public: a Supabase invite link establishes a session here so the invitee can set a password.
      { path: "/invite", element: <InviteView /> },
      { path: "/privacy", element: <PrivacyPolicyView /> },
      {
        path: "/",
        element: <RequireAuth><AppShell /></RequireAuth>,
        children: [
          { index: true, element: <DashboardView /> },
          { path: "schedule", element: <ScheduleView /> },
          { path: "calendar", element: <Lazy><CalendarView /></Lazy> },
          { path: "staff", element: <Lazy><StaffView /></Lazy> },
          { path: "job-types", element: admin(<JobTypesView />) },
          { path: "customers", element: admin(<CustomersView />) },
          { path: "business-units", element: admin(<BusinessUnitsView />) },
          { path: "due-dates", element: admin(<DueDatesView />) },
          { path: "master-list", element: admin(<MasterListView />) },
          { path: "accuracy", element: admin(<AccuracyView />) },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
