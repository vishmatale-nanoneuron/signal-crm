"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, saveAuth } from "../../lib/api";

const FEATURES = [
  { icon: "⚡", text: "Web change signals — hiring spikes, new country pages, pricing shifts" },
  { icon: "🗺", text: "Buyer map — right titles to target in 30+ countries" },
  { icon: "🛡", text: "Compliance checker — GDPR, CASL, PDPA before every outreach" },
  { icon: "🎯", text: "Next best action engine — AI-ranked sales actions from live signals" },
];

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({ name: "", email: "", password: "", company_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const router = useRouter();

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
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
        if (mode === "register") {
          setSuccess(`Welcome, ${data.user.name}! Starting your 14-day free trial…`);
          setTimeout(() => router.push("/dashboard"), 1200);
        } else {
          router.push("/dashboard");
        }
      } else {
        setError(data.detail || data.message || "Something went wrong. Try again.");
      }
    } catch {
      setError("Cannot reach server. Check your connection.");
    }
    setLoading(false);
  }

  const inp = {
    width: "100%", marginBottom: 12, background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    padding: "11px 14px", color: "#E6EDF3", fontSize: 14, outline: "none",
  };
  const btn = {
    width: "100%", padding: "13px", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer",
    fontSize: 14, fontWeight: 700, letterSpacing: "0.02em",
    background: "linear-gradient(135deg, #00D9FF, #A855F7)",
    color: "#06080D", opacity: loading ? 0.6 : 1, transition: "opacity 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#060810" }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 64px", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#00D9FF,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#06080D" }}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Signal CRM</div>
            <div style={{ fontSize: 11, color: "rgba(230,237,243,0.4)", marginTop: 1 }}>by Nanoneuron</div>
          </div>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>
          Turn web signals<br />
          <span style={{ background: "linear-gradient(135deg,#00D9FF,#A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            into closed deals.
          </span>
        </h1>
        <p style={{ color: "rgba(230,237,243,0.55)", fontSize: 15, marginBottom: 40, lineHeight: 1.7 }}>
          The privacy-aware CRM that monitors target companies for web changes — and tells you exactly what to do next.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(0,217,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{f.icon}</div>
              <div style={{ color: "rgba(230,237,243,0.7)", fontSize: 13.5, paddingTop: 8 }}>{f.text}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: "18px 20px", background: "rgba(0,217,255,0.06)", borderRadius: 10, border: "1px solid rgba(0,217,255,0.15)" }}>
          <div style={{ fontSize: 12, color: "rgba(230,237,243,0.5)", marginBottom: 4 }}>14-day free trial</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>₹8,000/mo after trial · Cancel anytime</div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ width: 460, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 48px" }}>
        <div style={{ width: "100%" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
            {mode === "register" ? "Start free trial" : "Welcome back"}
          </h2>
          <p style={{ color: "rgba(230,237,243,0.45)", fontSize: 13, marginBottom: 28 }}>
            {mode === "register" ? "14 days free. No credit card required." : "Sign in to your Signal CRM account."}
          </p>

          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <input style={inp} placeholder="Your full name" value={form.name} onChange={e => set("name", e.target.value)} required />
                <input style={inp} placeholder="Company name (optional)" value={form.company_name} onChange={e => set("company_name", e.target.value)} />
              </>
            )}
            <input style={inp} type="email" placeholder="Work email" value={form.email} onChange={e => set("email", e.target.value)} required />
            <input style={{ ...inp, marginBottom: 20 }} type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={e => set("password", e.target.value)} required minLength={8} />

            {error && <div style={{ background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.25)", borderRadius: 8, padding: "10px 14px", color: "#F85149", fontSize: 13, marginBottom: 16 }}>{error}</div>}
            {success && <div style={{ background: "rgba(63,185,80,0.1)", border: "1px solid rgba(63,185,80,0.25)", borderRadius: 8, padding: "10px 14px", color: "#3FB950", fontSize: 13, marginBottom: 16 }}>{success}</div>}

            <button type="submit" style={btn} disabled={loading}>
              {loading ? "Please wait…" : mode === "register" ? "Start 14-Day Free Trial →" : "Sign In →"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "rgba(230,237,243,0.4)" }}>
            {mode === "register" ? "Already have an account? " : "Need an account? "}
            <span
              onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setSuccess(""); }}
              style={{ color: "#00D9FF", cursor: "pointer", fontWeight: 600 }}
            >
              {mode === "register" ? "Sign in" : "Start free trial"}
            </span>
          </div>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 11, color: "rgba(230,237,243,0.3)", textAlign: "center" }}>
            By signing up you agree to our Terms of Service and Privacy Policy.
            <br />Questions? Email <span style={{ color: "#00D9FF" }}>support@nanoneuron.ai</span>
          </div>
        </div>
      </div>
    </div>
  );
}
