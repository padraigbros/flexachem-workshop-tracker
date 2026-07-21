import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthCtx } from "../state/AuthProvider";
import { BrandMark } from "../components/layout/Sidebar";
import { Button, Field, Input, cx } from "../components/ui/primitives";

// Turn raw Supabase auth errors into something a workshop user can act on.
function friendlyAuthError(err) {
  const msg = err?.message || String(err || "");
  if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(msg)) return "Check your inbox and confirm your email first, then sign in.";
  if (/user already registered/i.test(msg)) return "An account with this email already exists — try signing in.";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts. Wait a moment and try again.";
  if (/password should be at least/i.test(msg)) return "Password must be at least 8 characters.";
  return msg;
}

export function LoginView() {
  const { loginLocal, cloud } = useAuthCtx();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [localName, setLocalName] = useState("Workshop Lead");
  const [localEmail, setLocalEmail] = useState("workshop@flexachem.com");
  const firstFieldRef = useRef(null);

  // Focus the natural first field whenever the mode flips.
  useEffect(() => { firstFieldRef.current?.focus(); }, [mode]);

  const submit = async (e) => {
    e.preventDefault();
    if (!cloud) {
      loginLocal({ email: localEmail.trim() || "workshop@flexachem.com", name: localName.trim() || "Workshop Lead" });
      return;
    }
    setBusy(true); setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) {
          setMode("signin");
          setPassword("");
          setMessage({ tone: "info", text: "Account created. Check your email to confirm, then sign in below." });
        }
      }
    } catch (err) {
      setMessage({ tone: "error", text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) { setMessage({ tone: "error", text: "Enter your email above first, then press Forgot password." }); return; }
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) throw error;
      setMessage({ tone: "info", text: "Password reset link sent — check your email." });
    } catch (err) {
      setMessage({ tone: "error", text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(circle_at_20%_0%,rgb(242_106_33/0.22),transparent_28%),linear-gradient(135deg,#06172d,#0b2d55)] p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[1.8rem] shadow-[var(--shadow-float)] md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,rgb(7_27_51/0.96),rgb(18_61_112/0.96))] p-8 text-white sm:p-10">
          <motion.div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[rgb(242_106_33/0.35)] blur-2xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.85, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative grid gap-2.5">
            <BrandMark />
            <div className="text-[0.72rem] text-[#b7c8dc]">Workshop Control Tower</div>
          </div>
          <h1 className="relative mt-8 text-3xl font-black leading-[0.95] tracking-tight sm:text-4xl">Service jobs, dates and blockers in one premium dashboard.</h1>
          <p className="relative mt-4 max-w-md text-[0.9rem] leading-relaxed text-[#cadaec]">Built for the real workshop: a three-hour job can sit open for days while parts, customers, testing slots and service updates move around it.</p>
          <div className="relative mt-8 grid grid-cols-3 gap-2.5">
            {[["3", "core statuses"], ["BU", "business unit views"], ["Live", "workshop notes"]].map(([big, small]) => (
              <div key={small} className="rounded-2xl border border-white/15 bg-white/10 p-3.5">
                <strong className="block text-xl font-extrabold">{big}</strong>
                <span className="text-[0.68rem] text-[#b7c8dc]">{small}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid content-center gap-4 bg-[var(--surface-card)] p-8 sm:p-10">
          {cloud ? (
            <form className="grid gap-4" onSubmit={submit}>
              <div>
                <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-[var(--color-brand-500)]">Secure workshop entry</div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)]">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
                <p className="mt-1 text-[0.8rem] text-[var(--ink-muted)]">{mode === "signin" ? "Use your workshop email and password." : "New accounts start with staff access — an admin can upgrade you."}</p>
              </div>
              <div className="flex gap-1.5">
                {["signin", "signup"].map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} disabled={busy} onClick={() => { setMode(m); setMessage(null); }} className={cx("flex-1 rounded-lg border py-2 text-[0.82rem] font-semibold transition-colors disabled:opacity-60", mode === m ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)] text-white shadow-[0_8px_20px_rgb(242_106_33/0.25)]" : "border-[var(--line-strong)] bg-[var(--surface-card)] text-[var(--ink-muted)] hover:border-[var(--color-brand-500)]")}>
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>
              {mode === "signup" && <Field label="Your name"><Input ref={firstFieldRef} value={name} onChange={(e) => setName(e.target.value)} required disabled={busy} placeholder="Full name" /></Field>}
              <Field label="Email"><Input ref={mode === "signup" ? undefined : firstFieldRef} type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></Field>
              <Field label="Password">
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={busy} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="pr-11" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
              {message && (
                <div className={cx("rounded-lg border px-3 py-2 text-[0.8rem]", message.tone === "error" ? "border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-bg)] text-[var(--danger)]" : "border-[color-mix(in_srgb,var(--status-active)_30%,transparent)] bg-[var(--status-active-bg)] text-[var(--status-active)]")}>{message.text}</div>
              )}
              <Button type="submit" variant="primary" disabled={busy} className="gap-1.5">{busy ? <><Loader2 size={16} className="animate-spin" />Working…</> : <>{mode === "signin" ? "Sign in" : "Create account"}<ArrowRight size={16} /></>}</Button>
              {mode === "signin" && <button type="button" className="justify-self-start text-[0.8rem] text-[var(--status-active)] underline disabled:opacity-60" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={submit}>
              <div>
                <div className="inline-flex rounded-full bg-[var(--status-blocked-bg)] px-2.5 py-1 text-[0.66rem] font-bold text-[var(--status-blocked)]">Demo mode — data stays in this browser</div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)]">Continue to the dashboard</h2>
                <p className="mt-1 text-[0.8rem] text-[var(--ink-muted)]">No Supabase configured — you get full admin access locally.</p>
              </div>
              <Field label="Your name"><Input value={localName} onChange={(e) => setLocalName(e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={localEmail} onChange={(e) => setLocalEmail(e.target.value)} /></Field>
              <Button type="submit" variant="primary" className="gap-1.5">Enter workshop dashboard<ArrowRight size={16} /></Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
