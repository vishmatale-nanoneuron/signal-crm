"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE, saveAuth, isLoggedIn } from "../../lib/api";

/* ─── Password strength helper ─── */
function getStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8)         score++;
  if (pw.length >= 12)        score++;
  if (/[A-Z]/.test(pw))      score++;
  if (/[0-9]/.test(pw))      score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak",   color: "#ef4444", pct: 25 };
  if (score <= 2) return { label: "Fair",   color: "#f59e0b", pct: 50 };
  if (score <= 3) return { label: "Good",   color: "#3b82f6", pct: 75 };
  return           { label: "Strong", color: "#22c55e", pct: 100 };
}

function LoginContent() {
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ name: "", email: "", password: "", company_name: "" });
  const [showPw, setShowPw]   = useState(false);
  const [focused, setFocused] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner]   = useState("");
  const router                = useRouter();
  const searchParams          = useSearchParams();

  useEffect(() => {
    if (isLoggedIn()) { router.replace("/dashboard"); return; }
    const reason = searchParams.get("reason");
    if (reason === "expired")      setBanner("Your session expired. Please sign in again.");
    if (reason === "unauthorized") setBanner("Signed out for security. Please sign in again.");
    if (reason === "trial_ended")  setBanner("Your 14-day trial ended. Upgrade to keep access.");
    if (searchParams.get("mode") === "register") setMode("register");
  }, [searchParams, router]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(""); }

  function switchMode(m) {
    setMode(m);
    setError("");
    setForm({ name: "", email: "", password: "", company_name: "" });
  }

  async function submit(e) {
    e.preventDefault();
    // Validation
    if (!form.email.trim())                                        { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))           { setError("Enter a valid email address."); return; }
    if (!form.password)                                            { setError("Password is required."); return; }
    if (mode === "register" && !form.name.trim())                  { setError("Your full name is required."); return; }
    if (mode === "register" && form.password.length < 8)           { setError("Password must be at least 8 characters."); return; }

    setLoading(true); setError("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register"
        ? { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, company_name: form.company_name.trim() }
        : { email: form.email.trim().toLowerCase(), password: form.password };

      const res  = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.detail || data.message || "Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      saveAuth(data.token, data.user);

      // Redirect based on trial status
      if (data.trial?.status === "expired") {
        router.push("/dashboard/payment");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Cannot reach server. Check your connection.");
    }
    setLoading(false);
  }

  const strength = (mode === "register" && form.password) ? getStrength(form.password) : null;

  /* ─── Inline styles ─── */
  const inputStyle = (name) => ({
    width: "100%",
    padding: name === "password" ? "11px 44px 11px 14px" : "11px 14px",
    background: "#111",
    border: `1.5px solid ${focused === name ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      padding: "24px 20px",
    }}>

      {/* Session banner */}
      {banner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 999,
          background: "rgba(220,38,38,0.92)", backdropFilter: "blur(8px)",
          color: "#fff", padding: "13px 24px",
          textAlign: "center", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <span>⚠</span> {banner}
          <button onClick={() => setBanner("")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, marginLeft: 8, padding: 0 }}>×</button>
        </div>
      )}

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36, marginTop: banner ? 60 : 0 }}>
        <div style={{
          width: 36, height: 36,
          background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
          borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color: "#fff",
        }}>S</div>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>Signal CRM</span>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#141414",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18,
        padding: "36px 32px 32px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
      }}>

        {/* Mode tabs */}
        <div style={{
          display: "flex", background: "#0a0a0a", borderRadius: 12,
          padding: 4, marginBottom: 28,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {[["login","Sign in"],["register","Create account"]].map(([m, label]) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 9,
              border: "none", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
              background: mode === m ? "#1f1f1f" : "transparent",
              color: mode === m ? "#fff" : "#555",
              boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
            }}>{label}</button>
          ))}
        </div>

        {/* Heading */}
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4, letterSpacing: "-0.3px" }}>
          {mode === "login" ? "Welcome back" : "Start free today"}
        </div>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
          {mode === "login" ? "Sign in to your Signal CRM account" : "14 days free — no credit card required"}
        </div>

        {/* Trial badge */}
        {mode === "register" && (
          <div style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.18)",
            borderRadius: 10, padding: "12px 14px", marginBottom: 20,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>✦</span>
            <div style={{ fontSize: 13, color: "#a5b4fc", lineHeight: 1.65 }}>
              <strong style={{ color: "#c7d2fe" }}>Free 14-day trial</strong> — full access to signals, watchlist, deals, AI actions. Upgrade or cancel after trial.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)",
            borderRadius: 10, padding: "11px 14px",
            color: "#f87171", fontSize: 13, marginBottom: 18,
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={submit} noValidate autoComplete="on">

          {mode === "register" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#bbb", marginBottom: 6 }}>Full name</label>
              <input
                style={inputStyle("name")}
                placeholder="Vishal Matale"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused("")}
                autoComplete="name"
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#bbb", marginBottom: 6 }}>Email address</label>
            <input
              type="email"
              style={inputStyle("email")}
              placeholder="you@company.com"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused("")}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: mode === "register" ? 14 : 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#bbb" }}>Password</label>
              {mode === "login" && (
                <span style={{ fontSize: 12, color: "#6366f1", cursor: "pointer", fontWeight: 500 }}>Forgot password?</span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                style={inputStyle("password")}
                placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused("")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{
                  position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#555", fontSize: 15, padding: 0, lineHeight: 1,
                }}
              >{showPw ? "🙈" : "👁"}</button>
            </div>
            {/* Strength bar */}
            {strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: `${strength.pct}%`, background: strength.color, borderRadius: 99, transition: "width 0.3s, background 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 4 }}>{strength.label} password</div>
              </div>
            )}
          </div>

          {mode === "register" && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#bbb", marginBottom: 6 }}>
                Company name <span style={{ color: "#444", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                style={inputStyle("company")}
                placeholder="Nanoneuron Services"
                value={form.company_name}
                onChange={e => set("company_name", e.target.value)}
                onFocus={() => setFocused("company")}
                onBlur={() => setFocused("")}
                autoComplete="organization"
              />
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#4547a8" : "#6366f1",
              color: "#fff", fontSize: 15, fontWeight: 600,
              border: "none", borderRadius: 10,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              fontFamily: "inherit",
              letterSpacing: "-0.1px",
            }}
          >
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign in" : "Create free account →")}
          </button>
        </form>

        {/* Switch mode */}
        <div style={{ fontSize: 13, color: "#555", marginTop: 22, textAlign: "center", lineHeight: 1.8 }}>
          {mode === "login" ? (
            <>Don't have an account?{" "}
              <span onClick={() => switchMode("register")} style={{ color: "#6366f1", cursor: "pointer", fontWeight: 500 }}>Sign up free</span>
            </>
          ) : (
            <>Already have an account?{" "}
              <span onClick={() => switchMode("login")} style={{ color: "#6366f1", cursor: "pointer", fontWeight: 500 }}>Sign in</span>
            </>
          )}
          <br />
          <span style={{ fontSize: 11, color: "#333" }}>
            By continuing, you agree to our{" "}
            <span style={{ color: "#444", cursor: "pointer", textDecoration: "underline" }}>Terms</span>
            {" "}and{" "}
            <span style={{ color: "#444", cursor: "pointer", textDecoration: "underline" }}>Privacy Policy</span>
          </span>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{ display: "flex", gap: 28, marginTop: 32, flexWrap: "wrap", justifyContent: "center" }}>
        {["🔒 Bank-grade security", "🌍 195 countries", "⚡ Live in 60 seconds", "🇮🇳 Razorpay + SWIFT"].map(t => (
          <span key={t} style={{ fontSize: 12, color: "#333" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }} />}>
      <LoginContent />
    </Suspense>
  );
}
