"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";

const INDUSTRIES = ["SaaS", "Logistics", "Manufacturing", "FinTech"];

const S = {
  input:  { width:"100%", padding:"11px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" },
  label:  { fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:6, display:"block" },
  section:{ marginBottom:20 },
};

function CopyBtn({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} style={{
      padding:"6px 14px", borderRadius:4, fontSize:11, fontWeight:700, cursor:"pointer",
      background: copied ? "rgba(70,211,105,0.15)" : "rgba(255,255,255,0.08)",
      border: copied ? "1px solid rgba(70,211,105,0.4)" : "1px solid rgba(255,255,255,0.12)",
      color: copied ? "#46d369" : "#b3b3b3",
      transition:"all 0.2s",
    }}>
      {copied ? "✓ Copied!" : label}
    </button>
  );
}

export default function EmailTemplatesPage() {
  const [countries,  setCountries]  = useState([]);
  const [country,    setCountry]    = useState("Germany");
  const [industry,   setIndustry]   = useState("SaaS");
  const [offering,   setOffering]   = useState("cross-border CRM software");
  const [senderName, setSenderName] = useState("[Your Name]");
  const [senderCo,   setSenderCo]   = useState("[Your Company]");
  const [search,     setSearch]     = useState("");
  const [showDD,     setShowDD]     = useState(false);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [generated,  setGenerated]  = useState(false);

  useEffect(() => {
    apiFetch("/email-templates/countries").then(d => {
      if (d.success) setCountries(d.countries);
    });
    // Pre-generate example
    generate("Germany", "SaaS", "cross-border CRM software", "[Your Name]", "[Your Company]");
  }, []);

  async function generate(c, ind, off, sn, sc) {
    setLoading(true);
    const params = new URLSearchParams({ country: c, industry: ind, offering: off, sender_name: sn, sender_company: sc });
    const d = await apiFetch(`/email-templates/generate?${params}`);
    if (d.success) { setResult(d.template); setGenerated(true); }
    setLoading(false);
  }

  function handleGenerate() {
    generate(country, industry, offering, senderName, senderCo);
  }

  const filtered = countries.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  const WARNING_COLORS = { error:"#E50914", warn:"#f5a623", info:"#0071eb", success:"#46d369" };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Email Template Generator</h1>
        <p style={{ color:"#737373", fontSize:13 }}>
          Generate GDPR-compliant, culturally adapted cold emails for 60+ countries. Know exactly what to say, when, and how.
        </p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:24, alignItems:"start" }}>

        {/* ── Left: Input panel ── */}
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"24px 22px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:20 }}>Configure Template</div>

          {/* Country selector */}
          <div style={S.section}>
            <label style={S.label}>TARGET COUNTRY</label>
            <div style={{ position:"relative" }}>
              <div
                onClick={() => setShowDD(d => !d)}
                style={{ ...S.input, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}
              >
                <span style={{ color: country ? "#fff" : "#737373" }}>{country || "Select country…"}</span>
                <span style={{ color:"#737373", fontSize:10 }}>▾</span>
              </div>
              {showDD && (
                <div style={{
                  position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:50,
                  background:"#2a2a2a", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4,
                  maxHeight:260, overflow:"auto",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
                }}>
                  <div style={{ padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search countries…"
                      style={{ ...S.input, padding:"7px 10px", fontSize:12 }}
                    />
                  </div>
                  {filtered.map(c => (
                    <div key={c}
                      onClick={() => { setCountry(c); setShowDD(false); setSearch(""); }}
                      style={{
                        padding:"9px 12px", fontSize:13, cursor:"pointer",
                        color: c === country ? "#E50914" : "#e5e5e5",
                        background: c === country ? "rgba(229,9,20,0.08)" : "transparent",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = c === country ? "rgba(229,9,20,0.08)" : "transparent"}
                    >
                      {c}
                    </div>
                  ))}
                  {filtered.length === 0 && <div style={{ padding:"12px", color:"#737373", fontSize:13 }}>No results</div>}
                </div>
              )}
            </div>
          </div>

          {/* Industry */}
          <div style={S.section}>
            <label style={S.label}>INDUSTRY</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {INDUSTRIES.map(ind => (
                <button key={ind} onClick={() => setIndustry(ind)} style={{
                  padding:"7px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  background: industry === ind ? "#E50914" : "rgba(255,255,255,0.06)",
                  color: industry === ind ? "#fff" : "#b3b3b3",
                  border: industry === ind ? "none" : "1px solid rgba(255,255,255,0.1)",
                  transition:"all 0.15s",
                }}>
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* Offering */}
          <div style={S.section}>
            <label style={S.label}>YOUR OFFERING</label>
            <input
              value={offering}
              onChange={e => setOffering(e.target.value)}
              placeholder="e.g. AI-powered CRM for B2B sales teams"
              style={S.input}
            />
          </div>

          {/* Sender */}
          <div style={S.section}>
            <label style={S.label}>YOUR NAME</label>
            <input value={senderName} onChange={e => setSenderName(e.target.value)} style={S.input} />
          </div>
          <div style={S.section}>
            <label style={S.label}>YOUR COMPANY</label>
            <input value={senderCo} onChange={e => setSenderCo(e.target.value)} style={S.input} />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !country}
            style={{
              width:"100%", padding:"13px", borderRadius:4, background: loading ? "rgba(229,9,20,0.5)" : "#E50914",
              color:"#fff", fontWeight:700, fontSize:14, cursor: loading ? "not-allowed" : "pointer",
              border:"none", transition:"all 0.15s",
            }}
          >
            {loading ? "Generating…" : `Generate Template for ${country || "…"}`}
          </button>

          {result && (
            <div style={{ marginTop:14, padding:"10px 12px", background:"rgba(70,211,105,0.06)", border:"1px solid rgba(70,211,105,0.2)", borderRadius:4, fontSize:12, color:"#46d369", textAlign:"center" }}>
              ✓ {result.compliance_status === "allowed" ? "Cold email permitted in this country" : "Restricted — see compliance warnings"}
            </div>
          )}
        </div>

        {/* ── Right: Output panel ── */}
        {!generated && !loading && (
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"80px 32px", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✉</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:8 }}>Select a country and click Generate</div>
            <div style={{ color:"#737373", fontSize:13 }}>Your compliant, culture-adapted email template will appear here.</div>
          </div>
        )}

        {loading && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
            <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Generating template…
          </div>
        )}

        {!loading && result && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Compliance Banner */}
            {result.compliance_warnings?.map((w, i) => (
              <div key={i} style={{
                padding:"12px 16px", borderRadius:4,
                background:`${WARNING_COLORS[w.type] || "#737373"}12`,
                border:`1px solid ${WARNING_COLORS[w.type] || "#737373"}30`,
                fontSize:13, color: WARNING_COLORS[w.type] || "#737373",
                lineHeight:1.6,
              }}>
                {w.text}
              </div>
            ))}

            {/* Subject lines */}
            <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"20px 22px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#737373", letterSpacing:"0.1em", marginBottom:14 }}>SUBJECT LINE OPTIONS</div>
              {result.subject_lines?.map((s, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize:13, color:"#e5e5e5", flex:1, paddingRight:12 }}>{s}</span>
                  <CopyBtn text={s} />
                </div>
              ))}
            </div>

            {/* Email body */}
            <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"20px 22px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#737373", letterSpacing:"0.1em" }}>EMAIL BODY</div>
                <CopyBtn text={result.email_body} label="Copy Email" />
              </div>
              <pre style={{
                fontFamily:"'SF Mono','Fira Code',monospace", fontSize:12, color:"#e5e5e5",
                lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word",
                background:"rgba(0,0,0,0.3)", padding:"16px", borderRadius:4,
                margin:0,
              }}>
                {result.email_body}
              </pre>
            </div>

            {/* Cultural tips */}
            <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"20px 22px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#737373", letterSpacing:"0.1em", marginBottom:14 }}>CULTURAL & TIMING TIPS — {result.country?.toUpperCase()}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {result.cultural_tips?.map((tip, i) => (
                  <div key={i} style={{ fontSize:13, color:"#b3b3b3", lineHeight:1.6, display:"flex", gap:8 }}>
                    <span style={{ flexShrink:0 }}>•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up cadence */}
            <div style={{ padding:"14px 18px", background:"rgba(0,113,235,0.06)", border:"1px solid rgba(0,113,235,0.2)", borderRadius:4 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#0071eb", letterSpacing:"0.1em", marginBottom:6 }}>FOLLOW-UP CADENCE</div>
              <div style={{ fontSize:13, color:"#b3b3b3", lineHeight:1.7 }}>{result.follow_up_cadence}</div>
            </div>

            {/* Quick links */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <a href={`/dashboard/compliance?country=${encodeURIComponent(result.country)}`}
                style={{ padding:"9px 18px", borderRadius:4, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#b3b3b3", fontSize:12, fontWeight:600 }}>
                ⚖ Check Full Compliance — {result.country}
              </a>
              <a href={`/dashboard/country-intel`}
                style={{ padding:"9px 18px", borderRadius:4, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#b3b3b3", fontSize:12, fontWeight:600 }}>
                🌍 Country Intelligence
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
