import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { supabase, SUPABASE_ACCOUNTS_TABLE } from "../lib/supabase";
import { captureAuthFailure } from "../lib/monitoring";
import { USER_KEY, THEMES } from "../lib/constants";
import { getInitialUser } from "../lib/storage";
import { useTheme } from "./ThemeProvider";

const AuthContext = createContext(null);

// One transient blip on a phone should not cost somebody their admin controls, so the account
// lookup gets a couple of quick retries before it counts as a real failure.
const ACCOUNT_LOOKUP_RETRIES = 2;

async function fetchAccount(userId) {
  let lastError = null;
  for (let attempt = 0; attempt <= ACCOUNT_LOOKUP_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- deliberate: this is a retry, not a fan-out.
    const { data, error } = await supabase
      .from(SUPABASE_ACCOUNTS_TABLE)
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!error) return { account: data, error: null };
    lastError = error;
    // eslint-disable-next-line no-await-in-loop
    if (attempt < ACCOUNT_LOOKUP_RETRIES) await new Promise((r) => { setTimeout(r, 400 * (attempt + 1)); });
  }
  return { account: null, error: lastError };
}

// Auth state — logic moved verbatim from the original useAuth hook, wrapped in a provider.
export function AuthProvider({ children }) {
  const { setTheme } = useTheme();
  // The account whose stored theme we've already applied — prevents repeat
  // onAuthStateChange events (TOKEN_REFRESHED) from overriding a mid-session toggle.
  const themedForUser = useRef(null);
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
      // A FAILED lookup and "this user has no account row" are NOT the same thing, and
      // collapsing them is a privilege bug. The second legitimately means `staff`; the first
      // means we do not know.
      //
      // This read used to discard its error entirely (`const { data: account } = await ...`)
      // and fall back to `role: "staff"`. On 20 Aug 2026 that let a three-week-old cached
      // bundle on a phone — still asking for the `profiles` table migration 002 dropped —
      // silently downgrade a live admin to staff: no toast, no banner, no Sentry event, just a
      // two-item nav bar, no New button and no FAB, with the database saying `admin` the whole
      // time. A permission level is never something to guess at quietly.
      const { account, error: accountError } = await fetchAccount(session.user.id);
      if (cancelled) return;
      if (account && account.active === false) {
        setUser(null);
        setChecking(false);
        await supabase.auth.signOut();
        toast.error("Account deactivated", { description: "Contact an administrator." });
        return;
      }
      if (accountError) {
        captureAuthFailure({ action: "account-lookup", err: accountError, email: session.user.email });
        toast.error("Couldn't load your account permissions", {
          // Stable id, because applySession runs BOTH from getSession() and from every
          // onAuthStateChange event (INITIAL_SESSION, TOKEN_REFRESHED, ...). Without it this
          // toast stacks a fresh copy per event and, being duration:Infinity, none of them
          // ever leave. Sonner updates the existing toast instead when the id matches.
          id: "account-lookup-failed",
          description: "You may be seeing a limited version of the app. Reload the page — if it keeps happening, tell an admin.",
          duration: Infinity,
        });
      }

      setUser({
        id: session.user.id,
        email: session.user.email,
        name: account?.name || session.user.user_metadata?.name || session.user.email,
        // `staff` ONLY when the lookup succeeded and genuinely returned no row. After an error
        // the role stays null: still non-admin, because a role we could not read must fail
        // closed and never grant privilege — but we are no longer asserting "staff" as though
        // we had read it, and the toast above means the user is not left guessing why the app
        // looks smaller than it did yesterday.
        role: accountError ? null : (account?.role || "staff"),
      });
      // Apply the account's saved theme once per sign-in (persist:false = no echo write).
      if (THEMES.includes(account?.theme) && themedForUser.current !== session.user.id) {
        themedForUser.current = session.user.id;
        setTheme(account.theme, { persist: false });
      }
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

  const loginLocal = useCallback((account) => setUser({ ...account, role: "admin" }), []);
  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(USER_KEY);
    themedForUser.current = null;
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
