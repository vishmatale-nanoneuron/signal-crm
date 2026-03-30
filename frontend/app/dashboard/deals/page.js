"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const STAGES = ["signal","qualified","proposal","negotiation","won","lost"];
const STAGE_LABEL = { signal:"Signal",qualified:"Qualified",proposal:"Proposal",negotiation:"Negotiation",won:"Won",lost:"Lost" };
const STAGE_COLOR = { signal:"#00D9FF",qualified:"#A855F7",proposal:"#D29922",negotiation:"#E3B341",won:"#3FB950",lost:"#F85149" };

function fmt(n) { return n >= 10000000 ? `₹${(n/10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`; }

export default function DealsPage() {
  const [pipeline, setPipeline] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ title:"",company_name:"",contact_name:"",contact_title:"",value:0,currency:"INR",stage:"signal",country:"",notes:"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function set(k,v){ setForm(f=>({...f,[k]:v})); }

  async function load() {
    setLoading(true);
    const [p, d] = await Promise.all([apiFetch("/deals/pipeline"), apiFetch("/deals")]);
    if (p.success) setPipeline(p);
    if (d.success) setDeals(d.deals || []);
    setLoading(false);
  }

  async function add(e) {
    e.preventDefault(); setSaving(true);
    const d = await apiFetch("/deals", { method:"POST", body:JSON.stringify({...form, value: parseFloat(form.value)||0}) });
    if (d.success) { await load(); setShowAdd(false); setForm({title:"",company_name:"",contact_name:"",contact_title:"",value:0,currency:"INR",stage:"signal",country:"",notes:""}); setMsg("✓ Deal created"); setTimeout(()=>setMsg(""),2000); }
    setSaving(false);
  }

  async function move(id) {
    const d = await apiFetch(`/deals/${id}/move`, { method:"POST" });
    if (d.success) { await load(); }
  }

  async function del(id) {
    await apiFetch(`/deals/${id}`, { method:"DELETE" });
    setDeals(ds=>ds.filter(d=>d.id!==id)); setExpanded(null);
  }

  useEffect(() => { load(); }, []);

  const inp = { width:"100%", marginBottom:10 };

  if (loading) return <div style={{color:"var(--text3)",padding:40}}>Loading pipeline…</div>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>💼 Deal Pipeline</h1>
          <p style={{color:"var(--text2)",fontSize:13}}>Signal-triggered deals moving from web change to closed revenue.</p>
        </div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{padding:"9px 18px",borderRadius:8,background:"linear-gradient(135deg,#00D9FF,#A855F7)",color:"#06080D",fontWeight:700,fontSize:13,cursor:"pointer",border:"none"}}>+ Add Deal</button>
      </div>

      {msg && <div style={{background:"rgba(63,185,80,0.1)",border:"1px solid rgba(63,185,80,0.3)",borderRadius:8,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#3FB950"}}>{msg}</div>}

      {/* Summary */}
      {pipeline?.summary && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[
            {label:"Total Deals",value:pipeline.summary.total_deals},
            {label:"Active Deals",value:pipeline.summary.active_deals,color:"var(--accent)"},
            {label:"Pipeline Value",value:fmt(pipeline.summary.total_pipeline_value||0),color:"var(--accent2)"},
            {label:"Won Revenue",value:fmt(pipeline.summary.won_value||0),color:"#3FB950"},
          ].map(s=>(
            <div key={s.label} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 18px"}}>
              <div style={{fontSize:20,fontWeight:800,color:s.color||"var(--text)"}}>{s.value}</div>
              <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={add} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
          <div style={{fontWeight:700,marginBottom:14}}>New Deal</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <input style={inp} placeholder="Deal title *" value={form.title} onChange={e=>set("title",e.target.value)} required />
            <input style={inp} placeholder="Company name" value={form.company_name} onChange={e=>set("company_name",e.target.value)} />
            <input style={inp} placeholder="Contact name" value={form.contact_name} onChange={e=>set("contact_name",e.target.value)} />
            <input style={inp} placeholder="Contact title (e.g. VP Sales)" value={form.contact_title} onChange={e=>set("contact_title",e.target.value)} />
            <input style={inp} type="number" placeholder="Deal value (₹)" value={form.value} onChange={e=>set("value",e.target.value)} />
            <input style={inp} placeholder="Country" value={form.country} onChange={e=>set("country",e.target.value)} />
            <select style={inp} value={form.stage} onChange={e=>set("stage",e.target.value)}>
              {STAGES.map(s=><option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </div>
          <textarea style={{width:"100%",marginBottom:12,height:60,resize:"vertical",fontSize:13}} placeholder="Signal trigger or notes…" value={form.notes} onChange={e=>set("notes",e.target.value)} />
          <div style={{display:"flex",gap:8}}>
            <button type="submit" disabled={saving} style={{padding:"9px 20px",borderRadius:7,background:"var(--accent)",color:"#06080D",fontWeight:700,cursor:"pointer",border:"none"}}>{saving?"Saving…":"Create Deal"}</button>
            <button type="button" onClick={()=>setShowAdd(false)} style={{padding:"9px 16px",borderRadius:7,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer"}}>Cancel</button>
          </div>
        </form>
      )}

      {/* Kanban */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,overflowX:"auto"}}>
        {STAGES.map(stage=>{
          const stagePipeline = pipeline?.pipeline?.[stage] || {};
          const stageDeals = deals.filter(d=>d.stage===stage);
          return (
            <div key={stage} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,minWidth:180}}>
              <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontWeight:700,fontSize:13,color:STAGE_COLOR[stage]}}>{STAGE_LABEL[stage]}</span>
                  <span style={{background:"rgba(255,255,255,0.06)",padding:"1px 7px",borderRadius:10,fontSize:11}}>{stageDeals.length}</span>
                </div>
                {stagePipeline.value > 0 && <div style={{fontSize:11,color:"var(--text3)"}}>{fmt(stagePipeline.value)}</div>}
              </div>
              <div style={{padding:"10px 8px",display:"flex",flexDirection:"column",gap:8,minHeight:80}}>
                {stageDeals.map(d=>(
                  <div key={d.id} style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px",cursor:"pointer",border:expanded===d.id?"1px solid var(--accent)":"1px solid transparent"}} onClick={()=>setExpanded(expanded===d.id?null:d.id)}>
                    <div style={{fontWeight:600,fontSize:12,marginBottom:4,lineHeight:1.3}}>{d.title}</div>
                    {d.company_name && <div style={{fontSize:11,color:"var(--text3)",marginBottom:4}}>{d.company_name}</div>}
                    {d.value > 0 && <div style={{fontSize:12,color:"var(--accent2)",fontWeight:700}}>{fmt(d.value)}</div>}
                    {d.country && <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>📍 {d.country}</div>}
                    {!d.compliance_checked && ["Germany","France","Canada","Brazil","Sweden","Italy","Spain"].includes(d.country) && (
                      <div style={{marginTop:6,fontSize:10,color:"#D29922"}}>⚠ Check compliance</div>
                    )}
                    {expanded===d.id && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                        {d.signal_trigger && <div style={{fontSize:11,color:"var(--text2)",marginBottom:8}}>Signal: {d.signal_trigger}</div>}
                        {d.notes && <div style={{fontSize:11,color:"var(--text3)",marginBottom:8}}>{d.notes}</div>}
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {stage!=="won"&&stage!=="lost"&&<button onClick={e=>{e.stopPropagation();move(d.id);}} style={{padding:"4px 10px",fontSize:10,borderRadius:5,background:"rgba(0,217,255,0.1)",color:"var(--accent)",cursor:"pointer",border:"none"}}>→ Move</button>}
                          <button onClick={e=>{e.stopPropagation();del(d.id);}} style={{padding:"4px 10px",fontSize:10,borderRadius:5,background:"rgba(248,81,73,0.1)",color:"var(--red)",cursor:"pointer",border:"none"}}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
