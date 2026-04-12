"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "../lib/api";

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#00F0FF" strokeWidth="1.5"/><path d="M12 6v6l4 2" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round"/></svg>
    ),
    title: "Real-Time Signal Detection",
    desc: "Hiring spikes, new country pages, pricing changes — detected within minutes of happening, not days.",
    color: "#00F0FF",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
    title: "AI-Powered Action Engine",
    desc: "Claude AI ranks every signal and tells you exactly who to call, what to say, and why it matters today.",
    color: "#7C3AED",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
    title: "Compliance Engine",
    desc: "44 frameworks, 195 countries. Know your legal obligations before you send a single cold email.",
    color: "#22c55e",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" stroke="#f59e0b" strokeWidth="1.5"/><path d="M8 21h8M12 17v4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/></svg>
    ),
    title: "Deal Pipeline",
    desc: "Signal-to-close pipeline with kanban and list views. Never lose a deal in the noise again.",
    color: "#f59e0b",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#a855f7" strokeWidth="1.5"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/></svg>
    ),
    title: "Contacts & Accounts",
    desc: "Full CRM with AI lead scoring, activity timelines, and bulk CSV import. Your entire rolodex, intelligent.",
    color: "#a855f7",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#ef4444" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" stroke="#ef4444" strokeWidth="1.5"/></svg>
    ),
    title: "Daily Digest Email",
    desc: "6 AM every morning — top 5 signals + action plan delivered to your inbox. Stay ahead on autopilot.",
    color: "#ef4444",
  },
];

const SIGNALS = [
  { company: "Freshworks", type: "Hiring Spike", text: "45 new enterprise sales roles in DACH — 3× spike vs Q3", strength: "HIGH", country: "🇩🇪", time: "2m ago" },
  { company: "Razorpay", type: "New Market", text: "Launched /malaysia with FPX + GrabPay payment content", strength: "HIGH", country: "🇲🇾", time: "11m ago" },
  { company: "Deel", type: "Pricing Change", text: "India EOR pricing raised 18% — ₹499 → ₹589/mo silently", strength: "HIGH", country: "🇮🇳", time: "28m ago" },
  { company: "Stripe", type: "Compliance", text: "KYC update: PAN + GSTIN now mandatory for all merchants", strength: "MED", country: "🇮🇳", time: "1h ago" },
  { company: "Shopify", type: "Hiring Spike", text: "20 new partnership manager roles across Southeast Asia", strength: "MED", country: "🇸🇬", time: "2h ago" },
];

const PLANS = [
  {
    name: "Starter",
    price: "₹4,999",
    period: "/month",
    desc: "For solo founders & SDRs",
    features: ["50 signal credits/mo", "5 watchlist companies", "Global buyer map", "Compliance checker", "Deal pipeline", "Email support"],
    cta: "Start free trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "₹8,000",
    period: "/month",
    desc: "For growing sales teams",
    features: ["Unlimited signals", "25 watchlist companies", "AI action engine", "Full buyer map (195 countries)", "44 compliance frameworks", "Contacts + Accounts CRM", "Priority support", "5 team seats"],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "₹19,999",
    period: "/month",
    desc: "For scaling revenue orgs",
    features: ["Everything in Pro", "Unlimited watchlist", "Custom signal rules", "Dedicated success manager", "REST API access", "White-label reports", "Custom onboarding", "SLA 99.9% uptime"],
    cta: "Contact sales",
    popular: false,
  },
];

const STATS = [
  { value: "195+", label: "Countries monitored" },
  { value: "44", label: "Compliance frameworks" },
  { value: "24/7", label: "Signal detection" },
  { value: "14 days", label: "Free trial" },
];

const LOGOS = ["Freshworks", "Razorpay", "Zoho", "Chargebee", "Postman", "BrowserStack"];

