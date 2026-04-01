"use client";
import { useState } from "react";
import { apiFetch } from "../../../lib/api";

const RISK_META = {
  high:   { color:"#E50914", bg:"rgba(229,9,20,0.12)",    label:"HIGH RISK",   icon:"🔴" },
  medium: { color:"#f5a623", bg:"rgba(245,166,35,0.12)",  label:"MEDIUM RISK", icon:"🟡" },
  low:    { color:"#46d369", bg:"rgba(70,211,105,0.12)",  label:"LOW RISK",    icon:"🟢" },
};

const COUNTRIES = [
  "Germany","France","UK","USA","Canada","India","Australia","Singapore","Japan","Brazil",
  "Netherlands","South Africa","UAE","Saudi Arabia","Malaysia","Indonesia","Sweden","Spain",
  "Italy","Mexico","Argentina","Nigeria","Kenya","Poland","Vietnam","Philippines","Thailand",
  "South Korea","China","Israel","Turkey","Egypt","New Zealand","Ireland","Switzerland",
  "Denmark","Norway","Finland","Belgium","Austria","Portugal","Greece","Czech Republic",
  "Hungary","Romania","Ukraine","Pakistan","Bangladesh","Sri Lanka","Ethiopia","Ghana",
  "Tanzania","Morocco","Algeria","Tunisia","Senegal","Ivory Coast","Cameroon","Angola",
  "Zimbabwe","Zambia","Uganda","Mozambique","Sudan","Iraq","Jordan","Lebanon","Kuwait",
  "Bahrain","Oman","Qatar","Afghanistan","Kazakhstan","Uzbekistan","Azerbaijan","Georgia",
  "Armenia","Belarus","Lithuania","Latvia","Estonia","Slovakia","Slovenia","Croatia",
  "Serbia","Bosnia","Albania","North Macedonia","Montenegro","Iceland","Luxembourg",
  "Malta","Cyprus","Maldives","Nepal","Myanmar","Cambodia","Laos","Mongolia","Fiji",
  "Cuba","Dominican Republic","Haiti","Jamaica","Trinidad and Tobago","Barbados","Belize",
  "Guatemala","Honduras","El Salvador","Nicaragua","Costa Rica","Panama","Colombia",
  "Venezuela","Ecuador","Peru","Bolivia","Paraguay","Uruguay","Chile","Guyana",
];

// Popular countries for quick access
const QUICK_COUNTRIES = ["Germany","USA","UK","India","Canada","Australia","Singapore","Brazil","UAE","France"];

