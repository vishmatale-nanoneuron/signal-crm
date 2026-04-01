"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";

const INDUSTRIES = [
  "SaaS","Fintech","IT Services","Logistics","Manufacturing",
  "Healthcare","Ecommerce","HR Tech","Legal","Education","Exporters",
  "Media","Pharma","Clean Energy","Real Estate","Construction",
];

const PRIORITY_META = {
  high:   { color:"#E50914", label:"High",   bg:"rgba(229,9,20,0.12)" },
  medium: { color:"#f5a623", label:"Medium", bg:"rgba(245,166,35,0.12)" },
  low:    { color:"#737373", label:"Low",    bg:"rgba(115,115,115,0.12)" },
};

const S = {
  input: { width:"100%", padding:"10px 13px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13, boxSizing:"border-box" },
  label: { fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:5, display:"block" },
  th:    { padding:"10px 14px", fontSize:11, fontWeight:700, color:"#737373", letterSpacing:"0.08em", textAlign:"left", borderBottom:"1px solid rgba(255,255,255,0.06)", whiteSpace:"nowrap" },
  td:    { padding:"14px", fontSize:13, color:"#e5e5e5", borderBottom:"1px solid rgba(255,255,255,0.04)", verticalAlign:"middle" },
};

export default function WatchlistPage() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({ company_name:"", domain:"", industry:"SaaS", country:"", priority:"medium" });
  const [adding,   setAdding]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [scanning, setScanning] = useState({});  // accountId → true/false
  const [scanResults, setScanResults] = useState({});  // accountId → { signals_found }
  const [search,   setSearch]   = useState("");

  const showT = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/watchlist");
    if (d.success) setItems(d.accounts || []);
    setLoading(false);
  }

  async function add(e) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setAdding(true);
    const payload = { ...form, domain: form.domain || form.company_name.toLowerCase().replace(/\s+/g, "") + ".com" };
    const r = await apiFetch("/watchlist", { method:"POST", body: JSON.stringify(payload) });
    if (r.success) {
      setShowForm(false);
      setForm({ company_name:"", domain:"", industry:"SaaS", country:"", priority:"medium" });
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

  async function scanNow(item) {
    if (!item.domain) { showT("Add a domain first to scan this company", "error"); return; }
    setScanning(s => ({ ...s, [item.id]: true }));
    const r = await apiFetch(`/detect/scan/${item.id}`, { method:"POST" });
    if (!r.success) { setScanning(s => ({ ...s, [item.id]: false })); showT(r.detail || "Scan failed", "error"); return; }
    showT(`Scanning ${item.company_name}… results in ~30s`, "success");

    // Poll for status
    let attempts = 0;
    const poll = setInterval(async () => {
      const s = await apiFetch(`/detect/status/${item.id}`);
      attempts++;
      if (s.scan?.status === "done" || s.scan?.status === "error" || attempts > 12) {
        clearInterval(poll);
        setScanning(prev => ({ ...prev, [item.id]: false }));
        if (s.scan?.status === "done") {
          const found = s.scan?.signals_found || 0;
          setScanResults(prev => ({ ...prev, [item.id]: found }));
          showT(found > 0 ? `Found ${found} new signal${found > 1 ? "s" : ""} for ${item.company_name}!` : `No new signals for ${item.company_name}`, found > 0 ? "success" : "info");
          if (found > 0) await load();
        }
      }
    }, 5000);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    !search || i.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.domain?.toLowerCase().includes(search.toLowerCase()) ||
    i.country?.toLowerCase().includes(search.toLowerCase()) ||
    i.industry?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSignals = items.reduce((acc, i) => acc + (i.signal_count || 0), 0);

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
          <p style={{ color:"#737373", fontSize:13 }}>
            Monitor companies for hiring spikes, country expansions, and new product launches.
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={async () => {
            const r = await apiFetch("/watchlist/seed-demo", { method:"POST" });
            if (r.success && r.added > 0) { showT(`Added ${r.added} demo companies`); await load(); }
            else showT("Demo companies already loaded", "info");
          }} style={{
            padding:"10px 18px", borderRadius:6, background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.1)", color:"#737373",
            fontWeight:700, fontSize:13, cursor:"pointer",
          }}>
            ⚡ Demo Companies
          </button>
          <button onClick={async () => {
            const r = await apiFetch("/detect/scan-all", { method:"POST" });
            showT(r.message || "Scanning all companies…", "success");
          }} style={{
            padding:"10px 18px", borderRadius:6, background:"rgba(0,113,235,0.12)",
            border:"1px solid rgba(0,113,235,0.3)", color:"#0071eb",
            fontWeight:700, fontSize:13, cursor:"pointer",
          }}>
            🔍 Scan All
          </button>
          <button onClick={() => setShowForm(f => !f)} style={{
            padding:"10px 22px", borderRadius:6,
            background: showForm ? "rgba(255,255,255,0.08)" : "#E50914",
            color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", border:"none",
          }}>
            {showForm ? "Cancel" : "+ Add Company"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
        {[
          { label:"Companies Watched", value:items.length, color:"#fff" },
          { label:"Active Signals", value:totalSignals, color:"#E50914" },
          { label:"Countries", value:[...new Set(items.map(i => i.country).filter(Boolean))].length, color:"#0071eb" },
          { label:"Industries", value:[...new Set(items.map(i => i.industry).filter(Boolean))].length, color:"#f5a623" },
        ].map(s => (
          <div key={s.label} style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"14px 22px", minWidth:120 }}>
            <div style={{ fontSize:24, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* What we detect */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {[
          { icon:"📈", label:"Hiring Spike", color:"#E50914" },
          { icon:"🌍", label:"Country Expansion", color:"#0071eb" },
          { icon:"🚀", label:"New Product", color:"#46d369" },
          { icon:"💰", label:"Pricing Change", color:"#f5a623" },
          { icon:"👤", label:"Leadership Change", color:"#a855f7" },
        ].map(t => (
          <div key={t.label} style={{ background:t.color+"10", border:`1px solid ${t.color}22`, borderRadius:20, padding:"5px 12px", display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
            <span>{t.icon}</span>
            <span style={{ color:t.color, fontWeight:600 }}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Add company form */}
      {showForm && (
        <div style={{ background:"#141414", border:"1px solid rgba(229,9,20,0.2)", borderRadius:8, padding:"24px", marginBottom:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:18 }}>Add Company to Watchlist</div>
          <form onSubmit={add} style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            <div>
              <label style={S.label}>COMPANY NAME *</label>
              <input style={S.input} placeholder="e.g. Freshworks" value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name:e.target.value }))} required />
            </div>
            <div>
              <label style={S.label}>DOMAIN</label>
              <input style={S.input} placeholder="freshworks.com" value={form.domain}
                onChange={e => setForm(f => ({ ...f, domain:e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>INDUSTRY</label>
              <select style={S.input} value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry:e.target.value }))}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>HQ COUNTRY</label>
              <input style={S.input} placeholder="e.g. USA" value={form.country}
                onChange={e => setForm(f => ({ ...f, country:e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>PRIORITY</label>
              <select style={S.input} value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority:e.target.value }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <button type="submit" disabled={adding} style={{
                width:"100%", padding:"10px 18px", borderRadius:6, background:"#E50914", color:"#fff",
                fontWeight:700, fontSize:13, cursor:"pointer", border:"none", opacity: adding ? 0.7 : 1,
              }}>
                {adding ? "Adding…" : "Add Company →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      {items.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, domain, country, or industry…"
            style={{ ...S.input, maxWidth:400 }}
          />
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
          <div style={{ color:"#737373", fontSize:14, maxWidth:400, margin:"0 auto 24px" }}>
            Add competitors or target companies to detect hiring spikes, country expansions, and product launches automatically.
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={async () => {
              const r = await apiFetch("/watchlist/seed-demo", { method:"POST" });
              if (r.success) { showT(`Added ${r.added} demo companies`); await load(); }
            }} style={{ padding:"13px 32px", borderRadius:24, background:"rgba(0,113,235,0.15)", border:"1px solid rgba(0,113,235,0.4)", color:"#0071eb", fontWeight:700, fontSize:14, cursor:"pointer" }}>
              ⚡ Load Demo Companies
            </button>
            <button onClick={() => setShowForm(true)} style={{ padding:"13px 32px", borderRadius:24, background:"#E50914", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", border:"none" }}>
              + Add Company
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"rgba(0,0,0,0.3)" }}>
                <th style={S.th}>COMPANY</th>
                <th style={S.th}>DOMAIN</th>
                <th style={S.th}>INDUSTRY</th>
                <th style={S.th}>COUNTRY</th>
                <th style={S.th}>PRIORITY</th>
                <th style={S.th}>SIGNALS</th>
                <th style={S.th}>MONITORING</th>
                <th style={S.th}>LAST SCANNED</th>
                <th style={S.th}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const pm = PRIORITY_META[item.priority] || PRIORITY_META.medium;
                const isScanning = scanning[item.id];
                const scanResult = scanResults[item.id];
                const lastScanned = item.last_scanned
                  ? new Date(item.last_scanned).toLocaleDateString("en-IN", { day:"numeric", month:"short" })
                  : "Never";

                return (
                  <tr key={item.id}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={S.td}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{
                          width:36, height:36, borderRadius:6, flexShrink:0,
                          background:["#E50914","#0071eb","#f5a623","#46d369","#a855f7","#58a6ff"][(item.company_name?.charCodeAt(0)||0)%6],
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontWeight:900, fontSize:15, color:"#fff",
                        }}>
                          {item.company_name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, color:"#fff", fontSize:14 }}>{item.company_name}</div>
                          {item.notes && <div style={{ fontSize:11, color:"#737373" }}>{item.notes.slice(0,30)}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      {item.domain ? (
                        <a href={`https://${item.domain}`} target="_blank" rel="noreferrer"
                          style={{ color:"#737373", fontSize:12, textDecoration:"underline" }}>
                          {item.domain}
                        </a>
                      ) : <span style={{ color:"#3a3a3a" }}>—</span>}
                    </td>
                    <td style={S.td}>
                      {item.industry && (
                        <span style={{ background:"rgba(229,9,20,0.08)", color:"#E50914", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                          {item.industry}
                        </span>
                      )}
                    </td>
                    <td style={{ ...S.td, fontSize:13, color:"#b3b3b3" }}>
                      {item.country || "—"}
                    </td>
                    <td style={S.td}>
                      <span style={{ background:pm.bg, color:pm.color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {pm.label}
                      </span>
                    </td>
                    <td style={S.td}>
                      {item.signal_count > 0 ? (
                        <span style={{
                          background:"rgba(229,9,20,0.12)", color:"#E50914",
                          fontWeight:800, fontSize:15, padding:"2px 10px", borderRadius:20,
                        }}>
                          {item.signal_count}
                        </span>
                      ) : (
                        <span style={{ color:"#3a3a3a", fontSize:12 }}>0</span>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ display:"flex", gap:6 }}>
                        {item.watch_hiring    && <span title="Hiring Spike"    style={{ fontSize:14 }}>📈</span>}
                        {item.watch_expansion && <span title="Expansion"       style={{ fontSize:14 }}>🌍</span>}
                        {item.watch_pricing   && <span title="Pricing Change"  style={{ fontSize:14 }}>💰</span>}
                      </div>
                    </td>
                    <td style={{ ...S.td, fontSize:12, color:"#737373" }}>
                      {isScanning ? (
                        <div style={{ display:"flex", alignItems:"center", gap:6, color:"#0071eb" }}>
                          <div style={{ width:12, height:12, border:"2px solid #0071eb", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                          Scanning…
                        </div>
                      ) : (
                        <>
                          {lastScanned}
                          {scanResult !== undefined && (
                            <div style={{ fontSize:11, color: scanResult > 0 ? "#46d369" : "#737373", marginTop:2 }}>
                              {scanResult > 0 ? `+${scanResult} new` : "No changes"}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => scanNow(item)} disabled={isScanning}
                          style={{
                            padding:"5px 12px", borderRadius:4, fontSize:11, fontWeight:700,
                            background: isScanning ? "transparent" : "rgba(0,113,235,0.12)",
                            border:"1px solid rgba(0,113,235,0.3)", color:"#0071eb",
                            cursor: isScanning ? "not-allowed" : "pointer",
                          }}>
                          {isScanning ? "…" : "Scan"}
                        </button>
                        <a href="/dashboard" style={{
                          padding:"5px 12px", borderRadius:4, fontSize:11, fontWeight:700,
                          background:"rgba(70,211,105,0.08)", border:"1px solid rgba(70,211,105,0.2)",
                          color:"#46d369", textDecoration:"none",
                        }}>
                          Signals
                        </a>
                        <button onClick={() => remove(item.id, item.company_name)} style={{
                          padding:"5px 12px", borderRadius:4, fontSize:11, fontWeight:700,
                          background:"transparent", border:"1px solid rgba(229,9,20,0.2)",
                          color:"#E50914", cursor:"pointer",
                        }}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && search && (
            <div style={{ padding:"32px", textAlign:"center", color:"#737373", fontSize:13 }}>
              No companies match "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
