"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../lib/api";

const TYPE_META = {
  hiring_spike:      { color:"#E50914", label:"Hiring Spike",    icon:"📈" },
  new_country_page:  { color:"#0071eb", label:"Expansion",       icon:"🌍" },
  pricing_change:    { color:"#f5a623", label:"Pricing Change",  icon:"💰" },
  leadership_change: { color:"#a855f7", label:"Leadership",      icon:"👤" },
  new_product:       { color:"#46d369", label:"New Product",     icon:"🚀" },
  compliance_update: { color:"#e87c03", label:"Compliance",      icon:"⚖️"  },
  partner_page:      { color:"#58a6ff", label:"Partner",         icon:"🤝" },
  expansion:         { color:"#0071eb", label:"Expansion",       icon:"🌍" },
};
const STRENGTH_COLOR = { high:"#E50914", medium:"#f5a623", low:"#46d369" };

// Animated counter
function Counter({ value, color }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const step = Math.ceil(value / 20);
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [value]);
  return <span style={{ color }}>{display}</span>;
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)",
      borderRadius:6, padding:"22px 24px",
      transition:"border-color 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color + "44"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
    >
      <div style={{ fontSize:40, fontWeight:900, lineHeight:1, marginBottom:6 }}>
        <Counter value={value} color={color} />
      </div>
      <div style={{ fontSize:13, color:"#737373" }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:color, fontWeight:600, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function SignalCard({ s, onAction, onDismiss, onDeal, justCreated }) {
  const t = TYPE_META[s.signal_type] || { color:"#b3b3b3", label:s.signal_type, icon:"📡" };
  const avatarColor = ["#E50914","#0071eb","#f5a623","#46d369","#a855f7","#58a6ff"][
    (s.company_name?.charCodeAt(0) || 0) % 6
  ];
  return (
    <div style={{
      background:"#1a1a1a", borderRadius:6, padding:"20px 24px", marginBottom:8,
      border:"1px solid rgba(255,255,255,0.06)",
      borderLeft: `3px solid ${t.color}`,
      transition:"background 0.15s, transform 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background="#222"; e.currentTarget.style.transform="translateX(2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.background="#1a1a1a"; e.currentTarget.style.transform="translateX(0)"; }}
    >
      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, flex:1 }}>
          {/* Company avatar */}
          <div style={{
            width:40, height:40, borderRadius:6, background:avatarColor,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, fontSize:16, color:"#fff", flexShrink:0,
          }}>
            {s.company_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
              <span style={{ background:t.color+"20", color:t.color, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                {t.icon} {t.label.toUpperCase()}
              </span>
              <span style={{
                background:STRENGTH_COLOR[s.signal_strength]+"20",
                color:STRENGTH_COLOR[s.signal_strength],
                padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700
              }}>
                {(s.signal_strength||"").toUpperCase()}
              </span>
              {s.country_hint && (
                <span style={{ color:"#737373", fontSize:12, padding:"2px 0" }}>📍 {s.country_hint}</span>
              )}
            </div>
            <div style={{ fontWeight:700, fontSize:15, color:"#fff", lineHeight:1.4 }}>{s.title}</div>
          </div>
        </div>
        <div style={{
          fontSize:22, fontWeight:900, color:"#fff",
          background:"rgba(255,255,255,0.05)", borderRadius:4,
          padding:"4px 10px", flexShrink:0,
          fontVariantNumeric:"tabular-nums",
        }}>
          {s.score || "—"}<span style={{ fontSize:11, color:"#737373", fontWeight:400 }}>/10</span>
        </div>
      </div>

      {/* Company name + summary */}
      <div style={{ fontSize:12, fontWeight:700, color:"#b3b3b3", marginBottom:4, paddingLeft:52 }}>{s.company_name}</div>
      <div style={{ color:"#b3b3b3", fontSize:13, lineHeight:1.7, marginBottom:12, paddingLeft:52 }}>{s.summary}</div>

      {/* Proof */}
      {s.proof_text && (
        <div style={{
          background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:4, padding:"10px 14px", marginBottom:12,
          fontFamily:"'SF Mono','Fira Code',monospace", fontSize:12, color:"#737373",
        }}>
          🔍 {s.proof_text}
        </div>
      )}

      {/* Recommended action */}
      {s.recommended_action && (
        <div style={{
          background:"rgba(70,211,105,0.05)", border:"1px solid rgba(70,211,105,0.15)",
          borderRadius:4, padding:"10px 14px", marginBottom:14,
        }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#46d369", letterSpacing:"0.1em", marginBottom:4 }}>💡 RECOMMENDED ACTION</div>
          <div style={{ fontSize:13, color:"#e5e5e5", lineHeight:1.6 }}>{s.recommended_action}</div>
        </div>
      )}

      {/* Actions */}
      {justCreated && (
        <div style={{ fontSize:13, color:"#46d369", marginBottom:8, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
          <span>✓</span> Added to Deal Pipeline
        </div>
      )}
      {!s.is_actioned ? (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={() => onDeal(s)} style={{
            padding:"8px 18px", borderRadius:20, background:"#E50914", color:"#fff",
            fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
            transition:"background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background="#f40612"}
            onMouseLeave={e => e.currentTarget.style.background="#E50914"}
          >
            + Add to Pipeline
          </button>
          <button onClick={() => onAction(s.id)} style={{
            padding:"8px 16px", borderRadius:20, background:"rgba(70,211,105,0.1)",
            border:"1px solid rgba(70,211,105,0.3)", color:"#46d369",
            fontSize:12, fontWeight:600, cursor:"pointer",
          }}>
            ✓ Mark Done
          </button>
          <button onClick={() => onDismiss(s.id)} style={{
            padding:"8px 16px", borderRadius:20, background:"transparent",
            border:"1px solid rgba(255,255,255,0.08)", color:"#737373",
            fontSize:12, cursor:"pointer",
          }}>
            Dismiss
          </button>
        </div>
      ) : (
        <div style={{ fontSize:12, color:"#46d369", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
          ✓ Actioned
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [seeding,  setSeeding]  = useState(false);
  const [created,  setCreated]  = useState(null);
  const [toast,    setToast]    = useState(null);
  const [filter,   setFilter]   = useState("all"); // all | high | unactioned

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/signals/feed");
    setData(d);
    setLoading(false);
  }

  async function seed() {
    setSeeding(true);
    await apiFetch("/signals/seed", { method:"POST" });
    await load();
    setSeeding(false);
    showToast("Demo signals loaded!", "success");
  }

  async function action(id) {
    await apiFetch(`/signals/${id}/action`, { method:"POST" });
    setData(d => d ? { ...d, feed: d.feed.map(s => s.id === id ? { ...s, is_actioned:true } : s) } : d);
    showToast("Marked as actioned", "success");
  }

  async function dismiss(id) {
    await apiFetch(`/signals/${id}/dismiss`, { method:"POST" });
    setData(d => d ? { ...d, feed: d.feed.filter(s => s.id !== id) } : d);
    showToast("Signal dismissed", "info");
  }

  async function createDeal(signal) {
    const r = await apiFetch("/deals", { method:"POST", body: JSON.stringify({
      title: `${signal.company_name} — ${(signal.signal_type||"").replace(/_/g," ")}`,
      company_name: signal.company_name,
      country: signal.country_hint,
      signal_trigger: signal.title,
      next_action: signal.recommended_action,
      stage: "signal",
    })});
    if (r.success) {
      setCreated(signal.id);
      setTimeout(() => setCreated(null), 3000);
      showToast(`Deal created for ${signal.company_name}!`, "success");
    }
  }

  useEffect(() => { load(); }, []);

  const stats = data?.stats || {};
  const feed  = data?.feed  || [];

  const displayed = feed.filter(s => {
    if (filter === "high")      return s.signal_strength === "high";
    if (filter === "unactioned") return !s.is_actioned;
    return true;
  });

  const high    = feed.filter(s => s.signal_strength === "high" && !s.is_actioned);
  const topSignal = high[0] || feed[0];

  const grouped = {
    "🔴 Act Now":          feed.filter(s => s.signal_strength === "high" && !s.is_actioned),
    "🌍 Expansion Signals": feed.filter(s => ["new_country_page","expansion","new_product"].includes(s.signal_type)),
    "💰 Market Intel":      feed.filter(s => ["pricing_change","partner_page"].includes(s.signal_type)),
    "👤 Org Changes":       feed.filter(s => ["leadership_change","hiring_spike"].includes(s.signal_type)),
    "⚖️ Compliance Alerts": feed.filter(s => s.signal_type === "compliance_update"),
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", bottom:32, right:32, zIndex:999,
          background: toast.type === "success" ? "#46d369" : toast.type === "info" ? "#0071eb" : "#E50914",
          color:"#fff", padding:"12px 20px", borderRadius:6,
          fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
          animation:"slideUp 0.3s ease",
        }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {toast.type === "success" ? "✓" : "ℹ"} {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Signal Intelligence</h1>
        <p style={{ color:"#737373", fontSize:13 }}>Real-time web changes turned into sales opportunities.</p>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:36 }}>
        <StatCard label="Total Signals"  value={stats.total || 0}          color="#fff"    />
        <StatCard label="High Priority"  value={stats.high_priority || 0}  color="#E50914" sub={stats.high_priority > 0 ? "Needs attention" : null} />
        <StatCard label="Actioned"       value={stats.actioned || 0}        color="#46d369" />
        <StatCard label="In Feed"        value={feed.length}                color="#f5a623" />
      </div>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading signals…
        </div>
      )}

      {!loading && feed.length === 0 && (
        <div style={{ background:"#1a1a1a", borderRadius:8, padding:"72px 32px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>📡</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:8 }}>No signals yet</div>
          <div style={{ color:"#737373", marginBottom:8, fontSize:14, maxWidth:380, margin:"0 auto 28px" }}>
            Load demo signals to see exactly how Signal CRM works — hiring spikes, expansions, pricing changes, and more.
          </div>
          <button onClick={seed} disabled={seeding} style={{
            padding:"14px 36px", borderRadius:24, background:"#E50914", color:"#fff",
            fontWeight:700, fontSize:15, cursor:"pointer", border:"none",
            opacity: seeding ? 0.7 : 1,
          }}>
            {seeding ? "Loading…" : "⚡ Load Demo Signals"}
          </button>
        </div>
      )}

      {!loading && feed.length > 0 && (
        <>
          {/* Signal of the Day hero */}
          {topSignal && (
            <div style={{ marginBottom:36 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#E50914", letterSpacing:"0.12em", marginBottom:10 }}>⚡ SIGNAL OF THE DAY</div>
              <div style={{
                background:"linear-gradient(135deg, #1a1a1a 0%, #1f1a1a 100%)",
                border:"1px solid rgba(229,9,20,0.25)",
                borderRadius:8, padding:"28px 32px",
                position:"relative", overflow:"hidden",
              }}>
                <div style={{ position:"absolute", top:0, right:0, width:200, height:200, background:"radial-gradient(circle, rgba(229,9,20,0.06) 0%, transparent 70%)", pointerEvents:"none" }}/>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                  {(() => {
                    const t = TYPE_META[topSignal.signal_type] || { color:"#b3b3b3", label:topSignal.signal_type, icon:"📡" };
                    return (
                      <>
                        <span style={{ background:t.color+"20", color:t.color, padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700 }}>{t.icon} {t.label}</span>
                        <span style={{ background:"rgba(229,9,20,0.15)", color:"#E50914", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>Score {topSignal.score}/10</span>
                        {topSignal.country_hint && <span style={{ color:"#737373", fontSize:12, padding:"3px 0" }}>📍 {topSignal.country_hint}</span>}
                      </>
                    );
                  })()}
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:"#fff", lineHeight:1.4, marginBottom:8 }}>{topSignal.title}</div>
                <div style={{ fontSize:13, color:"#b3b3b3", lineHeight:1.7, marginBottom:16 }}>{topSignal.summary}</div>
                {topSignal.recommended_action && (
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, color:"#46d369", fontSize:13 }}>
                    <span style={{ flexShrink:0, fontWeight:700 }}>💡</span>
                    <span>{topSignal.recommended_action}</span>
                  </div>
                )}
                {!topSignal.is_actioned && (
                  <div style={{ display:"flex", gap:8, marginTop:20 }}>
                    <button onClick={() => createDeal(topSignal)} style={{
                      padding:"10px 22px", borderRadius:24, background:"#E50914", color:"#fff",
                      fontWeight:700, fontSize:13, cursor:"pointer", border:"none",
                    }}>
                      + Add to Pipeline
                    </button>
                    <button onClick={() => action(topSignal.id)} style={{
                      padding:"10px 18px", borderRadius:24,
                      background:"rgba(70,211,105,0.1)", border:"1px solid rgba(70,211,105,0.3)",
                      color:"#46d369", fontSize:13, fontWeight:600, cursor:"pointer",
                    }}>
                      ✓ Mark Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ display:"flex", gap:8, marginBottom:24, alignItems:"center" }}>
            {[
              { key:"all",        label:`All (${feed.length})` },
              { key:"high",       label:`🔴 High Priority (${high.length})` },
              { key:"unactioned", label:`Unactioned (${feed.filter(s=>!s.is_actioned).length})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding:"7px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                background: filter === f.key ? "#E50914" : "rgba(255,255,255,0.06)",
                color: filter === f.key ? "#fff" : "#b3b3b3",
                border: filter === f.key ? "none" : "1px solid rgba(255,255,255,0.08)",
                transition:"all 0.15s",
              }}>
                {f.label}
              </button>
            ))}
            <div style={{ flex:1 }}/>
            <button onClick={load} style={{
              padding:"7px 14px", borderRadius:20, fontSize:12, cursor:"pointer",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              color:"#737373",
            }}>
              ↻ Refresh
            </button>
          </div>

          {/* Netflix-style rows */}
          {filter === "all" ? (
            Object.entries(grouped).filter(([,items]) => items.length > 0).map(([rowTitle, items]) => (
              <div key={rowTitle} style={{ marginBottom:40 }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:14 }}>
                  {rowTitle}
                  <span style={{ fontSize:13, color:"#737373", fontWeight:400, marginLeft:8 }}>{items.length}</span>
                </div>
                {items.map(s => (
                  <SignalCard key={s.id} s={s} onAction={action} onDismiss={dismiss} onDeal={createDeal} justCreated={created === s.id} />
                ))}
              </div>
            ))
          ) : (
            <div>
              {displayed.length === 0 ? (
                <div style={{ background:"#1a1a1a", borderRadius:6, padding:"40px", textAlign:"center", color:"#737373" }}>
                  No signals match this filter.
                </div>
              ) : (
                displayed.map(s => (
                  <SignalCard key={s.id} s={s} onAction={action} onDismiss={dismiss} onDeal={createDeal} justCreated={created === s.id} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
