"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";

const TYPE_META = {
  hiring_spike: { icon: "🔥", label: "Hiring Spike", color: "#F85149" },
  new_country_page: { icon: "🌍", label: "Expansion", color: "#00D9FF" },
  pricing_change: { icon: "💰", label: "Pricing Change", color: "#D29922" },
  leadership_change: { icon: "👤", label: "Leadership", color: "#A855F7" },
  new_product: { icon: "📦", label: "New Product", color: "#3FB950" },
  compliance_update: { icon: "⚖️", label: "Compliance", color: "#E3B341" },
  partner_page: { icon: "🤝", label: "Partner", color: "#58A6FF" },
  expansion: { icon: "🌍", label: "Expansion", color: "#00D9FF" },
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SignalCard({ signal, onAction, onDismiss, onCreateDeal }) {
  const meta = TYPE_META[signal.signal_type] || { icon: "📡", label: signal.signal_type, color: "#888" };
  const strengthColor = { high: "#F85149", medium: "#D29922", low: "#3FB950" }[signal.signal_strength];
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", marginBottom: 12, transition: "border-color 0.15s" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{meta.icon}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ background: meta.color + "20", color: meta.color, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
              <span style={{ background: strengthColor + "20", color: strengthColor, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>{signal.signal_strength.toUpperCase()}</span>
              {signal.country_hint && <span style={{ color: "var(--text3)", fontSize: 11 }}>📍 {signal.country_hint}</span>}
              <span style={{ color: "var(--text3)", fontSize: 11 }}>{timeAgo(signal.detected_at)}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.4, color: "var(--text)" }}>{signal.title}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", flexShrink: 0 }}>{signal.company_name}</div>
      </div>

      <div style={{ color: "var(--text2)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>{signal.summary}</div>

      {/* Proof box */}
      {signal.proof_text && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 6 }}>PROOF — WEB EVIDENCE</div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(230,237,243,0.6)", lineHeight: 1.6 }}>{signal.proof_text}</div>
        </div>
      )}

      {/* Recommended action */}
      {signal.recommended_action && (
        <div style={{ background: "rgba(63,185,80,0.07)", border: "1px solid rgba(63,185,80,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#3FB950", letterSpacing: "0.08em", marginBottom: 4 }}>RECOMMENDED ACTION</div>
          <div style={{ fontSize: 13, color: "rgba(230,237,243,0.8)", lineHeight: 1.6 }}>{signal.recommended_action}</div>
        </div>
      )}

      {/* Action buttons */}
      {!signal.is_actioned && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onCreateDeal(signal)} style={{ padding: "7px 14px", borderRadius: 7, background: "linear-gradient(135deg,#00D9FF,#A855F7)", color: "#06080D", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none" }}>+ Create Deal</button>
          <button onClick={() => onAction(signal.id)} style={{ padding: "7px 14px", borderRadius: 7, background: "rgba(63,185,80,0.1)", border: "1px solid rgba(63,185,80,0.3)", color: "#3FB950", fontSize: 12, cursor: "pointer" }}>✓ Mark Actioned</button>
          <button onClick={() => onDismiss(signal.id)} style={{ padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text3)", fontSize: 12, cursor: "pointer" }}>Dismiss</button>
        </div>
      )}
      {signal.is_actioned && (
        <div style={{ fontSize: 12, color: "#3FB950" }}>✓ Actioned</div>
      )}
    </div>
  );
}

export default function SignalFeedPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(null);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/signals/feed");
    setData(d);
    setLoading(false);
  }

  async function seed() {
    setSeeding(true);
    await apiFetch("/signals/seed", { method: "POST" });
    await load();
    setSeeding(false);
  }

  async function action(id) {
    await apiFetch(`/signals/${id}/action`, { method: "POST" });
    setData(d => d ? { ...d, feed: d.feed.map(s => s.id === id ? { ...s, is_actioned: true } : s) } : d);
  }

  async function dismiss(id) {
    await apiFetch(`/signals/${id}/dismiss`, { method: "POST" });
    setData(d => d ? { ...d, feed: d.feed.filter(s => s.id !== id) } : d);
  }

  async function createDeal(signal) {
    const res = await apiFetch("/deals", {
      method: "POST",
      body: JSON.stringify({
        title: `${signal.company_name} — ${signal.signal_type.replace(/_/g, " ")}`,
        company_name: signal.company_name,
        country: signal.country_hint,
        signal_trigger: signal.title,
        next_action: signal.recommended_action,
        stage: "signal",
      }),
    });
    if (res.success) {
      setCreatingDeal(signal.company_name);
      setTimeout(() => setCreatingDeal(null), 2500);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ color: "var(--text3)", padding: 40 }}>Loading signal feed…</div>;

  const stats = data?.stats || {};
  const feed = data?.feed || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>⚡ Signal Feed</h1>
        <p style={{ color: "var(--text2)", fontSize: 13 }}>Latest web changes across your watched accounts — ranked by priority.</p>
      </div>

      {creatingDeal && (
        <div style={{ background: "rgba(63,185,80,0.1)", border: "1px solid rgba(63,185,80,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#3FB950" }}>
          ✓ Deal created for {creatingDeal} — go to Deals to track it.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Stat label="Total Signals" value={stats.total || 0} color="var(--text)" />
        <Stat label="High Priority" value={stats.high_priority || 0} color="#F85149" />
        <Stat label="Actioned" value={stats.actioned || 0} color="#3FB950" />
        <Stat label="Watched Companies" value={stats.watchlisted_companies || 0} color="var(--accent)" />
      </div>

      {feed.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No signals yet</div>
          <div style={{ color: "var(--text2)", marginBottom: 24, fontSize: 13 }}>Load demo data to see how Signal CRM works, or add companies to your watchlist.</div>
          <button onClick={seed} disabled={seeding} style={{ padding: "11px 28px", borderRadius: 8, background: "linear-gradient(135deg,#00D9FF,#A855F7)", color: "#06080D", fontWeight: 700, fontSize: 14, cursor: "pointer", border: "none" }}>
            {seeding ? "Seeding demo data…" : "⚡ Load Demo Signals"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>{feed.length} signals · sorted by priority</div>
            <button onClick={load} style={{ padding: "6px 14px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 12, cursor: "pointer" }}>↻ Refresh</button>
          </div>
          {feed.map(s => (
            <SignalCard key={s.id} signal={s} onAction={action} onDismiss={dismiss} onCreateDeal={createDeal} />
          ))}
        </div>
      )}
    </div>
  );
}
