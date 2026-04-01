"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
const LIVE_INTERVAL = 30_000; // 30s auto-refresh

// Animated counter
function Counter({ value, color, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 25));
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [value]);
  return <span style={{ color }}>{prefix}{display.toLocaleString("en-IN")}{suffix}</span>;
}

function StatCard({ label, value, color, sub, prefix="", suffix="" }) {
  return (
    <div style={{
      background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)",
      borderRadius:8, padding:"20px 22px", transition:"border-color 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + "55"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ fontSize:36, fontWeight:900, lineHeight:1, marginBottom:6 }}>
        <Counter value={value} color={color} prefix={prefix} suffix={suffix} />
      </div>
      <div style={{ fontSize:12, color:"#737373", letterSpacing:"0.02em" }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:color, fontWeight:700, marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function LiveDot() {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
      <span style={{
        width:7, height:7, borderRadius:"50%", background:"#46d369", display:"inline-block",
        boxShadow:"0 0 0 0 rgba(70,211,105,0.4)",
        animation:"livePulse 1.5s ease-out infinite",
      }}/>
      <style>{`@keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(70,211,105,0.5)}70%{box-shadow:0 0 0 7px rgba(70,211,105,0)}100%{box-shadow:0 0 0 0 rgba(70,211,105,0)}}`}</style>
      <span style={{ color:"#46d369", fontSize:11, fontWeight:700, letterSpacing:"0.06em" }}>LIVE</span>
    </span>
  );
}

function NewSignalToast({ signal, onClose }) {
  const t = TYPE_META[signal?.signal_type] || { icon:"⚡", color:"#E50914" };
  return (
    <div style={{
      position:"fixed", top:20, right:20, zIndex:9999,
      background:"#1a1a1a", border:`1px solid ${t.color}`,
      borderRadius:10, padding:"16px 20px", maxWidth:360, boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
      animation:"slideInRight 0.35s cubic-bezier(0.22,1,0.36,1)",
    }}>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
        <div>
          <div style={{ color:t.color, fontSize:11, fontWeight:700, marginBottom:4 }}>
            {t.icon} NEW SIGNAL DETECTED
          </div>
          <div style={{ color:"#fff", fontSize:13, fontWeight:600, marginBottom:4 }}>{signal?.account_name}</div>
          <div style={{ color:"#aaa", fontSize:12, lineHeight:1.5 }}>{signal?.title?.slice(0,80)}…</div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16, padding:0 }}>×</button>
      </div>
      <a href={`/dashboard/signals?id=${signal?.id}`} style={{
        display:"block", marginTop:12, background:t.color, color:"#fff",
        padding:"8px 14px", borderRadius:6, fontSize:12, fontWeight:700,
        textDecoration:"none", textAlign:"center",
      }}>View Full Analysis →</a>
    </div>
  );
}

function ActionPlanCard({ plan }) {
  const urgencyColor = { high:"#E50914", medium:"#f5a623", low:"#46d369" };
  if (!plan?.actions?.length) return null;
  return (
    <div style={{
      background:"linear-gradient(135deg, #130c0c 0%, #1a1111 100%)",
      border:"1px solid rgba(229,9,20,0.2)", borderRadius:10, padding:"24px 28px", marginBottom:28,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#E50914", letterSpacing:"0.12em", marginBottom:4 }}>
            📋 TODAY&apos;S ACTION PLAN
          </div>
          <div style={{ color:"#fff", fontSize:16, fontWeight:700 }}>{plan.date}</div>
        </div>
        {plan.streak > 0 && (
          <div style={{ background:"rgba(245,166,35,0.12)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:8, padding:"8px 14px", textAlign:"center" }}>
            <div style={{ fontSize:20 }}>{"🔥".repeat(Math.min(plan.streak, 5))}</div>
            <div style={{ color:"#f5a623", fontSize:11, fontWeight:700, marginTop:3 }}>{plan.streak}-DAY STREAK</div>
          </div>
        )}
      </div>

      <div style={{ display:"grid", gap:10, marginBottom:16 }}>
        {plan.actions.map((a, i) => (
          <div key={i} style={{
            background:"rgba(0,0,0,0.3)", borderRadius:8, padding:"14px 16px",
            borderLeft:`3px solid ${urgencyColor[a.urgency] || "#f5a623"}`,
            display:"flex", gap:14, alignItems:"flex-start",
          }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              background:`${urgencyColor[a.urgency] || "#f5a623"}22`,
              color:urgencyColor[a.urgency] || "#f5a623",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:900, fontSize:14, flexShrink:0,
            }}>{i + 1}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                <span style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{a.company}</span>
                <span style={{ color:"#737373", fontSize:11 }}>{a.country}</span>
                <span style={{
                  background:`${urgencyColor[a.urgency] || "#f5a623"}22`,
                  color:urgencyColor[a.urgency] || "#f5a623",
                  padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700,
                }}>{a.urgency?.toUpperCase()}</span>
              </div>
              <div style={{ color:"#e0e0e0", fontSize:13, marginBottom:4 }}>{a.action}</div>
              <div style={{ color:"#737373", fontSize:11, fontStyle:"italic" }}>{a.why_now}</div>
            </div>
            <a href={`/dashboard/signals?id=${a.signal_id}`} style={{
              padding:"6px 12px", borderRadius:6, background:"rgba(229,9,20,0.15)",
              color:"#E50914", fontSize:11, fontWeight:700, textDecoration:"none", flexShrink:0,
            }}>
              Act →
            </a>
          </div>
        ))}
      </div>

      {plan.motivation && (
        <div style={{ color:"#f5a623", fontSize:13, fontStyle:"italic", textAlign:"center" }}>
          {plan.motivation}
        </div>
      )}
    </div>
  );
}

function ImpactBar({ stats }) {
  if (!stats) return null;
  const pipeline = stats.pipeline_value || 0;
  const won      = stats.won_value || 0;
  const actioned = stats.actioned_signals || 0;
  const total    = stats.total_signals || 1;
  const rate     = Math.round((actioned / total) * 100);
  return (
    <div style={{
      background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)",
      borderRadius:10, padding:"16px 24px", marginBottom:28,
      display:"flex", gap:32, alignItems:"center", flexWrap:"wrap",
    }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#46d369" }}>₹{(pipeline/100000).toFixed(1)}L</div>
        <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Pipeline Value</div>
      </div>
      <div style={{ width:1, height:36, background:"rgba(255,255,255,0.08)" }}/>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#f5a623" }}>₹{(won/100000).toFixed(1)}L</div>
        <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Revenue Won</div>
      </div>
      <div style={{ width:1, height:36, background:"rgba(255,255,255,0.08)" }}/>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ fontSize:12, color:"#aaa" }}>Signal Action Rate</span>
          <span style={{ fontSize:12, fontWeight:700, color:"#E50914" }}>{rate}%</span>
        </div>
        <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
          <div style={{ height:"100%", width:`${rate}%`, background:"linear-gradient(90deg,#E50914,#f5a623)", borderRadius:3, transition:"width 1s ease" }}/>
        </div>
        <div style={{ fontSize:11, color:"#555", marginTop:5 }}>{actioned} of {total} signals actioned</div>
      </div>
    </div>
  );
}

function SignalCard({ s, onAction, onDismiss, onDeal, justCreated, isNew }) {
  const t = TYPE_META[s.signal_type] || { color:"#b3b3b3", label:s.signal_type, icon:"📡" };
  const avatarColor = ["#E50914","#0071eb","#f5a623","#46d369","#a855f7","#58a6ff"][
    (s.company_name?.charCodeAt(0) || 0) % 6
  ];
  return (
    <div style={{
      background: isNew ? "rgba(229,9,20,0.04)" : "#1a1a1a",
      borderRadius:8, padding:"20px 24px", marginBottom:8,
      border: isNew ? "1px solid rgba(229,9,20,0.3)" : "1px solid rgba(255,255,255,0.06)",
      borderLeft: `3px solid ${t.color}`,
      transition:"background 0.15s, transform 0.15s",
      animation: isNew ? "newSignal 0.5s ease" : "none",
    }}
      onMouseEnter={e => { e.currentTarget.style.background="#222"; e.currentTarget.style.transform="translateX(2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.background= isNew ? "rgba(229,9,20,0.04)" : "#1a1a1a"; e.currentTarget.style.transform="translateX(0)"; }}
    >
      <style>{`@keyframes newSignal{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, flex:1 }}>
          <div style={{
            width:40, height:40, borderRadius:6, background:avatarColor,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, fontSize:16, color:"#fff", flexShrink:0,
          }}>
            {s.company_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
              {isNew && <span style={{ background:"#E5091422", color:"#E50914", padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700 }}>NEW</span>}
              <span style={{ background: t.color + "22", color:t.color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{t.icon} {t.label}</span>
              <span style={{ background: STRENGTH_COLOR[s.signal_strength] + "22", color:STRENGTH_COLOR[s.signal_strength], padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                {s.signal_strength?.toUpperCase()}
              </span>
              {s.country_hint && <span style={{ color:"#555", fontSize:11, padding:"3px 0" }}>📍 {s.country_hint}</span>}
              {s.score && <span style={{ color:"#737373", fontSize:11, padding:"3px 0" }}>Score {s.score}/10</span>}
            </div>
            <div style={{ fontWeight:700, fontSize:15, color:"#fff", lineHeight:1.4, marginBottom:4 }}>{s.title}</div>
            <div style={{ fontSize:12, color:"#aaa", lineHeight:1.6 }}>{s.summary}</div>
          </div>
        </div>
        <a href={`/dashboard/signals?id=${s.id}`} style={{
          padding:"6px 12px", borderRadius:6, background:"rgba(255,255,255,0.05)",
          color:"#737373", fontSize:11, textDecoration:"none", flexShrink:0,
          border:"1px solid rgba(255,255,255,0.08)",
        }}>
          Full Analysis →
        </a>
      </div>

      {s.recommended_action && !s.is_actioned && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, color:"#46d369", fontSize:12, marginBottom:12 }}>
          <span style={{ flexShrink:0 }}>💡</span>
          <span style={{ lineHeight:1.5 }}>{s.recommended_action}</span>
        </div>
      )}

      {!s.is_actioned ? (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={() => onDeal(s)} style={{
            padding:"7px 16px", borderRadius:24, background:"#E50914", color:"#fff",
            fontWeight:700, fontSize:12, cursor:"pointer", border:"none",
          }}>
            + Pipeline
          </button>
          <button onClick={() => onAction(s.id)} style={{
            padding:"7px 14px", borderRadius:24,
            background:"rgba(70,211,105,0.1)", border:"1px solid rgba(70,211,105,0.25)",
            color:"#46d369", fontSize:12, fontWeight:600, cursor:"pointer",
          }}>
            ✓ Done
          </button>
          {justCreated && <span style={{ color:"#46d369", fontSize:12, padding:"7px 0" }}>✓ Added to pipeline!</span>}
          <button onClick={() => onDismiss(s.id)} style={{
            padding:"7px 14px", borderRadius:24,
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
            color:"#555", fontSize:12, cursor:"pointer",
          }}>
            Dismiss
          </button>
        </div>
      ) : (
        <div style={{ fontSize:12, color:"#46d369", fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
          <span>✓ Actioned</span>
          <a href={`/dashboard/signals?id=${s.id}`} style={{ fontSize:11, color:"#555", textDecoration:"underline" }}>View →</a>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data,      setData]      = useState(null);
  const [plan,      setPlan]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [seeding,   setSeeding]   = useState(false);
  const [created,   setCreated]   = useState(null);
  const [toast,     setToast]     = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [newSigs,   setNewSigs]   = useState(new Set());
  const [alertSig,  setAlertSig]  = useState(null);
  const [lastCount, setLastCount] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [d, p] = await Promise.all([
      apiFetch("/signals/feed"),
      apiFetch("/signals/action-plan"),
    ]);

    if (d?.feed) {
      // Detect new signals since last load
      if (lastCount !== null && d.feed.length > lastCount) {
        const diff = d.feed.length - lastCount;
        const newIds = new Set(d.feed.slice(0, diff).map(s => s.id));
        setNewSigs(newIds);
        const newest = d.feed[0];
        if (newest) setAlertSig(newest);
        setTimeout(() => setNewSigs(new Set()), 8000);
      }
      setLastCount(d.feed.length);
      setLastCheck(new Date().toLocaleTimeString());
    }

    setData(d);
    if (p?.success) setPlan(p);
    if (!silent) setLoading(false);
  }, [lastCount]);

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
    showToast("Marked as actioned 🔥 Streak building!", "success");
    // Refresh plan after action (streak changed)
    const p = await apiFetch("/signals/action-plan");
    if (p?.success) setPlan(p);
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
      showToast(`✓ ${signal.company_name} added to pipeline!`, "success");
    }
  }

  // Initial load
  useEffect(() => { load(); }, []); // eslint-disable-line

  // Auto-refresh every 30s
  useEffect(() => {
    timerRef.current = setInterval(() => load(true), LIVE_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const stats   = data?.stats || {};
  const feed    = data?.feed  || [];
  const high    = feed.filter(s => s.signal_strength === "high" && !s.is_actioned);
  const topSig  = high[0] || feed[0];

  const displayed = feed.filter(s => {
    if (filter === "high")       return s.signal_strength === "high";
    if (filter === "unactioned") return !s.is_actioned;
    return true;
  });

  const grouped = {
    "🔴 Act Now":           feed.filter(s => s.signal_strength === "high" && !s.is_actioned),
    "🌍 Expansion Signals": feed.filter(s => ["new_country_page","expansion","new_product"].includes(s.signal_type)),
    "💰 Market Intel":      feed.filter(s => ["pricing_change","partner_page"].includes(s.signal_type)),
    "👤 Org Changes":       feed.filter(s => ["leadership_change","hiring_spike"].includes(s.signal_type)),
    "⚖️ Compliance":        feed.filter(s => s.signal_type === "compliance_update"),
  };

  return (
    <div>
      {/* New signal alert toast */}
      {alertSig && (
        <NewSignalToast signal={alertSig} onClose={() => setAlertSig(null)} />
      )}

      {/* Bottom toast */}
      {toast && (
        <div style={{
          position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)", zIndex:9998,
          background: toast.type === "success" ? "#1a2e1a" : toast.type === "info" ? "#1a1a2e" : "#2e1a1a",
          border: `1px solid ${toast.type === "success" ? "#46d369" : toast.type === "info" ? "#0071eb" : "#E50914"}`,
          color:"#fff", padding:"12px 24px", borderRadius:8, fontSize:13, fontWeight:600,
          boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
          animation:"slideUp 0.3s ease",
        }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
            <h1 style={{ fontSize:26, fontWeight:900, color:"#fff", margin:0 }}>Signal Intelligence</h1>
            <LiveDot />
          </div>
          <p style={{ color:"#555", fontSize:12, margin:0 }}>
            Auto-refreshes every 30s
            {lastCheck && <span style={{ color:"#737373" }}> · Last updated {lastCheck}</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {feed.length > 0 && (
            <button onClick={async () => {
              const d = await apiFetch("/signals/export/csv-data");
              if (d.success) {
                const rows = d.rows;
                const keys = Object.keys(rows[0] || {});
                const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${String(r[k]??'').replace(/"/g,'""')}"`).join(","))].join("\n");
                const blob = new Blob([csv], { type:"text/csv" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "signals.csv"; a.click();
              }
            }} style={{
              padding:"8px 16px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
              background:"rgba(70,211,105,0.08)", border:"1px solid rgba(70,211,105,0.2)", color:"#46d369",
            }}>
              ↓ Export CSV
            </button>
          )}
          <button onClick={() => seed()} disabled={seeding} style={{
            padding:"8px 20px", borderRadius:6,
            background: seeding ? "rgba(229,9,20,0.4)" : "#E50914",
            color:"#fff", fontWeight:700, fontSize:12, cursor: seeding ? "not-allowed" : "pointer", border:"none",
          }}>
            {seeding ? "Loading…" : feed.length > 0 ? "↺ Refresh" : "⚡ Load Demo Signals"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        <StatCard label="Total Signals"  value={stats.total || 0}          color="#fff"     />
        <StatCard label="High Priority"  value={stats.high_priority || 0}  color="#E50914"  sub={stats.high_priority > 0 ? "Act today" : null} />
        <StatCard label="Actioned"       value={stats.actioned || 0}        color="#46d369"  sub={plan?.streak > 0 ? `🔥 ${plan.streak}-day streak` : null} />
        <StatCard label="In Pipeline"    value={plan?.stats?.active_deals || 0} color="#f5a623" />
      </div>

      {/* Revenue impact bar */}
      {plan?.stats && <ImpactBar stats={plan.stats} />}

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
          <div style={{ width:22, height:22, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading signals…
        </div>
      )}

      {!loading && feed.length === 0 && (
        <div style={{ background:"#1a1a1a", borderRadius:10, padding:"72px 32px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>📡</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:8 }}>No signals yet</div>
          <div style={{ color:"#737373", fontSize:14, maxWidth:380, margin:"0 auto 28px", lineHeight:1.7 }}>
            Load demo signals to see hiring spikes, country expansions, pricing changes, and more — updated live.
          </div>
          <button onClick={seed} disabled={seeding} style={{
            padding:"14px 36px", borderRadius:24, background:"#E50914", color:"#fff",
            fontWeight:700, fontSize:15, cursor:"pointer", border:"none",
          }}>
            {seeding ? "Loading…" : "⚡ Load Demo Signals"}
          </button>
        </div>
      )}

      {!loading && feed.length > 0 && (
        <>
          {/* Today's Action Plan */}
          <ActionPlanCard plan={plan} />

          {/* Signal of the Day hero */}
          {topSig && (
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#E50914", letterSpacing:"0.12em", marginBottom:10 }}>⚡ SIGNAL OF THE DAY</div>
              <div style={{
                background:"linear-gradient(135deg, #1a1a1a 0%, #1f1a1a 100%)",
                border:"1px solid rgba(229,9,20,0.25)", borderRadius:10, padding:"28px 32px",
                position:"relative", overflow:"hidden",
              }}>
                <div style={{ position:"absolute", top:0, right:0, width:240, height:240, background:"radial-gradient(circle, rgba(229,9,20,0.07) 0%, transparent 70%)", pointerEvents:"none" }}/>
                {(() => {
                  const t = TYPE_META[topSig.signal_type] || { color:"#b3b3b3", label:topSig.signal_type, icon:"📡" };
                  return (
                    <>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                        <span style={{ background:t.color+"22", color:t.color, padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700 }}>{t.icon} {t.label}</span>
                        <span style={{ background:"rgba(229,9,20,0.15)", color:"#E50914", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>Score {topSig.score}/10</span>
                        {topSig.country_hint && <span style={{ color:"#737373", fontSize:12, padding:"3px 0" }}>📍 {topSig.country_hint}</span>}
                      </div>
                      <div style={{ fontSize:20, fontWeight:800, color:"#fff", lineHeight:1.4, marginBottom:8 }}>{topSig.title}</div>
                      <div style={{ fontSize:13, color:"#b3b3b3", lineHeight:1.7, marginBottom:16 }}>{topSig.summary}</div>
                      {topSig.recommended_action && (
                        <div style={{ display:"flex", gap:8, color:"#46d369", fontSize:13, marginBottom:20 }}>
                          <span style={{ fontWeight:700, flexShrink:0 }}>💡</span>
                          <span>{topSig.recommended_action}</span>
                        </div>
                      )}
                      {!topSig.is_actioned && (
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={() => createDeal(topSig)} style={{ padding:"10px 22px", borderRadius:24, background:"#E50914", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", border:"none" }}>+ Add to Pipeline</button>
                          <button onClick={() => action(topSig.id)} style={{ padding:"10px 18px", borderRadius:24, background:"rgba(70,211,105,0.1)", border:"1px solid rgba(70,211,105,0.3)", color:"#46d369", fontSize:13, fontWeight:600, cursor:"pointer" }}>✓ Mark Done</button>
                          <a href={`/dashboard/signals?id=${topSig.id}`} style={{ padding:"10px 18px", borderRadius:24, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#aaa", fontSize:13, textDecoration:"none" }}>Full Analysis →</a>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ display:"flex", gap:8, marginBottom:20, alignItems:"center", flexWrap:"wrap" }}>
            {[
              { key:"all",        label:`All (${feed.length})` },
              { key:"high",       label:`🔴 High (${high.length})` },
              { key:"unactioned", label:`Unactioned (${feed.filter(s=>!s.is_actioned).length})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding:"7px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                background: filter === f.key ? "#E50914" : "rgba(255,255,255,0.05)",
                color: filter === f.key ? "#fff" : "#b3b3b3",
                border: filter === f.key ? "none" : "1px solid rgba(255,255,255,0.08)",
                transition:"all 0.15s",
              }}>{f.label}</button>
            ))}
          </div>

          {/* Signal rows */}
          {filter === "all" ? (
            Object.entries(grouped)
              .filter(([,items]) => items.length > 0)
              .map(([rowTitle, items]) => (
                <div key={rowTitle} style={{ marginBottom:36 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:"#fff", marginBottom:12 }}>
                    {rowTitle}
                    <span style={{ fontSize:12, color:"#737373", fontWeight:400, marginLeft:8 }}>{items.length}</span>
                  </div>
                  {items.map(s => (
                    <SignalCard key={s.id} s={s}
                      onAction={action} onDismiss={dismiss} onDeal={createDeal}
                      justCreated={created === s.id}
                      isNew={newSigs.has(s.id)}
                    />
                  ))}
                </div>
              ))
          ) : (
            <div>
              {displayed.length === 0 ? (
                <div style={{ background:"#1a1a1a", borderRadius:8, padding:40, textAlign:"center", color:"#737373" }}>
                  No signals match this filter.
                </div>
              ) : (
                displayed.map(s => (
                  <SignalCard key={s.id} s={s}
                    onAction={action} onDismiss={dismiss} onDeal={createDeal}
                    justCreated={created === s.id}
                    isNew={newSigs.has(s.id)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
