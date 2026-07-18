import { Navigate, useLocation } from "react-router-dom";
import { useAuthCtx } from "../../state/AuthProvider";
import { BrandMark } from "./Sidebar";

function CheckingSession() {
  return (
    <div className="grid min-h-[100dvh] place-items-center p-6">
      <div className="card grid max-w-sm gap-3 p-7 text-center">
        <div className="mx-auto animate-pulse"><BrandMark /></div>
        <div className="text-lg font-bold text-[var(--ink)]">Checking session…</div>
        <div className="text-[0.82rem] text-[var(--ink-muted)]">Restoring your workshop login.</div>
      </div>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, checking } = useAuthCtx();
  const location = useLocation();
  if (checking) return <CheckingSession />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function RequireAdmin({ children }) {
  const { isAdmin } = useAuthCtx();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export function RedirectIfAuthed({ children }) {
  const { user, checking } = useAuthCtx();
  if (checking) return <CheckingSession />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
