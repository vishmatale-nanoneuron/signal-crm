"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const TYPE_META = {
  contact_now: { icon: "📞", color: "#00D9FF", label: "Contact Now" },
  move_deal: { icon: "➡️", color: "#A855F7", label: "Move Deal" },
  compliance_check: { icon: "🛡", color: "#F85149", label: "Compliance Check" },
  research: { icon: "🔍", color: "#D29922", label: "Research" },
  wait: { icon: "⏳", color: "#888", label: "Wait" },
};
const PRI_COLOR = { urgent:"#F85149", high:"#E3B341", medium:"#D29922", low:"rgba(230,237,243,0.3)" };
const PRI_BG = { urgent:"rgba(248,81,73,0.12)", high:"rgba(227,179,65,0.1)", medium:"rgba(210,153,34,0.08)", low:"rgba(255,255,255,0.04)" };

function timeAgo(iso) {
  const d = Math.floor((Date.now()-new Date(iso))/86400000);
  return d===0?"Today":d===1?"Yesterday":`${d} days ago`;
}

export default function NextActionsPage() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(new Set());

  useEffect(() => {
    apiFetch("/next-actions").then(d => { if(d.success) setData(d); setLoading(false); });
  }, []);

  const actions = data?.actions || [];
  const filtered = actions.filter(a => {
    if (done.has(a.id)) return false;
    if (filter === "urgent") return a.priority === "urgent";
    if (filter === "high") return ["urgent","high"].includes(a.priority);
    return true;
  });

  if (loading) return <div style={{color:"var(--text3)",padding:40}}>Loading next actions…</div>;

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>🎯 Next Best Actions</h1>
        <p style={{color:"var(--text2)",fontSize:13}}>AI-ranked actions based on your live signals and pipeline. Act on these first.</p>
      </div>

      {data && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 18px"}}>
            <div style={{fontSize:24,fontWeight:800,color:"#F85149"}}>{data.urgent_count}</div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Urgent Actions</div>
          </div>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 18px"}}>
            <div style={{fontSize:24,fontWeight:800}}>{data.total}</div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Total Recommended</div>
          </div>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 18px"}}>
            <div style={{fontSize:24,fontWeight:800,color:"#3FB950"}}>{done.size}</div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Done This Session</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["all","All"],["urgent","Urgent Only"],["high","Urgent + High"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"6px 16px",borderRadius:20,fontSize:12,fontWeight:filter===v?700:400,background:filter===v?"rgba(0,217,255,0.15)":"rgba(255,255,255,0.04)",color:filter===v?"var(--accent)":"var(--text2)",border:filter===v?"1px solid rgba(0,217,255,0.3)":"1px solid var(--border)",cursor:"pointer"}}>{l}</button>
        ))}
        <button onClick={()=>apiFetch("/next-actions").then(d=>{if(d.success)setData(d);})} style={{marginLeft:"auto",padding:"6px 14px",borderRadius:7,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--text2)",fontSize:12,cursor:"pointer"}}>↻ Refresh</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>🎯</div>
          <div style={{fontWeight:700,marginBottom:8}}>All clear!</div>
          <div style={{color:"var(--text2)",fontSize:13}}>No pending actions. Add more watchlist accounts and signals to get recommendations.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(a=>{
            const meta = TYPE_META[a.type] || {icon:"📋",color:"#888",label:a.type};
            const [expanded, setExpanded] = useState(false);
            return (
              <div key={a.id} style={{background:PRI_BG[a.priority],border:`1px solid ${PRI_COLOR[a.priority]}30`,borderRadius:12,padding:"18px 22px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:10}}>
                  <div style={{fontSize:24,flexShrink:0}}>{meta.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{background:PRI_COLOR[a.priority]+"25",color:PRI_COLOR[a.priority],padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:800,letterSpacing:"0.06em"}}>{a.priority.toUpperCase()}</span>
                      <span style={{background:meta.color+"18",color:meta.color,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600}}>{meta.label}</span>
                      {a.target_company && <span style={{fontSize:11,color:"var(--text3)"}}>🏢 {a.target_company}</span>}
                      {a.target_country && <span style={{fontSize:11,color:"var(--text3)"}}>📍 {a.target_country}</span>}
                      <span style={{fontSize:11,color:"var(--text3)"}}>{timeAgo(a.detected_at)}</span>
                    </div>
                    <div style={{fontWeight:700,fontSize:15,lineHeight:1.4,color:"var(--text)",marginBottom:8}}>{a.title}</div>
                    <div style={{color:"var(--text2)",fontSize:13,lineHeight:1.6}}>{a.detail}</div>
                  </div>
                </div>

                {/* Proof */}
                <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"10px 14px",marginBottom:12,cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",letterSpacing:"0.08em",marginBottom:4}}>PROOF {expanded?"▲":"▼"}</div>
                  <div style={{fontSize:12,color:"rgba(230,237,243,0.55)"}}>{a.proof}</div>
                  {expanded && a.proof_detail && <div style={{marginTop:8,fontSize:12,color:"rgba(230,237,243,0.4)",lineHeight:1.5}}>{a.proof_detail}</div>}
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setDone(d=>new Set([...d,a.id]))} style={{padding:"7px 16px",borderRadius:7,background:"linear-gradient(135deg,#00D9FF,#A855F7)",color:"#06080D",fontWeight:700,fontSize:12,cursor:"pointer",border:"none"}}>✓ Done</button>
                  <button onClick={()=>setDone(d=>new Set([...d,a.id]))} style={{padding:"7px 14px",borderRadius:7,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--text3)",fontSize:12,cursor:"pointer"}}>Snooze</button>
                  {a.type==="compliance_check"&&a.target_country&&(
                    <a href={`/dashboard/compliance`} style={{padding:"7px 14px",borderRadius:7,background:"rgba(248,81,73,0.1)",border:"1px solid rgba(248,81,73,0.25)",color:"#F85149",fontSize:12,cursor:"pointer",display:"inline-block"}}>Open Compliance →</a>
                  )}
                  {a.type==="move_deal"&&(
                    <a href="/dashboard/deals" style={{padding:"7px 14px",borderRadius:7,background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.25)",color:"var(--accent2)",fontSize:12,cursor:"pointer",display:"inline-block"}}>Open Deals →</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
