"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";

const INDUSTRIES = [
  "SaaS","Fintech","IT Services","Logistics","Manufacturing",
  "Healthcare","Ecommerce","HR Tech","Legal","Education",
  "Media","Pharma","Clean Energy","Real Estate","Construction",
];

const SIGNAL_TYPES = [
  { key:"hiring_spike",      color:"#E50914", label:"Hiring Spike",   icon:"📈" },
  { key:"new_country_page",  color:"#0071eb", label:"Expansion",      icon:"🌍" },
  { key:"pricing_change",    color:"#f5a623", label:"Price Change",   icon:"💰" },
  { key:"leadership_change", color:"#a855f7", label:"Leadership",     icon:"👤" },
  { key:"new_product",       color:"#46d369", label:"New Product",    icon:"🚀" },
  { key:"compliance_update", color:"#e87c03", label:"Compliance",     icon:"⚖️"  },
];

const AVATAR_COLORS = ["#E50914","#0071eb","#f5a623","#46d369","#a855f7","#58a6ff"];

const S = {
  input:  { width:"100%", padding:"11px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13 },
  label:  { fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:6, display:"block" },
};

export default function WatchlistPage() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({ company_name:"", website:"", industry:"SaaS", country:"" });
  const [adding,   setAdding]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast,    setToast]    = useState(null);

  const showT = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/watchlist");
    if (d.success) setItems(d.watchlist || []);
    setLoading(false);
  }

  async function add(e) {
    e.preventDefault(); setAdding(true);
    const r = await apiFetch("/watchlist", { method:"POST", body: JSON.stringify(form) });
    if (r.success) {
      setShowForm(false);
      setForm({ company_name:"", website:"", industry:"SaaS", country:"" });
      await load();
      showT(`${form.company_name} added to watchlist`);
    } else {
      showT(r.detail || "Could not add company", "error");
    }
    setAdding(false);
  }

  async function remove(id, name) {
    await apiFetch(`/watchlist/${id}`, { method:"DELETE" });
    setItems(i => i.filter(x => x.id !== id));
    showT(`${name} removed`, "info");
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      {toast && (
        <div style={{
          position:"fixed", bottom:32, right:32, zIndex:999,
          background: toast.type === "success" ? "#46d369" : toast.type === "error" ? "#E50914" : "#737373",
          color:"#fff", padding:"12px 20px", borderRadius:6,
          fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
          animation:"slideUp 0.3s ease",
        }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {toast.type === "success" ? "✓" : toast.type === "error" ? "✗" : "ℹ"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Watchlist</h1>
          <p style={{ color:"#737373", fontSize:13 }}>Monitor companies for web changes — hiring, expansions, pricing shifts, leadership moves.</p>
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          padding:"10px 22px", borderRadius:6,
          background: showForm ? "rgba(255,255,255,0.08)" : "#E50914",
          color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", border:"none",
        }}>
          {showForm ? "Cancel" : "+ Add Company"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"14px 22px" }}>
          <div style={{ fontSize:24, fontWeight:900, color:"#fff" }}>{items.length}</div>
          <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Companies Watched</div>
        </div>
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"14px 22px" }}>
          <div style={{ fontSize:24, fontWeight:900, color:"#E50914" }}>
            {[...new Set(items.map(i => i.country).filter(Boolean))].length}
          </div>
          <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Countries</div>
        </div>
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"14px 22px" }}>
          <div style={{ fontSize:24, fontWeight:900, color:"#f5a623" }}>
            {[...new Set(items.map(i => i.industry).filter(Boolean))].length}
          </div>
          <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Industries</div>
        </div>
      </div>

      {/* What we monitor */}
      {!showForm && items.length === 0 && !loading && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
          {SIGNAL_TYPES.map(t => (
            <div key={t.key} style={{ background:t.color+"12", border:`1px solid ${t.color}22`, borderRadius:20, padding:"6px 14px", display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
              <span>{t.icon}</span>
              <span style={{ color:t.color, fontWeight:600 }}>{t.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add company form */}
      {showForm && (
        <div style={{ background:"#141414", border:"1px solid rgba(229,9,20,0.2)", borderRadius:8, padding:"24px", marginBottom:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:18 }}>Add Company to Watchlist</div>
          <form onSubmit={add} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div>
              <label style={S.label}>COMPANY NAME *</label>
              <input style={S.input} placeholder="e.g. Freshworks" value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name:e.target.value }))} required />
            </div>
            <div>
              <label style={S.label}>WEBSITE</label>
              <input style={S.input} placeholder="freshworks.com" value={form.website}
                onChange={e => setForm(f => ({ ...f, website:e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>INDUSTRY</label>
              <select style={S.input} value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry:e.target.value }))}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>COUNTRY</label>
              <input style={S.input} placeholder="e.g. USA" value={form.country}
                onChange={e => setForm(f => ({ ...f, country:e.target.value }))} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <button type="submit" disabled={adding} style={{
                width:"100%", padding:"13px", borderRadius:6, background:"#E50914", color:"#fff",
                fontWeight:700, fontSize:14, cursor:"pointer", border:"none", opacity: adding ? 0.7 : 1,
              }}>
                {adding ? "Adding…" : "Add to Watchlist →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading watchlist…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ background:"#1a1a1a", borderRadius:8, padding:"72px 32px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>👁</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>No companies on watchlist</div>
          <div style={{ color:"#737373", fontSize:14, maxWidth:360, margin:"0 auto 24px" }}>
            Add competitor or target companies to get alerted when they post new jobs, expand to new markets, or change pricing.
          </div>
          <button onClick={() => setShowForm(true)} style={{ padding:"13px 32px", borderRadius:24, background:"#E50914", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", border:"none" }}>
            + Add First Company
          </button>
        </div>
      )}

      {/* Company cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px,1fr))", gap:12 }}>
        {items.map(item => {
          const avatarColor = AVATAR_COLORS[(item.company_name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
          return (
            <div key={item.id} style={{
              background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:8, padding:"20px 22px",
              transition:"background 0.15s, border-color 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background="#222"; e.currentTarget.style.borderColor="rgba(255,255,255,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#1a1a1a"; e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{
                    width:44, height:44, borderRadius:8, background:avatarColor,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:900, fontSize:18, color:"#fff",
                  }}>
                    {item.company_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>{item.company_name}</div>
                    {item.website && (
                      <a href={`https://${item.website}`} target="_blank" rel="noreferrer"
                        style={{ fontSize:12, color:"#737373", textDecoration:"underline" }}>
                        {item.website}
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(item.id, item.company_name)} style={{
                  padding:"6px 12px", borderRadius:20, background:"transparent",
                  border:"1px solid rgba(229,9,20,0.2)", color:"#E50914",
                  fontSize:11, cursor:"pointer", fontWeight:600,
                }}>
                  Remove
                </button>
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {item.industry && (
                  <span style={{ background:"rgba(229,9,20,0.1)", color:"#E50914", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                    {item.industry}
                  </span>
                )}
                {item.country && (
                  <span style={{ color:"#737373", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
                    📍 {item.country}
                  </span>
                )}
              </div>

              {/* What we track */}
              <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize:10, color:"#3a3a3a", fontWeight:700, letterSpacing:"0.1em", marginBottom:8 }}>MONITORING</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {SIGNAL_TYPES.slice(0,4).map(t => (
                    <span key={t.key} style={{ fontSize:11, color:"#737373", display:"flex", alignItems:"center", gap:3 }}>
                      {t.icon} {t.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