export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [activeSignal, setActiveSignal] = useState(0);

  useEffect(() => {
    if (isLoggedIn()) { router.replace("/dashboard"); return; }
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    const t = setInterval(() => setActiveSignal(i => (i + 1) % SIGNALS.length), 3000);
    return () => { window.removeEventListener("scroll", handler); clearInterval(t); };
  }, [router]);

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif", background: "#050508", color: "#fff", overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 max(24px, calc(50vw - 580px))", height: 60,
        background: scrolled ? "rgba(5,5,8,0.85)" : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#00F0FF 0%,#7C3AED 100%)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
              <rect x="1" y="1" width="14" height="2.5" rx="1.25" fill="white"/>
              <rect x="1" y="1" width="2.5" height="7" rx="1.25" fill="white"/>
              <rect x="1" y="6.75" width="14" height="2.5" rx="1.25" fill="white"/>
              <rect x="12.5" y="6.75" width="2.5" height="7" rx="1.25" fill="white"/>
              <rect x="1" y="12.5" width="14" height="2.5" rx="1.25" fill="white"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.4px" }}>
            Signal <span style={{ background: "linear-gradient(90deg,#00F0FF,#7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CRM</span>
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["Features", "Signals", "Pricing"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.6)"}>{l}</a>
          ))}
        </div>

        {/* Auth buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => router.push("/login")}
            style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s" }}
            onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.color = "#fff"; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.color = "rgba(255,255,255,0.7)"; }}>
            Sign in
          </button>
          <button onClick={() => router.push("/login?mode=register")}
            style={{ padding: "7px 18px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.2px" }}>
            Get started free
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px max(24px,calc(50vw - 580px)) 100px", textAlign: "center", position: "relative" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "15%", left: "30%", width: 500, height: 500, background: "radial-gradient(circle,rgba(0,240,255,0.06) 0%,transparent 65%)", transform: "rotate(-15deg)" }}/>
          <div style={{ position: "absolute", top: "25%", right: "25%", width: 600, height: 500, background: "radial-gradient(circle,rgba(124,58,237,0.08) 0%,transparent 65%)" }}/>
        </div>

        {/* Product badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "6px 16px", marginBottom: 36, backdropFilter: "blur(10px)" }}>
          <span style={{ width: 7, height: 7, background: "#22c55e", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 8px #22c55e" }}/>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>AI-powered B2B sales intelligence · 195 countries</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(40px,6.5vw,86px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-2.5px", marginBottom: 28, maxWidth: 920, background: "linear-gradient(180deg,#fff 60%,rgba(255,255,255,0.45))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          The CRM that tells you<br/>
          <span style={{ background: "linear-gradient(135deg,#00F0FF 0%,#7C3AED 60%,#A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            what to do next
          </span>
        </h1>

        <p style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 580, marginBottom: 48, fontWeight: 400 }}>
          Signal CRM monitors your target companies for buying signals — hiring spikes, new markets, pricing changes — and turns them into precise sales actions.
        </p>

        {/* CTA */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>
          <button onClick={() => router.push("/login?mode=register")}
            style={{ padding: "16px 36px", background: "linear-gradient(135deg,#00F0FF 0%,#7C3AED 100%)", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.3px", boxShadow: "0 0 40px rgba(0,240,255,0.2)" }}>
            Start 14-day free trial →
          </button>
          <button onClick={() => router.push("/login")}
            style={{ padding: "16px 28px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(10px)" }}>
            Sign in
          </button>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", letterSpacing: "0.02em" }}>No credit card required · Cancel anytime · Built for Indian B2B teams</p>

        {/* Floating signal card preview */}
        <div style={{ marginTop: 72, width: "100%", maxWidth: 740, position: "relative" }}>
          <div style={{ position: "absolute", inset: -1, background: "linear-gradient(135deg,rgba(0,240,255,0.2),rgba(124,58,237,0.2))", borderRadius: 18, filter: "blur(1px)" }}/>
          <div style={{ position: "relative", background: "rgba(14,14,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 24px", backdropFilter: "blur(20px)" }}>
            {/* Window chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }}/>)}
              <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>signal-crm · live feed</div>
            </div>
            {/* Signal rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {SIGNALS.map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", borderRadius: 9,
                  background: i === activeSignal ? "rgba(255,255,255,0.05)" : "transparent",
                  border: `1px solid ${i === activeSignal ? "rgba(255,255,255,0.08)" : "transparent"}`,
                  transition: "all 0.4s ease",
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.country}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.company}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: s.strength === "HIGH" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)", color: s.strength === "HIGH" ? "#f87171" : "#fbbf24", letterSpacing: "0.06em" }}>{s.strength}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 6 }}>{s.type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof ── */}
      <section style={{ padding: "40px max(24px,calc(50vw-580px))", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", fontWeight: 600, whiteSpace: "nowrap" }}>TRUSTED BY TEAMS AT</span>
          {LOGOS.map(l => (
            <span key={l} style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.18)", letterSpacing: "-0.3px" }}>{l}</span>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: "80px max(24px,calc(50vw-580px))" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ padding: "40px 32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-2px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "80px max(24px,calc(50vw-580px)) 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#7C3AED", background: "rgba(124,58,237,0.1)", padding: "6px 16px", borderRadius: 99, marginBottom: 20 }}>CAPABILITIES</div>
          <h2 style={{ fontSize: "clamp(28px,4vw,52px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16, background: "linear-gradient(180deg,#fff 50%,rgba(255,255,255,0.4))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Everything you need to close more deals
          </h2>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", maxWidth: 520, margin: "0 auto" }}>One platform for signal intelligence, relationship management, and revenue tracking.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title}
              style={{ padding: "32px 28px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden", cursor: "default" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = `${f.color}30`; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${f.color}60,transparent)`, opacity: 0 }}/>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.color}12`, border: `1px solid ${f.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10, letterSpacing: "-0.3px" }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live Signals Preview ── */}
      <section id="signals" style={{ padding: "80px max(24px,calc(50vw-580px)) 100px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          {/* Left: text */}
          <div>
            <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#00F0FF", background: "rgba(0,240,255,0.08)", padding: "6px 16px", borderRadius: 99, marginBottom: 24 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, background: "#22c55e", borderRadius: "50%", marginRight: 8, boxShadow: "0 0 8px #22c55e" }}/>
              LIVE DETECTION
            </div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 800, letterSpacing: "-1.2px", marginBottom: 20, lineHeight: 1.1 }}>
              Your market is moving.<br/>
              <span style={{ color: "#00F0FF" }}>Are you watching?</span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, marginBottom: 32 }}>
              Signal CRM monitors competitor websites 24/7. When Freshworks opens 45 new sales roles in Germany — you know in minutes, not weeks.
            </p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {["Hiring spikes → expansion signals", "New country/language pages → market entry", "Pricing page changes → competitive moves", "Compliance updates → regulatory shifts"].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#00F0FF", flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: signal feed */}
          <div style={{ background: "rgba(14,14,20,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", backdropFilter: "blur(20px)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, background: "#22c55e", borderRadius: "50%", boxShadow: "0 0 8px #22c55e" }}/>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Signal Feed — Live</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>5 new today</span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {SIGNALS.map((s, i) => (
                <div key={i} style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{s.country}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s.company}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: s.strength === "HIGH" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)", color: s.strength === "HIGH" ? "#f87171" : "#fbbf24", fontWeight: 700 }}>{s.strength}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>{s.text}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0, paddingTop: 2 }}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: "80px max(24px,calc(50vw-580px)) 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#7C3AED", background: "rgba(124,58,237,0.1)", padding: "6px 16px", borderRadius: 99, marginBottom: 20 }}>PRICING</div>
          <h2 style={{ fontSize: "clamp(28px,4vw,52px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16, background: "linear-gradient(180deg,#fff 50%,rgba(255,255,255,0.4))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Simple, honest pricing
          </h2>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.35)" }}>Start free for 14 days. Upgrade when you're ready.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, alignItems: "start" }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ position: "relative", padding: "36px 32px", background: p.popular ? "rgba(124,58,237,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${p.popular ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.06)"}` }}>
              {p.popular && (
                <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#7C3AED,#A855F7)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 20px", letterSpacing: "0.1em" }}>MOST POPULAR</div>
              )}
              <div style={{ marginBottom: 6, fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{p.desc}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>{p.name}</div>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-2px", background: p.popular ? "linear-gradient(135deg,#7C3AED,#A855F7)" : "linear-gradient(135deg,#fff,rgba(255,255,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{p.price}</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>{p.period}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                    <span style={{ color: p.popular ? "#A855F7" : "#00F0FF", flexShrink: 0, fontWeight: 700 }}>✓</span>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push("/login?mode=register")}
                style={{ width: "100%", padding: "13px", border: "none", borderRadius: 10, background: p.popular ? "linear-gradient(135deg,#7C3AED,#A855F7)" : "rgba(255,255,255,0.07)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.2px", transition: "all 0.15s" }}
                onMouseEnter={e => e.target.style.opacity = "0.85"}
                onMouseLeave={e => e.target.style.opacity = "1"}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>
          Pay via Razorpay · SWIFT · NEFT · UPI · International cards · Cancel anytime
        </p>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: "100px max(24px,calc(50vw-580px))", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,rgba(124,58,237,0.08) 0%,transparent 60%)", pointerEvents: "none" }}/>
        <h2 style={{ fontSize: "clamp(32px,5vw,64px)", fontWeight: 800, letterSpacing: "-2px", marginBottom: 20, lineHeight: 1.05 }}>
          Close your next deal<br/>
          <span style={{ background: "linear-gradient(135deg,#00F0FF,#7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>before they even know you're watching</span>
        </h2>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", marginBottom: 48, maxWidth: 500, margin: "0 auto 48px" }}>
          Join B2B sales teams using Signal CRM to reach the right buyer at the right moment.
        </p>
        <button onClick={() => router.push("/login?mode=register")}
          style={{ padding: "18px 48px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 14, color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.3px", boxShadow: "0 0 60px rgba(124,58,237,0.3)" }}>
          Start free 14-day trial →
        </button>
        <p style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>No credit card · Full access · Cancel anytime</p>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "40px max(24px,calc(50vw-580px))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#00F0FF,#7C3AED)", borderRadius: 7 }}/>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Signal CRM — by Nanoneuron Services</span>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {["Terms", "Privacy", "Support", "sales@nanoneuron.ai"].map(l => (
            <span key={l} style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.2)"}>{l}</span>
          ))}
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #050508; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::selection { background: rgba(124,58,237,0.4); color: #fff; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #050508; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .signals-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
