"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Structured data for Google
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://signal.nanoneuron.ai/#software",
      "name": "Signal CRM",
      "applicationCategory": "BusinessApplication",
      "applicationSubCategory": "CRM Software",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "8000",
        "priceCurrency": "INR",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "description": "14-day free trial included",
      },
      "description": "Signal CRM monitors competitor web changes — hiring spikes, expansions, pricing shifts, leadership changes — and turns them into actionable B2B sales intelligence for cross-border teams.",
      "url": "https://signal.nanoneuron.ai",
      "screenshot": "https://signal.nanoneuron.ai/og-image.png",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "47",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://nanoneuron.ai/#org",
      "name": "Nanoneuron Services",
      "url": "https://nanoneuron.ai",
      "logo": "https://nanoneuron.ai/logo.png",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "support@nanoneuron.ai",
        "contactType": "customer support",
      },
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Signal CRM?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Signal CRM monitors competitor and target company web changes — hiring spikes, new country pages, pricing changes, leadership moves — and turns them into actionable B2B sales opportunities. Built for cross-border and export sales teams.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Signal CRM help cross-border sales?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Signal CRM includes a Buyer Map (who makes the buying decision in 50+ countries), Compliance Checker (email outreach rules for 195+ countries), and real-time web signals that show when companies are expanding internationally.",
          },
        },
        {
          "@type": "Question",
          "name": "What is the price of Signal CRM?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Signal CRM starts at ₹8,000/month for India and $149/month for international customers. A 14-day free trial is included — no credit card required.",
          },
        },
        {
          "@type": "Question",
          "name": "Does Signal CRM work for Indian B2B companies?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Signal CRM was built specifically for Indian B2B companies, IT services firms, SaaS companies, and export businesses expanding into global markets. Payments via Razorpay for India and SWIFT bank transfer for international.",
          },
        },
      ],
    },
  ],
};

const FEATURES = [
  {
    icon: "📡",
    title: "Web Signal Intelligence",
    desc: "Know when your targets post 45 new jobs in Germany, launch a new country page, or change pricing. Act before your competitors.",
    tag: "Core Feature",
  },
  {
    icon: "🗺️",
    title: "Global Buyer Map",
    desc: "Who makes the buying decision at a German logistics company? A Singapore fintech? Signal CRM tells you — 50+ countries, 10+ industries.",
    tag: "Unique",
  },
  {
    icon: "⚖️",
    title: "Compliance Checker",
    desc: "Before you cold-email anyone, check the rules. GDPR, CCPA, PDPA, APPI — 195+ countries with regulator, penalty, and pre-outreach checklist.",
    tag: "Legal Safety",
  },
  {
    icon: "💼",
    title: "Deal Pipeline",
    desc: "One-click from signal to deal. Track every opportunity from signal → qualified → proposal → negotiation → closed.",
    tag: "Pipeline",
  },
  {
    icon: "🎯",
    title: "Lead Management",
    desc: "Global contact database with lead scoring, status tracking, and import directly from signals.",
    tag: "Leads",
  },
  {
    icon: "🤖",
    title: "AI Next Actions",
    desc: "AI ranks what you should do today — urgent signals, stuck deals, compliance checks — so you never miss the right moment.",
    tag: "AI-Powered",
  },
];

const SIGNALS = [
  { company: "Freshworks", type: "Hiring Spike",   color: "#E50914", desc: "45 enterprise sales roles posted in DACH — 3× spike vs last quarter", score: 9 },
  { company: "Razorpay",   type: "Expansion",      color: "#0071eb", desc: "Launched /malaysia with FPX, DuitNow, GrabPay — entering SE Asia", score: 8 },
  { company: "Deel",       type: "Pricing Change", color: "#f5a623", desc: "India EOR pricing raised 18% — retention risk for their customers", score: 9 },
  { company: "Zoho",       type: "New Product",    color: "#46d369", desc: "Finance Plus bundle launched for UK SME accountants with MTD compliance", score: 7 },
];

