"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const STAGE_META = {
  signal:      { label: "Signal",      color: "#737373" },
  qualified:   { label: "Qualified",   color: "#0071eb" },
  proposal:    { label: "Proposal",    color: "#f5a623" },
  negotiation: { label: "Negotiation", color: "#a855f7" },
  won:         { label: "Won",         color: "#46d369" },
  lost:        { label: "Lost",        color: "#E50914" },
};

const FLAGS = {
  "India":"🇮🇳","USA":"🇺🇸","UK":"🇬🇧","Germany":"🇩🇪","France":"🇫🇷",
  "Singapore":"🇸🇬","UAE":"🇦🇪","Japan":"🇯🇵","Australia":"🇦🇺","Canada":"🇨🇦",
  "Brazil":"🇧🇷","Netherlands":"🇳🇱","Saudi Arabia":"🇸🇦","South Africa":"🇿🇦",
  "Malaysia":"🇲🇾","Indonesia":"🇮🇩","Israel":"🇮🇱","Sweden":"🇸🇪","Spain":"🇪🇸",
  "Italy":"🇮🇹","Poland":"🇵🇱","Turkey":"🇹🇷","South Korea":"🇰🇷","Taiwan":"🇹🇼",
  "Hong Kong":"🇭🇰","China":"🇨🇳","Mexico":"🇲🇽","Nigeria":"🇳🇬","Kenya":"🇰🇪",
};

function fmt(val, currency = "INR") {
  const sym = { INR:"₹", USD:"$", EUR:"€", GBP:"£", AED:"د.إ", SGD:"S$", AUD:"A$", CAD:"C$" }[currency] || "₹";
  if (val >= 10000000) return `${sym}${(val/10000000).toFixed(1)}Cr`;
  if (val >= 100000)   return `${sym}${(val/100000).toFixed(1)}L`;
  if (val >= 1000)     return `${sym}${(val/1000).toFixed(1)}K`;
  return `${sym}${val}`;
}

