import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequireAdmin, RedirectIfAuthed } from "./components/layout/guards";
import { LoginView } from "./views/LoginView";
import { DashboardView } from "./views/DashboardView";
import { ScheduleView } from "./views/ScheduleView";
import { Skeleton } from "./components/ui/primitives";

// Admin-only views are code-split — staff phones never download them.
const StaffView = lazy(() => import("./views/StaffView").then((m) => ({ default: m.StaffView })));
const JobTypesView = lazy(() => import("./views/JobTypesView").then((m) => ({ default: m.JobTypesView })));
const CustomersView = lazy(() => import("./views/CustomersView").then((m) => ({ default: m.CustomersView })));
const BusinessUnitsView = lazy(() => import("./views/BusinessUnitsView").then((m) => ({ default: m.BusinessUnitsView })));
const DueDatesView = lazy(() => import("./views/DueDatesView").then((m) => ({ default: m.DueDatesView })));
const MasterListView = lazy(() => import("./views/MasterListView").then((m) => ({ default: m.MasterListView })));

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
  { path: "/login", element: <RedirectIfAuthed><LoginView /></RedirectIfAuthed> },
  {
    path: "/",
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <DashboardView /> },
      { path: "schedule", element: <ScheduleView /> },
      { path: "staff", element: admin(<StaffView />) },
      { path: "job-types", element: admin(<JobTypesView />) },
      { path: "customers", element: admin(<CustomersView />) },
      { path: "business-units", element: admin(<BusinessUnitsView />) },
      { path: "due-dates", element: admin(<DueDatesView />) },
      { path: "master-list", element: admin(<MasterListView />) },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
