import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { supabase, SUPABASE_PROFILES_TABLE } from "../lib/supabase";
import { USER_KEY } from "../lib/constants";
import { getInitialUser } from "../lib/storage";

const AuthContext = createContext(null);

// Auth state — logic moved verbatim from the original useAuth hook, wrapped in a provider.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (supabase) return null;
    const stored = getInitialUser();
    return stored ? { ...stored, role: "admin" } : null;
  });
  const [checking, setChecking] = useState(Boolean(supabase));
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function applySession(session) {
      if (!session?.user) {
        if (!cancelled) {
          setUser(null);
          setChecking(false);
        }
        return;
      }
      const { data: profile } = await supabase.from(SUPABASE_PROFILES_TABLE).select("*").eq("id", session.user.id).maybeSingle();
      if (cancelled) return;
      if (profile && profile.active === false) {
        setUser(null);
        setChecking(false);
        await supabase.auth.signOut();
        toast.error("Account deactivated", { description: "Contact an administrator." });
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.user_metadata?.name || session.user.email,
        role: profile?.role || "staff",
      });
      setChecking(false);
    }
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      applySession(session);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Persist the demo-mode identity so a refresh keeps the user signed in.
  useEffect(() => {
    if (!supabase && user) localStorage.setItem(USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
  }, [user]);

  const loginLocal = useCallback((profile) => setUser({ ...profile, role: "admin" }), []);
  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, checking, recovery, setRecovery, loginLocal, logout, isAdmin: user?.role === "admin", cloud: Boolean(supabase) }),
    [user, checking, recovery],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthCtx() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthCtx must be used within AuthProvider");
  return ctx;
}