function Stat({ label, value, color, sub, big }) {
  return (
    <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"20px 22px" }}>
      <div style={{ fontSize: big ? 36 : 28, fontWeight:900, color: color || "#fff", lineHeight:1, marginBottom:6 }}>{value}</div>
      <div style={{ fontSize:12, color:"#737373" }}>{label}</div>
      {sub && <div style={{ fontSize:11, color, fontWeight:600, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/analytics/overview").then(d => {
      if (d.success) setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:100, gap:12, color:"#737373" }}>
      <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading analytics…
    </div>
  );

  const ov = data?.overview || {};
  const funnel = data?.funnel || [];
  const byCountry = data?.by_country || [];
  const leadStatus = data?.lead_status || {};

  const isEmpty = ov.total_deals === 0;
  const maxCount = Math.max(...funnel.map(f => f.count), 1);

  if (isEmpty) return (
    <div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Analytics</h1>
      <p style={{ color:"#737373", fontSize:13, marginBottom:40 }}>Pipeline performance, win rates, and revenue by country.</p>
      <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, padding:"72px 32px", textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>📊</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>No pipeline data yet</div>
        <div style={{ color:"#737373", fontSize:14, maxWidth:420, margin:"0 auto 28px" }}>
          Add deals to your pipeline to see win rates, revenue by country, and deal velocity. Start by loading demo signals on the home page.
        </div>
        <a href="/dashboard" style={{ display:"inline-block", padding:"12px 32px", background:"#E50914", color:"#fff", borderRadius:4, fontWeight:700, fontSize:14 }}>
          Go to Home → Load Demo Signals
        </a>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Analytics</h1>
        <p style={{ color:"#737373", fontSize:13 }}>Pipeline performance, win rates, and revenue intelligence.</p>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:32 }}>
        <Stat label="Pipeline Value"    value={fmt(ov.pipeline_value)}       color="#fff"    />
        <Stat label="Weighted Pipeline" value={fmt(ov.weighted_pipeline)}    color="#0071eb" sub="probability-adjusted" />
        <Stat label="Won Revenue"       value={fmt(ov.won_value)}            color="#46d369" />
        <Stat label="Win Rate"          value={`${ov.win_rate}%`}            color={ov.win_rate >= 50 ? "#46d369" : ov.win_rate >= 25 ? "#f5a623" : "#E50914"} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:40 }}>
        <Stat label="Active Deals"      value={ov.active_deals}              color="#fff"    />
        <Stat label="Avg Deal Size"     value={fmt(ov.avg_deal_size)}        color="#f5a623" />
        <Stat label="Avg Deal Cycle"    value={ov.avg_deal_cycle_days > 0 ? `${ov.avg_deal_cycle_days}d` : "—"} color="#b3b3b3" sub="days to close" />
        <Stat label="Countries"         value={ov.countries_in_pipeline}     color="#a855f7" sub="in pipeline" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:20, marginBottom:32 }}>

        {/* Pipeline Funnel */}
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"24px 28px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:20 }}>Pipeline Funnel</div>
          {funnel.map(f => {
            const meta = STAGE_META[f.stage] || { label: f.stage, color:"#737373" };
            const pct = Math.round((f.count / maxCount) * 100);
            return (
              <div key={f.stage} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:10, height:10, borderRadius:"50%", background:meta.color, display:"inline-block" }}/>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:600 }}>{meta.label}</span>
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:12 }}>
                    <span style={{ color:"#737373" }}>{f.count} deal{f.count !== 1 ? "s" : ""}</span>
                    <span style={{ color:meta.color, fontWeight:700 }}>{fmt(f.value)}</span>
                    <span style={{ color:"#737373" }}>{f.probability}%</span>
                  </div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:4, height:8 }}>
                  <div style={{ width:`${pct}%`, background:meta.color, borderRadius:4, height:8, transition:"width 0.6s ease", minWidth: f.count > 0 ? 8 : 0 }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Revenue by Country */}
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"24px 28px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:20 }}>Revenue by Country</div>
          {byCountry.length === 0 ? (
            <div style={{ color:"#737373", fontSize:13 }}>No country data yet.</div>
          ) : (
            byCountry.map(c => (
              <div key={c.country} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:18 }}>{FLAGS[c.country] || "🌍"}</span>
                  <span style={{ fontSize:13, color:"#fff", fontWeight:600 }}>{c.country}</span>
                </div>
                <div style={{ display:"flex", gap:16, fontSize:12 }}>
                  <span style={{ color:"#737373" }}>{c.deals} deals</span>
                  {c.won > 0 && <span style={{ color:"#46d369" }}>{c.won} won</span>}
                  <span style={{ color:"#f5a623", fontWeight:700 }}>{fmt(c.value)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Lead Status + Signal Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"24px 28px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:16 }}>Lead Status Breakdown</div>
          {Object.keys(leadStatus).length === 0 ? (
            <div style={{ color:"#737373", fontSize:13 }}>No leads yet. <a href="/dashboard/leads" style={{ color:"#E50914" }}>Add leads →</a></div>
          ) : (
            Object.entries(leadStatus).map(([status, count]) => {
              const colors = { new:"#0071eb", contacted:"#f5a623", qualified:"#a855f7", converted:"#46d369", lost:"#E50914" };
              const color = colors[status] || "#737373";
              return (
                <div key={status} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ background:color+"20", color, padding:"3px 12px", borderRadius:20, fontSize:12, fontWeight:700, textTransform:"capitalize" }}>{status}</span>
                  <span style={{ fontSize:18, fontWeight:900, color:"#fff" }}>{count}</span>
                </div>
              );
            })
          )}
        </div>

        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"24px 28px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:16 }}>Signal Intelligence</div>
          {[
            { label:"Total Signals Detected",  val: ov.total_signals,          color:"#fff" },
            { label:"Signals This Month",       val: ov.signals_this_month,     color:"#0071eb" },
            { label:"High Priority — Act Now",  val: ov.high_priority_signals,  color:"#E50914" },
            { label:"Total Leads",              val: ov.total_leads,            color:"#f5a623" },
          ].map(r => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize:13, color:"#b3b3b3" }}>{r.label}</span>
              <span style={{ fontSize:18, fontWeight:900, color:r.color }}>{r.val ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
