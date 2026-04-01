"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";

const STATUS_META = {
  new:       { color:"#0071eb", label:"New",       bg:"rgba(0,113,235,0.12)"  },
  contacted: { color:"#f5a623", label:"Contacted", bg:"rgba(245,166,35,0.12)" },
  qualified: { color:"#46d369", label:"Qualified", bg:"rgba(70,211,105,0.12)" },
  rejected:  { color:"#E50914", label:"Rejected",  bg:"rgba(229,9,20,0.12)"   },
  converted: { color:"#a855f7", label:"Converted", bg:"rgba(168,85,247,0.12)" },
};

const AVATAR_COLORS = ["#E50914","#0071eb","#f5a623","#46d369","#a855f7","#58a6ff","#e87c03","#34d399"];

const S = {
  input: { width:"100%", padding:"11px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13 },
  label: { fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:6, display:"block" },
};

function LeadScore({ score }) {
  const color = score >= 75 ? "#46d369" : score >= 50 ? "#f5a623" : score >= 25 ? "#e87c03" : "#737373";
  return (
    <div style={{
      width:40, height:40, borderRadius:"50%",
      border:`2px solid ${color}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      flexShrink:0, flexDirection:"column",
    }}>
      <span style={{ fontSize:12, fontWeight:800, color }}>{score || "—"}</span>
    </div>
  );
}

export default function LeadsPage() {
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ name:"", email:"", company:"", country:"", title:"", industry:"", source:"manual" });
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState("");
  const [statusF,  setStatusF]  = useState("all");
  const [toast,    setToast]    = useState(null);

  const showT = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/leads");
    if (d.success) setLeads(d.leads || []);
    setLoading(false);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true);
    const r = await apiFetch("/leads", { method:"POST", body: JSON.stringify(form) });
    if (r.success) {
      setShowForm(false);
      setForm({ name:"", email:"", company:"", country:"", title:"", industry:"", source:"manual" });
      await load();
      showT(`${form.name} added to leads`);
    }
    setSaving(false);
  }

  async function updateStatus(id, status) {
    await apiFetch(`/leads/${id}`, { method:"PATCH", body: JSON.stringify({ status }) });
    setLeads(l => l.map(x => x.id === id ? { ...x, status } : x));
    if (status === "converted") showT("🎉 Lead converted!");
  }

  useEffect(() => { load(); }, []);

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.company?.toLowerCase().includes(search.toLowerCase()) ||
      l.country?.toLowerCase().includes(search.toLowerCase()) ||
      l.industry?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusF === "all" || l.status === statusF;
    return matchSearch && matchStatus;
  });

  // Stats
  const counts = Object.keys(STATUS_META).reduce((a, s) => ({ ...a, [s]: leads.filter(l => l.status === s).length }), {});

  return (
    <div>
      {toast && (
        <div style={{
          position:"fixed", bottom:32, right:32, zIndex:999, background:"#46d369",
          color:"#fff", padding:"12px 20px", borderRadius:6, fontSize:13, fontWeight:600,
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)", animation:"slideUp 0.3s ease",
        }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Leads</h1>
          <p style={{ color:"#737373", fontSize:13 }}>Your global prospect database — every contact, every country.</p>
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          padding:"10px 22px", borderRadius:6, background: showForm ? "rgba(255,255,255,0.08)" : "#E50914",
          color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", border:"none",
        }}>
          {showForm ? "Cancel" : "+ Add Lead"}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"14px 20px", minWidth:100 }}>
          <div style={{ fontSize:24, fontWeight:900, color:"#fff" }}>{leads.length}</div>
          <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Total Leads</div>
        </div>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div key={key} style={{ background:"#1a1a1a", border:`1px solid ${meta.color}22`, borderRadius:6, padding:"14px 20px", minWidth:100, cursor:"pointer" }}
            onClick={() => setStatusF(statusF === key ? "all" : key)}>
            <div style={{ fontSize:24, fontWeight:900, color:meta.color }}>{counts[key] || 0}</div>
            <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>{meta.label}</div>
          </div>
        ))}
      </div>

      {/* Add lead form */}
      {showForm && (
        <div style={{ background:"#141414", border:"1px solid rgba(229,9,20,0.2)", borderRadius:8, padding:"24px", marginBottom:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:18 }}>New Lead</div>
          <form onSubmit={save} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[
              ["FULL NAME *","name","Full name",true],
              ["EMAIL","email","Work email",false],
              ["COMPANY","company","Company name",false],
              ["COUNTRY","country","e.g. Germany",false],
              ["JOB TITLE","title","VP Sales",false],
              ["INDUSTRY","industry","SaaS / Fintech…",false],
            ].map(([lbl,key,ph,req]) => (
              <div key={key}>
                <label style={S.label}>{lbl}</label>
                <input style={S.input} placeholder={ph} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]:e.target.value }))} required={req} />
              </div>
            ))}
            <div style={{ gridColumn:"1/-1" }}>
              <button type="submit" disabled={saving} style={{
                width:"100%", padding:"13px", borderRadius:6, background:"#E50914", color:"#fff",
                fontWeight:700, fontSize:14, cursor:"pointer", border:"none", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Saving…" : "Add Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search by name, company, country, industry…"
          style={{ ...S.input, maxWidth:380, background:"#1a1a1a" }} />
        {statusF !== "all" && (
          <button onClick={() => setStatusF("all")} style={{
            padding:"8px 14px", borderRadius:20, background:"rgba(229,9,20,0.15)",
            border:"1px solid rgba(229,9,20,0.3)", color:"#E50914", fontSize:12, fontWeight:600, cursor:"pointer",
          }}>
            ✕ {STATUS_META[statusF]?.label}
          </button>
        )}
        {filtered.length !== leads.length && (
          <span style={{ color:"#737373", fontSize:12 }}>Showing {filtered.length} of {leads.length}</span>
        )}
      </div>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading leads…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ background:"#1a1a1a", borderRadius:8, padding:"56px 32px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🎯</div>
          <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:8 }}>
            {search || statusF !== "all" ? "No leads match your filter" : "No leads yet"}
          </div>
          <div style={{ color:"#737373", fontSize:13, marginBottom:24 }}>
            {search || statusF !== "all" ? "Try a different search or filter." : "Add your first lead or import from signals on the Home page."}
          </div>
          {!search && statusF === "all" && (
            <button onClick={() => setShowForm(true)} style={{ padding:"12px 28px", borderRadius:24, background:"#E50914", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", border:"none" }}>
              + Add First Lead
            </button>
          )}
        </div>
      )}

      {/* Lead list */}
      {filtered.map(lead => {
        const status = STATUS_META[lead.status || "new"];
        const avatarColor = AVATAR_COLORS[(lead.name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
        const score = lead.lead_score || lead.score || 0;
        return (
          <div key={lead.id} style={{
            background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:6, padding:"16px 20px", marginBottom:8,
            transition:"background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background="#222"}
            onMouseLeave={e => e.currentTarget.style.background="#1a1a1a"}
          >
            <div style={{ display:"flex", alignItems:"center", gap:14, justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
                {/* Avatar */}
                <div style={{
                  width:40, height:40, borderRadius:6, background:avatarColor,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:800, fontSize:16, color:"#fff", flexShrink:0,
                }}>
                  {lead.name?.[0]?.toUpperCase() || "?"}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:2 }}>{lead.name}</div>
                  <div style={{ fontSize:12, color:"#b3b3b3", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {[lead.title, lead.company].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
                    {lead.country  && <span style={{ color:"#737373", fontSize:11 }}>📍 {lead.country}</span>}
                    {lead.industry && <span style={{ background:"rgba(229,9,20,0.08)", color:"#E50914", padding:"1px 8px", borderRadius:10, fontSize:11, fontWeight:700 }}>{lead.industry}</span>}
                    {lead.email    && <span style={{ color:"#737373", fontSize:11 }}>✉ {lead.email}</span>}
                    {lead.source && lead.source !== "manual" && (
                      <span style={{ background:"rgba(255,255,255,0.05)", color:"#b3b3b3", padding:"1px 8px", borderRadius:10, fontSize:10 }}>{lead.source}</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                {score > 0 && <LeadScore score={score} />}

                {/* Status badge / dropdown */}
                <select
                  value={lead.status || "new"}
                  onChange={e => updateStatus(lead.id, e.target.value)}
                  style={{
                    padding:"7px 12px", background:status.bg,
                    border:`1px solid ${status.color}44`,
                    borderRadius:20, color:status.color,
                    fontSize:12, fontWeight:700, cursor:"pointer",
                  }}
                >
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