const PLANS = [
  { name: "Starter",  inr: "₹4,000",  usd: "$79",  deals: 25,   leads: 100,  signals: 50  },
  { name: "Pro",      inr: "₹8,000",  usd: "$149", deals: null, leads: null, signals: null, popular: true },
  { name: "Scale",    inr: "₹18,000", usd: "$299", deals: null, leads: null, signals: null, team: true },
];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Logged-in users bypass the landing page
    const token = typeof window !== "undefined" && localStorage.getItem("sig_token");
    if (token) router.replace("/dashboard");
  }, []);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <div style={{ minHeight: "100vh", background: "#141414", color: "#fff" }}>

        {/* ── NAV ─────────────────────────────────────────── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(20,20,20,0.96)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 56px", height: 64,
        }}>
          <a href="/" style={{ fontSize: 22, fontWeight: 900, color: "#E50914", fontStyle: "italic", letterSpacing: "-0.5px" }}>
            SIGNAL CRM
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {[
              ["#features", "Features"],
              ["#how-it-works", "How It Works"],
              ["#pricing", "Pricing"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13, color: "#b3b3b3", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = "#fff"}
                onMouseLeave={e => e.target.style.color = "#b3b3b3"}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/login" style={{ padding: "9px 20px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              Sign In
            </a>
            <a href="/login" style={{ padding: "9px 20px", borderRadius: 6, background: "#E50914", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              Start Free Trial →
            </a>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────── */}
        <section style={{ padding: "96px 56px 80px", textAlign: "center", maxWidth: 860, margin: "0 auto" }}
          itemScope itemType="https://schema.org/WebPage">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(229,9,20,0.1)", border: "1px solid rgba(229,9,20,0.3)", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#E50914", fontWeight: 700, marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E50914", display: "inline-block" }}/>
            LIVE INTELLIGENCE · 8 SIGNALS TODAY
          </div>

          <h1 style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}
            itemProp="name">
            Turn competitor web changes<br />
            <span style={{ color: "#E50914" }}>into closed deals.</span>
          </h1>

          <p style={{ fontSize: "clamp(15px,2vw,19px)", color: "#b3b3b3", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 36px" }}
            itemProp="description">
            Signal CRM monitors hiring spikes, market expansions, pricing shifts, and leadership changes — then tells your sales team exactly what to do next.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/login" style={{ padding: "16px 36px", borderRadius: 8, background: "#E50914", color: "#fff", fontWeight: 800, fontSize: 16, display: "inline-block" }}>
              Start 14-Day Free Trial →
            </a>
            <a href="#how-it-works" style={{ padding: "16px 28px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, display: "inline-block" }}>
              See How It Works
            </a>
          </div>

          <p style={{ fontSize: 12, color: "#737373", marginTop: 14 }}>
            No credit card required · 14-day free trial · Cancel anytime
          </p>
        </section>

        {/* ── LIVE SIGNAL TICKER ──────────────────────────── */}
        <section style={{ padding: "0 56px 80px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ fontSize: 11, color: "#737373", fontWeight: 700, letterSpacing: "0.1em", textAlign: "center", marginBottom: 20 }}>
              SIGNALS DETECTED TODAY
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
              {SIGNALS.map(s => (
                <article key={s.company} style={{
                  background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `3px solid ${s.color}`, borderRadius: 6,
                  padding: "16px 18px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ background: s.color + "20", color: s.color, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{s.score}<span style={{ fontSize: 10, color: "#737373", fontWeight: 400 }}>/10</span></span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 4 }}>{s.company}</div>
                  <div style={{ fontSize: 12, color: "#737373", lineHeight: 1.5 }}>{s.desc}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────── */}
        <section id="how-it-works" style={{ padding: "80px 56px", background: "#0f0f0f" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, textAlign: "center", marginBottom: 12 }}>How Signal CRM works</h2>
            <p style={{ color: "#737373", textAlign: "center", fontSize: 15, marginBottom: 56, maxWidth: 560, margin: "0 auto 56px" }}>
              Three steps from signal to closed deal.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }}>
              {[
                { step: "01", title: "Detect signals", desc: "We monitor target companies for web changes — job posts, new pages, pricing updates, leadership changes.", icon: "📡" },
                { step: "02", title: "Get context",    desc: "Know who to call (Buyer Map), whether you can email them (Compliance), and what to say (AI action).", icon: "🧠" },
                { step: "03", title: "Close the deal", desc: "Add the signal to your pipeline with one click. Track it from signal → qualified → negotiation → won.", icon: "🏆" },
              ].map(s => (
                <div key={s.step} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, color: "#E50914", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>STEP {s.step}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ color: "#737373", fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────── */}
        <section id="features" style={{ padding: "80px 56px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, textAlign: "center", marginBottom: 12 }}>
              Everything for cross-border B2B sales
            </h2>
            <p style={{ color: "#737373", textAlign: "center", fontSize: 15, marginBottom: 56, maxWidth: 520, margin: "0 auto 56px" }}>
              Built for Indian IT services, SaaS, and export companies selling to 195+ countries.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              {FEATURES.map(f => (
                <article key={f.title} style={{
                  background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8, padding: "24px 24px",
                  transition: "border-color 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(229,9,20,0.3)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{f.title}</h3>
                    <span style={{ background: "rgba(229,9,20,0.12)", color: "#E50914", padding: "1px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{f.tag}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#737373", lineHeight: 1.7 }}>{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF ─────────────────────────────────── */}
        <section style={{ padding: "60px 56px", background: "#0f0f0f" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 24, textAlign: "center" }}>
              {[
                { val: "195+",    label: "Countries covered",         sub: "compliance + buyer data" },
                { val: "8+",      label: "Industries mapped",         sub: "buyer personas per country" },
                { val: "14 days", label: "Free trial",                sub: "no credit card needed" },
                { val: "1 deal",  label: "Covers months of the plan", sub: "typical ROI in first 30 days" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#E50914", marginBottom: 4 }}>{s.val}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "#737373" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────── */}
        <section id="pricing" style={{ padding: "80px 56px" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, textAlign: "center", marginBottom: 12 }}>Simple, transparent pricing</h2>
            <p style={{ color: "#737373", textAlign: "center", fontSize: 15, marginBottom: 48, maxWidth: 480, margin: "0 auto 48px" }}>
              One closed deal covers months of the plan. 14-day free trial included.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {PLANS.map(p => (
                <div key={p.name} style={{
                  background: p.popular ? "#fff" : "#1a1a1a",
                  border: p.popular ? "none" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8, padding: "28px 24px",
                  position: "relative",
                  transform: p.popular ? "scale(1.03)" : "none",
                }}>
                  {p.popular && (
                    <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#E50914", color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
                      MOST POPULAR
                    </div>
                  )}
                  <div style={{ fontSize: 18, fontWeight: 800, color: p.popular ? "#141414" : "#fff", marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: p.popular ? "#E50914" : "#fff", marginBottom: 4 }}>{p.inr}</div>
                  <div style={{ fontSize: 13, color: p.popular ? "#666" : "#737373", marginBottom: 20 }}>{p.usd}/mo · billed monthly</div>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                    {[
                      p.signals ? `${p.signals} signals/mo` : "Unlimited signals",
                      p.leads ? `${p.leads} leads` : "Unlimited leads",
                      p.deals ? `${p.deals} active deals` : "Unlimited deals",
                      "195+ country compliance",
                      "Buyer map access",
                      p.team ? "5 team seats" : "1 seat",
                    ].map(f => (
                      <li key={f} style={{ fontSize: 13, color: p.popular ? "#444" : "#b3b3b3", display: "flex", gap: 8 }}>
                        <span style={{ color: p.popular ? "#E50914" : "#46d369", fontWeight: 700 }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <a href="/login" style={{
                    display: "block", textAlign: "center", padding: "13px",
                    borderRadius: 6, fontWeight: 700, fontSize: 14,
                    background: p.popular ? "#E50914" : "rgba(255,255,255,0.08)",
                    color: "#fff", border: p.popular ? "none" : "1px solid rgba(255,255,255,0.1)",
                  }}>
                    Start Free Trial →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section id="faq" style={{ padding: "80px 56px", background: "#0f0f0f" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, textAlign: "center", marginBottom: 48 }}>Frequently asked questions</h2>
            {[
              {
                q: "What is Signal CRM?",
                a: "Signal CRM monitors competitor and target company websites for changes — hiring spikes, new country pages, pricing shifts, leadership moves — and turns them into actionable B2B sales opportunities for cross-border teams.",
              },
              {
                q: "Who is Signal CRM for?",
                a: "B2B sales teams at Indian IT services companies, SaaS companies, export businesses, and agencies selling to international clients in USA, Europe, SEA, and the Middle East.",
              },
              {
                q: "How is Signal CRM different from LinkedIn Sales Navigator?",
                a: "LinkedIn shows people. Signal CRM shows intent — when a company posts 45 jobs in Germany, launches a new market page, or raises prices. You get the signal before anyone else, not just a contact list.",
              },
              {
                q: "Does it work for GDPR-compliant outreach?",
                a: "Yes. The Compliance Checker covers 195+ countries including all EU/EEA markets. It shows you whether cold email is allowed, what consent is needed, and who the regulator is — before you send anything.",
              },
              {
                q: "What payment methods are available?",
                a: "India: Razorpay (UPI, cards, net banking) and NEFT bank transfer. International: SWIFT wire transfer to our Axis Bank account in 7 currencies (USD, EUR, GBP, AED, SGD, AUD, CAD).",
              },
              {
                q: "Is there a free trial?",
                a: "Yes — 14 days, full access to all features, no credit card required. After the trial, upgrade with Razorpay (India) or SWIFT transfer (international).",
              },
            ].map(({ q, a }) => (
              <details key={q} style={{
                background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 6, padding: "18px 22px", marginBottom: 10,
              }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 15, color: "#fff", listStyle: "none", display: "flex", justifyContent: "space-between" }}>
                  {q} <span style={{ color: "#E50914" }}>+</span>
                </summary>
                <p style={{ marginTop: 12, fontSize: 14, color: "#b3b3b3", lineHeight: 1.7 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA BANNER ───────────────────────────────────── */}
        <section style={{ padding: "80px 56px", textAlign: "center", background: "linear-gradient(135deg, #1a0505 0%, #141414 100%)" }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, marginBottom: 16 }}>
            Your next deal is already a signal.<br />
            <span style={{ color: "#E50914" }}>Are you watching?</span>
          </h2>
          <p style={{ color: "#737373", fontSize: 16, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            Start your 14-day free trial. No credit card. Full access. Cancel anytime.
          </p>
          <a href="/login" style={{ display: "inline-block", padding: "18px 48px", borderRadius: 8, background: "#E50914", color: "#fff", fontWeight: 800, fontSize: 18 }}>
            Start Free Trial — It's Free →
          </a>
        </section>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 56px" }}
          itemScope itemType="https://schema.org/Organization">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#E50914", fontStyle: "italic", marginBottom: 8 }}>SIGNAL CRM</div>
              <p style={{ color: "#737373", fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}
                itemProp="description">
                Cross-border sales intelligence for B2B teams expanding internationally.
              </p>
              <div style={{ marginTop: 12, fontSize: 12, color: "#737373" }}>
                By <span itemProp="name">Nanoneuron Services</span> · Pune, India
              </div>
            </div>
            <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", marginBottom: 12 }}>PRODUCT</div>
                {[["#features","Features"],["#how-it-works","How It Works"],["#pricing","Pricing"],["#faq","FAQ"]].map(([h,l]) => (
                  <a key={h} href={h} style={{ display: "block", fontSize: 13, color: "#737373", marginBottom: 8 }}>{l}</a>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", marginBottom: 12 }}>ACCOUNT</div>
                {[["/login","Sign In"],["/login","Start Free Trial"],["/dashboard/payment","Pricing"]].map(([h,l]) => (
                  <a key={l} href={h} style={{ display: "block", fontSize: 13, color: "#737373", marginBottom: 8 }}>{l}</a>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", marginBottom: 12 }}>CONTACT</div>
                <a href="mailto:support@nanoneuron.ai" style={{ display: "block", fontSize: 13, color: "#737373", marginBottom: 8 }}
                  itemProp="email">support@nanoneuron.ai</a>
                <div style={{ fontSize: 13, color: "#737373" }}>Pune, Maharashtra, India</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#737373" }}>
              © {new Date().getFullYear()} Nanoneuron Services. All rights reserved.
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {["Privacy Policy", "Terms of Use", "Contact"].map(l => (
                <a key={l} href="#" style={{ fontSize: 12, color: "#737373" }}>{l}</a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
