"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "../lib/api";

const FEATURES = [
  { icon: "📡", title: "Live Signal Feed", desc: "Hiring spikes, new country pages, pricing changes — detected the moment they happen." },
  { icon: "🎯", title: "AI Action Plan", desc: "Every signal gets a ranked action: who to call, what to say, and why it matters today." },
  { icon: "🗺️", title: "Global Buyer Map", desc: "195 countries, 50+ industries. Find the right buyer before your competitor does." },
  { icon: "⚖️", title: "Compliance Engine", desc: "44 frameworks, instant country compliance checks. Never get blocked by regulation again." },
  { icon: "💼", title: "Deal Pipeline", desc: "Signal-to-close pipeline. Track every deal triggered by a competitor move." },
  { icon: "📧", title: "Daily Digest Email", desc: "6 AM every morning — top 5 signals + your action plan delivered to your inbox." },
];

const SIGNALS = [
  { company: "Freshworks", type: "hiring_spike", text: "45 new enterprise sales roles in DACH — 3× spike", strength: "HIGH", country: "🇩🇪" },
  { company: "Razorpay", type: "new_country_page", text: "Launched /malaysia with FPX + GrabPay content", strength: "HIGH", country: "🇲🇾" },
  { company: "Deel", type: "pricing_change", text: "India EOR pricing raised 18% — ₹499 → ₹589/mo", strength: "HIGH", country: "🇮🇳" },
  { company: "Stripe", type: "compliance_update", text: "KYC: PAN + GSTIN now mandatory for all merchants", strength: "MED", country: "🇮🇳" },
  { company: "Shopify", type: "hiring_spike", text: "20 partnership roles across Singapore + Indonesia", strength: "MED", country: "🇸🇬" },
];

const PLANS = [
  { name: "Starter", price: "₹4,999", period: "/mo", features: ["50 signal credits", "5 watchlist companies", "Buyer map", "Compliance checker", "Deal pipeline", "Email support"], cta: "Start free trial" },
  { name: "Pro", price: "₹8,000", period: "/mo", popular: true, features: ["Unlimited signals", "25 watchlist companies", "AI action engine", "Full buyer map", "40+ compliance frameworks", "Priority support", "5 team members"], cta: "Start free trial" },
  { name: "Enterprise", price: "₹19,999", period: "/mo", features: ["Everything in Pro", "Unlimited watchlist", "Custom signals", "Dedicated manager", "API access", "White-label reports", "Custom onboarding + SLA 99.9%"], cta: "Start free trial" },
];

