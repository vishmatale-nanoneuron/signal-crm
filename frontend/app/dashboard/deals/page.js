"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";

const STAGES = [
  { key:"signal",      label:"Signal",      color:"#737373", prob:10  },
  { key:"qualified",   label:"Qualified",   color:"#0071eb", prob:25  },
  { key:"proposal",    label:"Proposal",    color:"#f5a623", prob:50  },
  { key:"negotiation", label:"Negotiation", color:"#a855f7", prob:75  },
  { key:"won",         label:"Won",         color:"#46d369", prob:100 },
  { key:"lost",        label:"Lost",        color:"#E50914", prob:0   },
];
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));

const S = {
  input: { width:"100%", padding:"11px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13 },
  label: { fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:6, display:"block" },
};

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const bg = type === "success" ? "#46d369" : type === "warn" ? "#f5a623" : "#E50914";
  return (
    <div style={{
      position:"fixed", bottom:32, right:32, zIndex:999,
      background:bg, color:"#fff", padding:"12px 20px",
      borderRadius:6, fontSize:13, fontWeight:600,
      boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
      animation:"slideUp 0.3s ease",
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      ✓ {msg}
    </div>
  );
}

function DealCard({ deal, onStageChange, onDelete }) {
  const stage = STAGE_MAP[deal.stage] || STAGE_MAP.signal;
  return (
    <div style={{
      background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)",
      borderTop: `2px solid ${stage.color}`,
      borderRadius:6, padding:"14px 16px", marginBottom:8,
      transition:"background 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background="#222"}
      onMouseLeave={e => e.currentTarget.style.background="#1a1a1a"}
    >
      <div style={{ fontWeight:700, fontSize:13, color:"#fff", marginBottom:4, lineHeight:1.4 }}>{deal.title}</div>
      {deal.company_name && (
        <div style={{ fontSize:12, color:"#b3b3b3", marginBottom:4 }}>🏢 {deal.company_name}</div>
      )}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
        {deal.country && <span style={{ color:"#737373", fontSize:11 }}>📍 {deal.country}</span>}
        {deal.value_usd > 0 && (
          <span style={{ fontSize:13, color:"#46d369", fontWeight:700 }}>
            ${deal.value_usd?.toLocaleString()}
          </span>
        )}
        <span style={{ fontSize:10, background:"rgba(255,255,255,0.06)", color:"#b3b3b3", padding:"2px 7px", borderRadius:10 }}>
          {stage.prob}% win
        </span>
      </div>
      {deal.next_action && (
        <div style={{ fontSize:11, color:"#737373", marginBottom:10, lineHeight:1.5, borderLeft:"2px solid rgba(255,255,255,0.08)", paddingLeft:8 }}>
          → {deal.next_action}
        </div>
      )}
      <select value={deal.stage} onChange={e => onStageChange(deal.id, e.target.value)}
        style={{ width:"100%", padding:"7px 10px", background:"#232323", border:"1px solid rgba(255,255,255,0.1)", borderRadius:4, color:stage.color, fontSize:11, fontWeight:700, cursor:"pointer" }}>
        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </div>
  );
}

export default function DealsPage() {
  const [deals,     setDeals]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ title:"", company_name:"", country:"", value_usd:"", stage:"qualified", next_action:"" });
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);
  const [viewMode,  setViewMode]  = useState("kanban"); // kanban | list

  const showT = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/deals");
    if (d.success) setDeals(d.deals || []);
    setLoading(false);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true);
    const r = await apiFetch("/deals", { method:"POST", body: JSON.stringify({ ...form, value_usd: Number(form.value_usd) || 0 }) });
    if (r.success) {
      setShowForm(false);
      setForm({ title:"", company_name:"", country:"", value_usd:"", stage:"qualified", next_action:"" });
      await load();
      showT("Deal created!");
    }
    setSaving(false);
  }

  async function updateStage(id, stage) {
    await apiFetch(`/deals/${id}`, { method:"PATCH", body: JSON.stringify({ stage }) });
    setDeals(d => d.map(x => x.id === id ? { ...x, stage } : x));
    if (stage === "won") showT("🎉 Deal marked as Won!", "success");
  }

  useEffect(() => { load(); }, []);

  // Pipeline metrics
  const active   = deals.filter(d => !["won","lost"].includes(d.stage));
  const won      = deals.filter(d => d.stage === "won");
  const lost     = deals.filter(d => d.stage === "lost");
  const totalVal = active.reduce((a, d) => a + (d.value_usd || 0), 0);
  const wonVal   = won.reduce((a, d) => a + (d.value_usd || 0), 0);
  const winRate  = won.length + lost.length > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

  const byStage  = STAGES.reduce((a, s) => ({ ...a, [s.key]: deals.filter(d => d.stage === s.key) }), {});

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Deal Pipeline</h1>
          <p style={{ color:"#737373", fontSize:13 }}>Track every deal from signal to closed revenue.</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:6, padding:3, gap:2 }}>
            {[["kanban","⬛ Kanban"],["list","☰ List"]].map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding:"7px 14px", borderRadius:4, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                background: viewMode === mode ? "#E50914" : "transparent",
                color: viewMode === mode ? "#fff" : "#737373",
              }}>{label}</button>
            ))}
          </div>
          <button onClick={() => setShowForm(f => !f)} style={{
            padding:"10px 22px", borderRadius:6, background: showForm ? "rgba(255,255,255,0.08)" : "#E50914",
            color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", border:"none",
          }}>
            {showForm ? "Cancel" : "+ New Deal"}
          </button>
        </div>
      </div>

      {/* Pipeline metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:28 }}>
        {[
          { label:"Active Pipeline", val: totalVal > 0 ? `$${totalVal.toLocaleString()}` : deals.length + " deals", color:"#fff" },
          { label:"Revenue Won",     val: wonVal > 0 ? `$${wonVal.toLocaleString()}` : won.length + " deals",       color:"#46d369" },
          { label:"Win Rate",        val: winRate + "%",                                                             color: winRate > 50 ? "#46d369" : winRate > 25 ? "#f5a623" : "#E50914" },
          { label:"In Pipeline",     val: active.length + " deals",                                                  color:"#f5a623" },
        ].map(m => (
          <div key={m.label} style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"20px 22px" }}>
            <div style={{ fontSize:28, fontWeight:900, color:m.color, marginBottom:4 }}>{m.val}</div>
            <div style={{ fontSize:12, color:"#737373" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Add deal form */}
      {showForm && (
        <div style={{ background:"#141414", border:"1px solid rgba(229,9,20,0.2)", borderRadius:8, padding:"24px", marginBottom:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:18 }}>New Deal</div>
          <form onSubmit={save} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[
              ["DEAL TITLE *","title","e.g. Freshworks DACH Expansion",true],
              ["COMPANY","company_name","Company name",false],
              ["COUNTRY","country","e.g. Germany",false],
              ["VALUE (USD)","value_usd","0",false],
            ].map(([lbl,key,ph,req]) => (
              <div key={key}>
                <label style={S.label}>{lbl}</label>
                <input style={S.input} placeholder={ph} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]:e.target.value }))} required={req} />
              </div>
            ))}
            <div>
              <label style={S.label}>STAGE</label>
              <select style={S.input} value={form.stage} onChange={e => setForm(f => ({ ...f, stage:e.target.value }))}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>NEXT ACTION</label>
              <input style={S.input} placeholder="e.g. Send proposal by Friday" value={form.next_action}
                onChange={e => setForm(f => ({ ...f, next_action:e.target.value }))} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <button type="submit" disabled={saving} style={{
                width:"100%", padding:"13px", borderRadius:6, background:"#E50914", color:"#fff",
                fontWeight:700, fontSize:14, cursor:"pointer", border:"none", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Creating…" : "Create Deal"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading pipeline…
        </div>
      )}

      {!loading && deals.length === 0 && (
        <div style={{ background:"#1a1a1a", borderRadius:8, padding:"72px 32px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>💼</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>No deals yet</div>
          <div style={{ color:"#737373", fontSize:14, marginBottom:24 }}>Add a deal from a signal on the Home page, or create one manually.</div>
          <button onClick={() => setShowForm(true)} style={{ padding:"13px 32px", borderRadius:24, background:"#E50914", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", border:"none" }}>
            + New Deal
          </button>
        </div>
      )}

      {/* Kanban view */}
      {!loading && deals.length > 0 && viewMode === "kanban" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {STAGES.map(stage => {
            const stageDeal = byStage[stage.key] || [];
            const stageVal  = stageDeal.reduce((a, d) => a + (d.value_usd || 0), 0);
            return (
              <div key={stage.key}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:stage.color }}/>
                    <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{stage.label}</span>
                    <span style={{ fontSize:12, background:"rgba(255,255,255,0.06)", color:"#b3b3b3", padding:"1px 7px", borderRadius:10 }}>
                      {stageDeal.length}
                    </span>
                  </div>
                  {stageVal > 0 && (
                    <span style={{ fontSize:11, color:"#46d369", fontWeight:700 }}>${stageVal.toLocaleString()}</span>
                  )}
                </div>
                <div style={{ minHeight:80 }}>
                  {stageDeal.map(d => (
                    <DealCard key={d.id} deal={d} onStageChange={updateStage} />
                  ))}
                  {stageDeal.length === 0 && (
                    <div style={{ border:"1px dashed rgba(255,255,255,0.06)", borderRadius:6, padding:"20px", textAlign:"center", color:"#3a3a3a", fontSize:12 }}>
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {!loading && deals.length > 0 && viewMode === "list" && (
        <div>
          {deals.map(d => {
            const stage = STAGE_MAP[d.stage] || STAGE_MAP.signal;
            return (
              <div key={d.id} style={{
                background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)",
                borderLeft:`3px solid ${stage.color}`,
                borderRadius:6, padding:"16px 20px", marginBottom:8,
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:16,
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#fff", marginBottom:2 }}>{d.title}</div>
                  <div style={{ fontSize:12, color:"#737373" }}>
                    {d.company_name && <span>{d.company_name}</span>}
                    {d.country && <span> · 📍 {d.country}</span>}
                  </div>
                </div>
                {d.value_usd > 0 && <span style={{ fontSize:14, color:"#46d369", fontWeight:700 }}>${d.value_usd?.toLocaleString()}</span>}
                <select value={d.stage} onChange={e => updateStage(d.id, e.target.value)}
                  style={{ padding:"7px 12px", background:"#232323", border:"1px solid rgba(255,255,255,0.1)", borderRadius:4, color:stage.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
