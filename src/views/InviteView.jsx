import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { BrandMark } from "../components/layout/Sidebar";
import { Button, Field, Input, cx } from "../components/ui/primitives";

// Landing page for a Supabase invite link. The link establishes a session (supabase-js parses
// the tokens from the URL hash on load); the invited person only sets a password here — the
// invite already verified their email, so there is no separate verification step.
export function InviteView() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setStatus("invalid"); return; }
    let cancelled = false;
    // The invite session may still be resolving from the URL hash on first paint, so accept it
    // via either getSession() or the auth-state event, whichever lands first.
    const settle = (session) => {
      if (cancelled || !session?.user) return;
      setEmail(session.user.email || "");
      setStatus("ready");
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) settle(data.session);
      else if (!cancelled) {
        // Give the hash-detection a beat before declaring the link invalid.
        setTimeout(() => { if (!cancelled) setStatus((s) => (s === "checking" ? "invalid" : s)); }, 1500);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => settle(session));
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (status === "ready") firstFieldRef.current?.focus(); }, [status]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      // Flip the profile to onboarded (scoped RPC — profiles UPDATE is otherwise admin-only).
      await supabase.rpc("complete_onboarding");
      toast.success("Account ready — welcome to Flexachem.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Could not set your password. The invite link may have expired.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(circle_at_20%_0%,rgb(242_106_33/0.22),transparent_28%),linear-gradient(135deg,#06172d,#0b2d55)] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[1.8rem] bg-[var(--surface-card)] shadow-[var(--shadow-float)]">
        <div className="bg-[linear-gradient(135deg,rgb(7_27_51/0.96),rgb(18_61_112/0.96))] p-8 text-white">
          <BrandMark />
          <div className="mt-1 text-[0.72rem] text-[#b7c8dc]">Workshop Control Tower</div>
        </div>
        <div className="grid gap-4 p-8">
          {status === "checking" && (
            <div className="flex items-center gap-2 text-[0.85rem] text-[var(--ink-muted)]">
              <Loader2 size={16} className="animate-spin" />Verifying your invitation…
            </div>
          )}

          {status === "invalid" && (
            <div className="grid gap-3">
              <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Invitation link invalid or expired</h2>
              <p className="text-[0.82rem] text-[var(--ink-muted)]">Ask an administrator to send a fresh invitation, then open the link from that email.</p>
              <Button variant="primary" className="gap-1.5" onClick={() => navigate("/login", { replace: true })}>Go to sign in<ArrowRight size={16} /></Button>
            </div>
          )}

          {status === "ready" && (
            <form className="grid gap-4" onSubmit={submit}>
              <div>
                <div className="inline-flex items-center gap-1 rounded-full bg-[var(--status-done-bg)] px-2.5 py-1 text-[0.66rem] font-bold text-[var(--status-done)]"><ShieldCheck size={12} />Email verified</div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)]">Set your password</h2>
                <p className="mt-1 text-[0.8rem] text-[var(--ink-muted)]">Finish setting up{email ? ` ${email}` : " your account"} — just choose a password.</p>
              </div>
              <Field label="New password">
                <div className="relative">
                  <Input ref={firstFieldRef} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={busy} autoComplete="new-password" className="pr-11" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm password">
                <Input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} disabled={busy} autoComplete="new-password" />
              </Field>
              {error && (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-bg)] px-3 py-2 text-[0.8rem] text-[var(--danger)]">{error}</div>
              )}
              <Button type="submit" variant="primary" disabled={busy} className="gap-1.5">{busy ? <><Loader2 size={16} className="animate-spin" />Setting up…</> : <>Create account<ArrowRight size={16} /></>}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