export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) { router.replace("/dashboard"); return; }
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, [router]);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", background: "#0a0a0a", color: "#fff", overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 64,
        background: scrolled ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        transition: "all 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sg_lp" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF"/>
                <stop offset="60%" stopColor="#7C3AED"/>
                <stop offset="100%" stopColor="#A855F7"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="7" fill="#06080D"/>
            <ellipse cx="16" cy="16" rx="11" ry="3.2" fill="none" stroke="#00F0FF" strokeWidth="0.7" opacity="0.2" transform="rotate(-25 16 16)"/>
            <ellipse cx="16" cy="16" rx="11" ry="3.2" fill="none" stroke="#A855F7" strokeWidth="0.7" opacity="0.2" transform="rotate(25 16 16)"/>
            <rect x="8.5" y="8" width="15" height="3.2" rx="1.5" fill="url(#sg_lp)"/>
            <rect x="8.5" y="8" width="3.2" height="8.5" rx="1.5" fill="url(#sg_lp)"/>
            <rect x="8.5" y="14.4" width="15" height="3.2" rx="1.5" fill="url(#sg_lp)"/>
            <rect x="20.3" y="14.4" width="3.2" height="8.5" rx="1.5" fill="url(#sg_lp)"/>
            <rect x="8.5" y="20.8" width="15" height="3.2" rx="1.5" fill="url(#sg_lp)"/>
            <circle cx="4.5" cy="11" r="1.3" fill="#00F0FF" opacity="0.7"/>
            <circle cx="27.5" cy="21" r="1.3" fill="#A855F7" opacity="0.7"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>
            <span style={{ color: "#fff" }}>Signal</span>
            {" "}
            <span style={{ background: "linear-gradient(135deg,#00F0FF,#A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CRM</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => router.push("/login")} style={{ padding: "8px 18px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#ccc", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Sign in</button>
          <button onClick={() => router.push("/login?mode=register")} style={{ padding: "8px 18px", background: "#6366f1", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Start free →</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "100px 24px 80px", textAlign: "center",
        position: "relative",
      }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse,rgba(99,102,241,0.15) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: 99, padding: "6px 16px", marginBottom: 32, fontSize: 13, color: "#a5b4fc",
        }}>
          <span style={{ width: 6, height: 6, background: "#6366f1", borderRadius: "50%", display: "inline-block" }} />
          AI-powered B2B sales intelligence
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(38px,7vw,80px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-2px", marginBottom: 24, maxWidth: 900 }}>
          Know what your{" "}
          <span style={{ background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            competitors
          </span>{" "}
          are doing before your clients do
        </h1>

        <p style={{ fontSize: 20, color: "#888", lineHeight: 1.6, maxWidth: 560, marginBottom: 40 }}>
          Signal CRM monitors competitor web changes — hiring spikes, new markets, pricing moves — and turns them into sales actions. Built for Indian B2B teams going global.
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
          <button
            onClick={() => router.push("/login?mode=register")}
            style={{ padding: "15px 32px", background: "#6366f1", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.2px" }}
          >
            Start 14-day free trial →
          </button>
          <button
            onClick={() => router.push("/login")}
            style={{ padding: "15px 28px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#ccc", fontSize: 16, cursor: "pointer", fontFamily: "inherit" }}
          >
            Sign in
          </button>
        </div>
        <div style={{ fontSize: 13, color: "#444" }}>No credit card required · Cancel anytime · 195 countries</div>
      </section>

      {/* ── Live Signal Preview ── */}
      <section style={{ padding: "80px 24px", background: "#0d0d0d" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, background: "#6366f1", borderRadius: "50%", animation: "pulse 2s infinite", display: "inline-block" }} />
              LIVE SIGNALS RIGHT NOW
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 12 }}>See what's happening across your market</h2>
            <p style={{ color: "#666", fontSize: 16 }}>Real signals detected in the last 24 hours</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {SIGNALS.map((s, i) => (
              <div key={i} style={{
                background: "#141414", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 12, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <span style={{ fontSize: 20 }}>{s.country}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{s.company}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                      padding: "2px 8px", borderRadius: 99,
                      background: s.strength === "HIGH" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                      color: s.strength === "HIGH" ? "#f87171" : "#fbbf24",
                    }}>{s.strength}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#888" }}>{s.text}</div>
                </div>
                <div style={{ fontSize: 11, color: "#444", whiteSpace: "nowrap" }}>
                  {s.type.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={() => router.push("/login?mode=register")} style={{ padding: "12px 28px", background: "transparent", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 10, color: "#a5b4fc", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              See all signals in your dashboard →
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 12 }}>Everything your sales team needs</h2>
            <p style={{ color: "#666", fontSize: 16 }}>One platform for intelligence, action, and revenue</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 2 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ padding: "28px 24px", background: "#111", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: "#666", lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: "80px 24px", background: "#0d0d0d" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 12 }}>Simple, honest pricing</h2>
            <p style={{ color: "#666", fontSize: 16 }}>Start free for 14 days. Upgrade when you're ready.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 2, alignItems: "start" }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{
                background: p.popular ? "#1a1a2e" : "#111",
                border: p.popular ? "1.5px solid #6366f1" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16, padding: "28px 24px",
                position: "relative",
              }}>
                {p.popular && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "4px 16px", borderRadius: 99, letterSpacing: "0.06em",
                  }}>MOST POPULAR</div>
                )}
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1px" }}>{p.price}</span>
                  <span style={{ color: "#555", fontSize: 14 }}>{p.period}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, fontSize: 14, color: "#aaa" }}>
                      <span style={{ color: "#6366f1", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push("/login?mode=register")}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, border: "none",
                    background: p.popular ? "#6366f1" : "rgba(255,255,255,0.06)",
                    color: p.popular ? "#fff" : "#aaa",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >{p.cta}</button>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "#444" }}>
            🌍 Pay via Razorpay (India) · SWIFT · NEFT · UPI · International cards &nbsp;·&nbsp; Cancel anytime
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: "60px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 2, textAlign: "center" }}>
          {[
            { stat: "195+", label: "Countries monitored" },
            { stat: "44", label: "Compliance frameworks" },
            { stat: "24/7", label: "Signal detection" },
            { stat: "14 days", label: "Free trial" },
          ].map(({ stat, label }) => (
            <div key={label} style={{ padding: "28px 20px", background: "#111", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14 }}>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.8px", color: "#6366f1", marginBottom: 6 }}>{stat}</div>
              <div style={{ fontSize: 13, color: "#555" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 16 }}>
            Start closing deals with intelligence
          </h2>
          <p style={{ color: "#666", fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>
            Join B2B teams using Signal CRM to find the right buyers at the right moment — before their competitors.
          </p>
          <button
            onClick={() => router.push("/login?mode=register")}
            style={{ padding: "16px 40px", background: "#6366f1", border: "none", borderRadius: 12, color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Start free 14-day trial →
          </button>
          <div style={{ marginTop: 16, fontSize: 13, color: "#444" }}>No credit card · No commitment · Full access</div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>S</div>
          <span style={{ fontSize: 14, color: "#555" }}>Signal CRM by Nanoneuron Services</span>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {["Terms", "Privacy", "Support", "sales@nanoneuron.ai"].map(l => (
            <span key={l} style={{ fontSize: 13, color: "#444", cursor: "pointer" }}>{l}</span>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }
        input { font-family: inherit; }
      `}</style>
    </div>
  );
}