export default function CompliancePage() {
  const [country,  setCountry]  = useState("");
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [history,  setHistory]  = useState([]); // recent checks

  async function check(c) {
    const target = c || country;
    if (!target) return;
    setLoading(true); setResult(null); setError("");
    if (c) setCountry(c);
    const d = await apiFetch(`/compliance/check?country=${encodeURIComponent(target)}`);
    if (d.success) {
      setResult(d);
      setHistory(h => [target, ...h.filter(x => x !== target)].slice(0, 5));
    } else {
      setError(d.message || "No compliance data found for this country.");
    }
    setLoading(false);
  }

  const risk = result ? (RISK_META[result.risk_level] || RISK_META.medium) : null;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Compliance Checker</h1>
        <p style={{ color:"#737373", fontSize:13 }}>Check email outreach rules and data protection laws before contacting prospects in any country.</p>
      </div>

      {/* Search */}
      <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"24px 28px", marginBottom:20 }}>
        <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:10 }}>
          SELECT COUNTRY — 195+ AVAILABLE
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <select value={country} onChange={e => setCountry(e.target.value)}
            style={{ flex:1, minWidth:220, padding:"12px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color: country ? "#fff" : "#737373", fontSize:14 }}>
            <option value="">Choose a country…</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => check()} disabled={!country || loading} style={{
            padding:"12px 28px", borderRadius:6,
            background: country && !loading ? "#E50914" : "rgba(255,255,255,0.06)",
            color: country && !loading ? "#fff" : "#737373",
            fontWeight:700, fontSize:14, cursor: country && !loading ? "pointer" : "not-allowed", border:"none",
            transition:"background 0.15s",
          }}>
            {loading ? "Checking…" : "Check →"}
          </button>
        </div>

        {/* Quick access */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:14 }}>
          <span style={{ fontSize:11, color:"#3a3a3a", alignSelf:"center", marginRight:4 }}>QUICK:</span>
          {QUICK_COUNTRIES.map(c => (
            <button key={c} onClick={() => check(c)} style={{
              padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer",
              background: country === c ? "rgba(229,9,20,0.2)" : "rgba(255,255,255,0.05)",
              border: country === c ? "1px solid rgba(229,9,20,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: country === c ? "#E50914" : "#b3b3b3",
              transition:"all 0.15s",
            }}>
              {c}
            </button>
          ))}
        </div>

        {/* Recent */}
        {history.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
            <span style={{ fontSize:11, color:"#3a3a3a", alignSelf:"center", marginRight:4 }}>RECENT:</span>
            {history.map(c => (
              <button key={c} onClick={() => check(c)} style={{
                padding:"3px 10px", borderRadius:20, fontSize:11, cursor:"pointer",
                background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"#737373",
              }}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background:"rgba(229,9,20,0.08)", border:"1px solid rgba(229,9,20,0.2)", borderRadius:6, padding:"14px 18px", marginBottom:20, color:"#b3b3b3", fontSize:13 }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Checking compliance data…
        </div>
      )}

      {result && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

          {/* Hero card */}
          <div style={{ gridColumn:"1/-1", background:"#1a1a1a", border:`1px solid ${risk.color}22`, borderRadius:8, padding:"28px 32px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16, marginBottom:20 }}>
              <div>
                <div style={{ fontSize:30, fontWeight:900, color:"#fff", marginBottom:6 }}>{result.country}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ background:"rgba(255,255,255,0.08)", color:"#fff", padding:"3px 12px", borderRadius:20, fontSize:12, fontWeight:700 }}>
                    {result.framework}
                  </span>
                  {result.law && (
                    <span style={{ color:"#737373", fontSize:12 }}>{result.law}</span>
                  )}
                </div>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                {/* Traffic light */}
                <div style={{ display:"flex", gap:6, alignItems:"center", background:"rgba(0,0,0,0.3)", borderRadius:20, padding:"6px 14px" }}>
                  {["low","medium","high"].map(level => (
                    <div key={level} style={{
                      width:14, height:14, borderRadius:"50%",
                      background: result.risk_level === level
                        ? (RISK_META[level]?.color || "#737373")
                        : "rgba(255,255,255,0.1)",
                      transition:"background 0.2s",
                    }}/>
                  ))}
                </div>
                <span style={{ background:risk.bg, color:risk.color, padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:700 }}>
                  {risk.icon} {risk.label}
                </span>
                <span style={{
                  padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:700,
                  background: result.cold_email_allowed ? "rgba(70,211,105,0.12)" : "rgba(229,9,20,0.12)",
                  color: result.cold_email_allowed ? "#46d369" : "#E50914",
                }}>
                  {result.cold_email_allowed ? "✓ Cold Email OK" : "✗ Cold Email Restricted"}
                </span>
              </div>
            </div>

            {/* Regulator + penalty */}
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:6, padding:"12px 16px", flex:1, minWidth:200 }}>
                <div style={{ fontSize:10, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>REGULATOR</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{result.regulator}</div>
              </div>
              <div style={{ background:"rgba(229,9,20,0.06)", border:"1px solid rgba(229,9,20,0.15)", borderRadius:6, padding:"12px 16px", flex:1, minWidth:200 }}>
                <div style={{ fontSize:10, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>MAX PENALTY</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#E50914" }}>{result.penalty}</div>
              </div>
            </div>

            {result.notes && (
              <div style={{ marginTop:14, fontSize:13, color:"#b3b3b3", lineHeight:1.8, padding:"12px 16px", background:"rgba(0,0,0,0.2)", borderRadius:6 }}>
                {result.notes}
              </div>
            )}
          </div>

          {/* Key rules */}
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"22px 24px" }}>
            <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:16 }}>📋 KEY RULES</div>
            {result.key_rules?.map((rule, i) => (
              <div key={i} style={{ display:"flex", gap:10, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(229,9,20,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:10, color:"#E50914", fontWeight:700, marginTop:1 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize:13, color:"#e5e5e5", lineHeight:1.6 }}>{rule}</span>
              </div>
            ))}
          </div>

          {/* Before you email checklist */}
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"22px 24px" }}>
            <div style={{ fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.1em", marginBottom:16 }}>✉ BEFORE YOU EMAIL</div>
            {[
              { ok: !result.opt_in_required, y: "No prior consent needed for B2B",          n: "Opt-in consent required before emailing" },
              { ok: result.cold_email_allowed, y: "Cold email allowed — include unsubscribe", n: "Get consent or existing relationship first" },
              { ok: true,  y: "Include company name and physical address",  n: null },
              { ok: true,  y: "Provide clear unsubscribe / opt-out link",   n: null },
              { ok: true,  y: "Store consent records for audit trail",       n: null },
              { ok: null,  y: `Regulator: ${result.regulator}`,             n: null, info:true },
            ].map((item, i) => {
              const color = item.info ? "#737373" : item.ok ? "#46d369" : "#E50914";
              const icon  = item.info ? "ℹ" : item.ok ? "✓" : "✗";
              const text  = item.ok !== false ? item.y : item.n;
              return (
                <div key={i} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
                  <span style={{ color, fontWeight:700, fontSize:14, flexShrink:0, marginTop:1 }}>{icon}</span>
                  <span style={{ fontSize:13, color: item.info ? "#737373" : "#e5e5e5", lineHeight:1.6 }}>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
