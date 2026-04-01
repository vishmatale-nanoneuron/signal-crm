"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE, saveAuth } from "../../lib/api";

function LoginContent() {
  const [mode, setMode]     = useState("login");
  const [form, setForm]     = useState({ name: "", email: "", password: "", company_name: "" });
  const [error, setError]   = useState("");
  const [banner, setBanner] = useState("");
  const [loading, setLoading] = useState(false);
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "expired")      setBanner("Your session expired. Please sign in again.");
    if (reason === "unauthorized") setBanner("You were signed out for security. Please sign in again.");
  }, [searchParams]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register"
        ? { name: form.name, email: form.email, password: form.password, company_name: form.company_name }
        : { email: form.email, password: form.password };
      const res = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.token) {
        saveAuth(data.token, data.user);
        router.push("/dashboard");
      } else {
        setError(data.detail || data.message || "Something went wrong. Try again.");
      }
    } catch {
      setError("Cannot reach server. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)), url('https://assets.nflxext.com/ffe/siteui/vlv3/355a5892-2d75-4c19-8088-b5d7f3e4df89/web/IN-en-20250616-TRIFECTA-perspective_c19d6571-0ffe-4c90-beb9-6f4cb05c7d11_large.jpg') center/cover no-repeat fixed",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{ padding: "24px 56px" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#E50914", letterSpacing: "-0.5px", fontStyle: "italic" }}>
          SIGNAL CRM
        </div>
      </div>

      {/* Session expiry banner */}
      {banner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          background: "rgba(229,9,20,0.92)", color: "#fff",
          padding: "14px 24px", textAlign: "center",
          fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          🔒 {banner}
          <span onClick={() => setBanner("")} style={{ marginLeft: 12, cursor: "pointer", opacity: 0.7 }}>✕</span>
        </div>
      )}

      {/* Form card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", marginTop: banner ? 48 : 0 }}>
        <div style={{
          background: "rgba(0,0,0,0.78)",
          borderRadius: 4,
          padding: "60px 68px 80px",
          width: "100%", maxWidth: 450,
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 28, color: "#fff" }}>
            {mode === "login" ? "Sign In" : "Sign Up"}
          </h1>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} autoComplete="on">
            {mode === "register" && (
              <>
                <input
                  placeholder="Full name"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  autoComplete="name"
                  required
                />
                <input
                  placeholder="Company name (optional)"
                  value={form.company_name}
                  onChange={e => set("company_name", e.target.value)}
                  autoComplete="organization"
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              autoComplete="email"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
            />

            {error && (
              <div style={{
                background: "rgba(229,9,20,0.12)", border: "1px solid rgba(229,9,20,0.5)",
                borderRadius: 4, padding: "12px 14px", color: "#e87c03",
                fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#E50914", color: "#fff", fontSize: 16, fontWeight: 700,
                padding: "16px", borderRadius: 4, border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, marginTop: 8,
                transition: "background 0.15s",
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Start Free Trial →"}
            </button>
          </form>

          {mode === "login" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b3b3b3", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" style={{ width: "auto", padding: 0 }} /> Remember me
              </label>
              <span style={{ color: "#b3b3b3", fontSize: 13, cursor: "pointer" }}>Need help?</span>
            </div>
          )}

          <div style={{ marginTop: 48, color: "#737373", fontSize: 16 }}>
            {mode === "login" ? (
              <>New to Signal CRM?{" "}
                <span onClick={() => { setMode("register"); setError(""); setBanner(""); }}
                  style={{ color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  Sign up now
                </span>
              </>
            ) : (
              <>Already have an account?{" "}
                <span onClick={() => { setMode("login"); setError(""); setBanner(""); }}
                  style={{ color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  Sign in
                </span>
              </>
            )}
          </div>

          {mode === "register" && (
            <div style={{ marginTop: 20, padding: "16px", background: "rgba(70,211,105,0.08)", border: "1px solid rgba(70,211,105,0.2)", borderRadius: 4 }}>
              <div style={{ color: "#46d369", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>14-Day Free Trial</div>
              <div style={{ color: "#b3b3b3", fontSize: 12 }}>No credit card required. Full access to all features. ₹8,000/mo after trial.</div>
            </div>
          )}

          <div style={{ marginTop: 20, fontSize: 12, color: "#8c8c8c", lineHeight: 1.8 }}>
            This page is protected by Signal CRM security. <span style={{ cursor:"pointer", textDecoration:"underline" }}>Learn more.</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "rgba(0,0,0,0.7)", padding: "24px 56px" }}>
        <div style={{ fontSize: 13, color: "#737373", marginBottom: 12 }}>Questions? Email support@nanoneuron.ai</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {["FAQ", "Help Center", "Terms of Use", "Privacy", "Contact Us"].map(l => (
            <span key={l} style={{ fontSize: 12, color: "#737373", cursor: "pointer" }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#141414" }} />}>
      <LoginContent />
    </Suspense>
  );
}
