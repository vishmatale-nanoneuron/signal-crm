"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = "https://signal-crm-api-production.up.railway.app";

function saveAuth(token, user) {
  try {
    localStorage.setItem("sig_token", token);
    localStorage.setItem("sig_user", JSON.stringify(user));
  } catch (_) {}
}

function isLoggedIn() {
  try {
    const t = localStorage.getItem("sig_token");
    if (!t) return false;
    const payload = JSON.parse(atob(t.split(".")[1]));
    return payload.exp > Date.now() / 1000;
  } catch (_) { return false; }
}

/* ── Password strength ── */
function strength(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { label: "Weak", color: "#ef4444", pct: 20 };
  if (s <= 2) return { label: "Fair", color: "#f59e0b", pct: 50 };
  if (s <= 3) return { label: "Good", color: "#3b82f6", pct: 75 };
  return { label: "Strong", color: "#22c55e", pct: 100 };
}

function Page() {
  const [tab, setTab]       = useState("login");   // "login" | "register"
  const [name, setName]     = useState("");
  const [company, setComp]  = useState("");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr]       = useState("");
  const [busy, setBusy]     = useState(false);
  const [banner, setBanner] = useState("");
  const router = useRouter();
  const sp     = useSearchParams();

  useEffect(() => {
    if (isLoggedIn()) { router.replace("/dashboard"); return; }
    const r = sp.get("reason");
    if (r === "expired")      setBanner("Your session expired. Please sign in again.");
    if (r === "trial_ended")  setBanner("Your trial ended. Please upgrade to continue.");
    if (r === "unauthorized") setBanner("Signed out. Please sign in again.");
    if (sp.get("mode") === "register") setTab("register");
  }, []);  // eslint-disable-line

  function reset() { setErr(""); setName(""); setComp(""); setEmail(""); setPass(""); }
  function switchTab(t) { reset(); setTab(t); }

  async function submit(e) {
    e.preventDefault();
    setErr("");

    // Validate
    if (!email.trim())                         return setErr("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email.");
    if (!pass)                                 return setErr("Password is required.");
    if (tab === "register" && !name.trim())    return setErr("Full name is required.");
    if (tab === "register" && pass.length < 8) return setErr("Password must be at least 8 characters.");

    setBusy(true);
    try {
      const url  = API + (tab === "register" ? "/api/auth/register" : "/api/auth/login");
      const body = tab === "register"
        ? { name: name.trim(), email: email.trim().toLowerCase(), password: pass, company_name: company.trim() }
        : { email: email.trim().toLowerCase(), password: pass };

      const res  = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setErr(data.detail || data.message || "Something went wrong. Try again.");
        setBusy(false);
        return;
      }

      saveAuth(data.token, data.user);
      router.push(data.trial?.status === "expired" ? "/dashboard/payment" : "/dashboard");
    } catch (_) {
      setErr("Cannot connect to server. Check your internet connection.");
      setBusy(false);
    }
  }

  const sw = tab === "register" ? strength(pass) : null;

  /* ── Styles ── */
  const inp = (focus) => ({
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px", borderRadius: 10,
    background: "#0d0d0d",
    border: `1.5px solid ${focus ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
    color: "#fff", fontSize: 15, outline: "none", fontFamily: "inherit",
    transition: "border-color 0.15s",
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "ui-sans-serif,system-ui,-apple-system,sans-serif",
      padding: "20px",
    }}>

      {/* Banner */}
      {banner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99,
          background: "rgba(220,38,38,0.95)", backdropFilter: "blur(8px)",
          color: "#fff", padding: "12px 20px", textAlign: "center",
          fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          ⚠ {banner}
          <button onClick={() => setBanner("")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
        </div>
      )}

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, marginTop: banner ? 56 : 0 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sg_login" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F0FF"/>
              <stop offset="60%" stopColor="#7C3AED"/>
              <stop offset="100%" stopColor="#A855F7"/>
            </linearGradient>
          </defs>
          <rect width="36" height="36" rx="9" fill="#06080D"/>
          <ellipse cx="18" cy="18" rx="12.5" ry="3.5" fill="none" stroke="#00F0FF" strokeWidth="0.8" opacity="0.2" transform="rotate(-25 18 18)"/>
          <ellipse cx="18" cy="18" rx="12.5" ry="3.5" fill="none" stroke="#A855F7" strokeWidth="0.8" opacity="0.2" transform="rotate(25 18 18)"/>
          <rect x="9.5" y="9" width="17" height="3.6" rx="1.8" fill="url(#sg_login)"/>
          <rect x="9.5" y="9" width="3.6" height="9.5" rx="1.8" fill="url(#sg_login)"/>
          <rect x="9.5" y="16.2" width="17" height="3.6" rx="1.8" fill="url(#sg_login)"/>
          <rect x="22.9" y="16.2" width="3.6" height="9.5" rx="1.8" fill="url(#sg_login)"/>
          <rect x="9.5" y="23.4" width="17" height="3.6" rx="1.8" fill="url(#sg_login)"/>
          <circle cx="5" cy="12" r="1.5" fill="#00F0FF" opacity="0.7"/>
          <circle cx="31" cy="24" r="1.5" fill="#A855F7" opacity="0.7"/>
          <circle cx="24" cy="9" r="1" fill="#FFD700" opacity="0.6"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px" }}>
          <span style={{ color: "#fff" }}>Signal</span>
          {" "}
          <span style={{ background: "linear-gradient(135deg,#00F0FF,#A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CRM</span>
        </span>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#141414",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18, padding: "32px 28px",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#0a0a0a", borderRadius: 11, padding: 4, marginBottom: 26, border: "1px solid rgba(255,255,255,0.06)" }}>
          {[["login","Sign in"],["register","Create account"]].map(([t, lbl]) => (
            <button key={t} onClick={() => switchTab(t)} style={{
              flex: 1, padding: "9px", borderRadius: 8, border: "none",
              fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              background: tab === t ? "#1f1f1f" : "transparent",
              color:      tab === t ? "#fff"    : "#555",
              boxShadow:  tab === t ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
              transition: "all 0.15s",
            }}>{lbl}</button>
          ))}
        </div>

        {/* Heading */}
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4, letterSpacing: "-0.3px" }}>
          {tab === "login" ? "Welcome back" : "Start free today"}
        </div>
        <div style={{ fontSize: 14, color: "#555", marginBottom: 22 }}>
          {tab === "login" ? "Sign in to Signal CRM" : "14-day free trial — no credit card needed"}
        </div>

        {/* Trial info box */}
        {tab === "register" && (
          <div style={{
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10, padding: "11px 14px", marginBottom: 18,
            fontSize: 13, color: "#a5b4fc", lineHeight: 1.6,
          }}>
            ✦ <strong style={{ color: "#c7d2fe" }}>Free 14-day trial</strong> — full access to all features. Upgrade after trial or cancel anytime.
          </div>
        )}

        {/* Error */}
        {err && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            color: "#f87171", fontSize: 13, display: "flex", gap: 8,
          }}>
            <span style={{ flexShrink: 0 }}>⚠</span> {err}
          </div>
        )}

        {/* Form */}
        <form onSubmit={submit} noValidate>

          {tab === "register" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#aaa", marginBottom: 6 }}>Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Vishal Matale"
                style={inp(false)} autoComplete="name" />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#aaa", marginBottom: 6 }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
              style={inp(false)} autoComplete="email" />
          </div>

          <div style={{ marginBottom: tab === "register" ? 14 : 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#aaa" }}>Password</label>
              {tab === "login" && <span style={{ fontSize: 12, color: "#6366f1", cursor: "pointer" }}>Forgot password?</span>}
            </div>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)}
                placeholder={tab === "register" ? "Min. 8 characters" : "Your password"}
                style={{ ...inp(false), paddingRight: 44 }}
                autoComplete={tab === "login" ? "current-password" : "new-password"} />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{
                position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 14, padding: 0,
              }}>{showPw ? "🙈" : "👁"}</button>
            </div>
            {sw && (
              <div style={{ marginTop: 7 }}>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: sw.pct + "%", background: sw.color, borderRadius: 99, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, color: sw.color, marginTop: 4 }}>{sw.label} password</div>
              </div>
            )}
          </div>

          {tab === "register" && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#aaa", marginBottom: 6 }}>
                Company <span style={{ color: "#444", fontWeight: 400 }}>(optional)</span>
              </label>
              <input value={company} onChange={e => setComp(e.target.value)} placeholder="Nanoneuron Services"
                style={inp(false)} autoComplete="organization" />
            </div>
          )}

          <button type="submit" disabled={busy} style={{
            width: "100%", padding: "13px", borderRadius: 10, border: "none",
            background: busy ? "#4547a8" : "#6366f1",
            color: "#fff", fontSize: 15, fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
            transition: "background 0.15s",
          }}>
            {busy
              ? (tab === "login" ? "Signing in…" : "Creating account…")
              : (tab === "login" ? "Sign in" : "Create free account →")}
          </button>
        </form>

        {/* Switch */}
        <div style={{ marginTop: 20, fontSize: 13, color: "#555", textAlign: "center", lineHeight: 1.9 }}>
          {tab === "login"
            ? <>Don't have an account? <span onClick={() => switchTab("register")} style={{ color: "#6366f1", cursor: "pointer", fontWeight: 500 }}>Sign up free</span></>
            : <>Already have an account? <span onClick={() => switchTab("login")} style={{ color: "#6366f1", cursor: "pointer", fontWeight: 500 }}>Sign in</span></>}
          <br />
          <span style={{ fontSize: 11, color: "#333" }}>By continuing you agree to our Terms &amp; Privacy Policy</span>
        </div>
      </div>

      {/* Trust row */}
      <div style={{ display: "flex", gap: 24, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
        {["🔒 Bank-grade security", "🌍 195 countries", "🇮🇳 Razorpay + SWIFT", "⚡ Live in 60s"].map(t => (
          <span key={t} style={{ fontSize: 12, color: "#333" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }} />}>
      <Page />
    </Suspense>
  );
}
