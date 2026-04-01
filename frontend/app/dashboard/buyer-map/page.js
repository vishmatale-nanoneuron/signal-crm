"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const DIFF_META = {
  easy:   { color:"#46d369", bg:"rgba(70,211,105,0.12)",  label:"Easy Entry"   },
  medium: { color:"#f5a623", bg:"rgba(245,166,35,0.12)",  label:"Medium Entry" },
  hard:   { color:"#E50914", bg:"rgba(229,9,20,0.12)",    label:"Hard Entry"   },
};

const INDUSTRY_ICONS = {
  "SaaS": "💻", "Fintech": "💳", "IT Services": "🖥️", "Logistics": "🚚",
  "Manufacturing": "🏭", "Healthcare": "🏥", "Ecommerce": "🛒", "HR Tech": "👥",
  "Legal": "⚖️", "Clean Energy": "⚡",
};

export default function BuyerMapPage() {
  const [industries, setIndustries] = useState([]);
  const [countries,  setCountries]  = useState([]);
  const [industry,   setIndustry]   = useState("");
  const [country,    setCountry]    = useState("");
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [toast,      setToast]      = useState(null);

  useEffect(() => {
    apiFetch("/buyer-map/industries").then(d => { if (d.success) setIndustries(d.industries || []); });
    apiFetch("/buyer-map/countries").then(d => { if (d.success) setCountries(d.countries || []); });
  }, []);

  async function search(e) {
    e.preventDefault();
    if (!industry || !country) return;
    setLoading(true); setResult(null);
    const d = await apiFetch(`/buyer-map?industry=${encodeURIComponent(industry)}&country=${encodeURIComponent(country)}`);
    setResult(d);
    setLoading(false);
  }

  async function createDeal() {
    if (!result?.data) return;
    const r = await apiFetch("/deals", { method:"POST", body: JSON.stringify({
      title: `${industry} deal — ${country}`,
      country, industry,
      contact_title: result.data.primary_buyer,
      stage: "signal",
      next_action: `Target: ${result.data.primary_buyer}. ${result.data.notes || ""}`,
    })});
    if (r.success) {
      setToast(`Deal created — targeting ${result.data.primary_buyer} in ${country}`);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const diff = result?.data ? (DIFF_META[result.data.entry_difficulty] || DIFF_META.medium) : null;

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
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Buyer Map</h1>
        <p style={{ color:"#737373", fontSize:13 }}>Who makes the buying decision? Find the right contact for any industry in any country.</p>
      </div>

      {/* Search form */}
      <form onSubmit={search} style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"24px 28px", marginBottom:28 }}>
        <div style={{ display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:8 }}>INDUSTRY</div>
            <select value={industry} onChange={e => setIndustry(e.target.value)} required
              style={{ width:"100%", padding:"12px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color: industry ? "#fff" : "#737373", fontSize:14 }}>
              <option value="">Select industry…</option>
              {industries.map(i => (
                <option key={i} value={i}>{INDUSTRY_ICONS[i] || "🏢"} {i}</option>
              ))}
            </select>
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:8 }}>TARGET COUNTRY</div>
            <select value={country} onChange={e => setCountry(e.target.value)} required
              style={{ width:"100%", padding:"12px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color: country ? "#fff" : "#737373", fontSize:14 }}>
              <option value="">Select country…</option>
              {countries.map(c => <option key={c.country} value={c.country}>{c.country}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading || !industry || !country} style={{
            padding:"12px 28px", borderRadius:6,
            background: (industry && country) && !loading ? "#E50914" : "rgba(255,255,255,0.06)",
            color: (industry && country) && !loading ? "#fff" : "#737373",
            fontWeight:700, fontSize:14, border:"none",
            cursor: (industry && country) && !loading ? "pointer" : "not-allowed",
            whiteSpace:"nowrap", transition:"background 0.15s",
          }}>
            {loading ? "Searching…" : "Find Buyers →"}
          </button>
        </div>

        {/* Industry quick picks */}
        {industries.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:14 }}>
            {industries.slice(0, 6).map(i => (
              <button key={i} type="button" onClick={() => setIndustry(i)} style={{
                padding:"5px 12px", borderRadius:20, fontSize:12, cursor:"pointer",
                background: industry === i ? "rgba(229,9,20,0.15)" : "rgba(255,255,255,0.05)",
                border: industry === i ? "1px solid rgba(229,9,20,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: industry === i ? "#E50914" : "#b3b3b3",
              }}>
                {INDUSTRY_ICONS[i] || "🏢"} {i}
              </button>
            ))}
          </div>
        )}
      </form>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Finding buyers…
        </div>
      )}

      {result?.success && result.data && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:14 }}>

          {/* Primary buyer hero */}
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"28px 32px" }}>
            <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:12 }}>
              PRIMARY DECISION MAKER
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
              <div style={{ width:60, height:60, borderRadius:12, background:"#E50914", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
                {INDUSTRY_ICONS[industry] || "🏢"}
              </div>
              <div>
                <div style={{ fontSize:28, fontWeight:900, color:"#E50914", lineHeight:1.2 }}>{result.data.primary_buyer}</div>
                <div style={{ fontSize:13, color:"#737373", marginTop:4 }}>{industry} · {country}</div>
              </div>
            </div>

            {/* Deal metrics */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:24 }}>
              <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:6, padding:"12px 16px", flex:1, minWidth:140 }}>
                <div style={{ fontSize:10, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>DEAL CYCLE</div>
                <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{result.data.typical_deal_cycle}</div>
                <div style={{ fontSize:11, color:"#737373" }}>days typical</div>
              </div>
              <div style={{ background:diff.bg, borderRadius:6, padding:"12px 16px", flex:1, minWidth:140 }}>
                <div style={{ fontSize:10, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>MARKET ENTRY</div>
                <div style={{ fontSize:16, fontWeight:800, color:diff.color }}>{diff.label}</div>
              </div>
            </div>

            {/* Secondary buyers */}
            {result.data.secondary_buyers?.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:10 }}>ALSO INVOLVED IN DECISION</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {result.data.secondary_buyers.map(b => (
                    <span key={b} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", padding:"6px 14px", borderRadius:20, fontSize:13, color:"#b3b3b3" }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Market intel */}
            {result.data.notes && (
              <div style={{ background:"rgba(229,9,20,0.04)", border:"1px solid rgba(229,9,20,0.15)", borderRadius:6, padding:"16px 18px", marginBottom:24 }}>
                <div style={{ fontSize:10, color:"#E50914", fontWeight:700, letterSpacing:"0.1em", marginBottom:8 }}>💡 MARKET INTELLIGENCE</div>
                <div style={{ fontSize:13, color:"#b3b3b3", lineHeight:1.8 }}>{result.data.notes}</div>
              </div>
            )}

            <button onClick={createDeal} style={{
              padding:"12px 24px", borderRadius:24, background:"rgba(229,9,20,0.1)",
              border:"1px solid rgba(229,9,20,0.3)", color:"#E50914",
              fontSize:13, fontWeight:700, cursor:"pointer",
              transition:"all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background="#E50914"; e.currentTarget.style.color="#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(229,9,20,0.1)"; e.currentTarget.style.color="#E50914"; }}
            >
              + Add to Deal Pipeline →
            </button>
          </div>

          {/* Countries sidebar */}
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"20px 22px" }}>
            <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:14 }}>
              COUNTRIES BY MARKET ENTRY
            </div>
            <div style={{ maxHeight:480, overflowY:"auto" }}>
              {countries.map(c => {
                const d = DIFF_META[c.entry_difficulty] || DIFF_META.medium;
                const isSelected = c.country === country;
                return (
                  <div
                    key={c.country}
                    onClick={() => setCountry(c.country)}
                    style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"10px 8px", borderBottom:"1px solid rgba(255,255,255,0.04)",
                      cursor:"pointer", borderRadius:4,
                      background: isSelected ? "rgba(229,9,20,0.08)" : "transparent",
                      transition:"background 0.1s",
                    }}
                    onMouseEnter={e => !isSelected && (e.currentTarget.style.background="rgba(255,255,255,0.03)")}
                    onMouseLeave={e => !isSelected && (e.currentTarget.style.background="transparent")}
                  >
                    <div>
                      <div style={{ fontSize:13, fontWeight: isSelected ? 700 : 400, color: isSelected ? "#E50914" : "#fff" }}>{c.country}</div>
                      <div style={{ fontSize:11, color:"#737373" }}>
                        {c.cold_email_allowed === "yes" ? "✓ Cold email" : "✗ Email restricted"}
                      </div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:d.color, background:d.bg, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>
                      {c.entry_difficulty}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {result && !result.success && (
        <div style={{ background:"rgba(229,9,20,0.06)", border:"1px solid rgba(229,9,20,0.2)", borderRadius:8, padding:"24px", color:"#b3b3b3", fontSize:14, textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
          <div>{result.error || "No data found for this combination. Try a different industry or country."}</div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))", gap:10 }}>
          {industries.map(i => (
            <div key={i} onClick={() => setIndustry(i)} style={{
              background:"#1a1a1a", border: industry === i ? "1px solid rgba(229,9,20,0.4)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius:8, padding:"20px", cursor:"pointer",
              transition:"all 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor="rgba(255,255,255,0.15)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = industry === i ? "rgba(229,9,20,0.4)" : "rgba(255,255,255,0.06)"}
            >
              <div style={{ fontSize:28, marginBottom:8 }}>{INDUSTRY_ICONS[i] || "🏢"}</div>
              <div style={{ fontSize:13, fontWeight:700, color: industry === i ? "#E50914" : "#fff" }}>{i}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
