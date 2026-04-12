"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../../../lib/api";

const STAGES = [
  { key:"signal",      label:"Signal",      color:"#737373", prob:10  },
  { key:"qualified",   label:"Qualified",   color:"#0071eb", prob:25  },
  { key:"proposal",    label:"Proposal",    color:"#f59e0b", prob:50  },
  { key:"negotiation", label:"Negotiation", color:"#a855f7", prob:75  },
  { key:"won",         label:"Won",         color:"#22c55e", prob:100 },
  { key:"lost",        label:"Lost",        color:"#7C3AED", prob:0   },
];
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));
const CURRENCIES = ["INR","USD","EUR","GBP","AED","SGD","AUD","CAD"];
const FLAGS = {
  "India":"🇮🇳","USA":"🇺🇸","UK":"🇬🇧","Germany":"🇩🇪","France":"🇫🇷",
  "Singapore":"🇸🇬","UAE":"🇦🇪","Japan":"🇯🇵","Australia":"🇦🇺","Canada":"🇨🇦",
  "Brazil":"🇧🇷","Netherlands":"🇳🇱","Saudi Arabia":"🇸🇦","South Africa":"🇿🇦",
  "Malaysia":"🇲🇾","Indonesia":"🇮🇩","Philippines":"🇵🇭","Thailand":"🇹🇭",
  "Vietnam":"🇻🇳","Mexico":"🇲🇽","Nigeria":"🇳🇬","Kenya":"🇰🇪","Israel":"🇮🇱",
  "Sweden":"🇸🇪","Spain":"🇪🇸","Italy":"🇮🇹","Poland":"🇵🇱","Turkey":"🇹🇷",
  "South Korea":"🇰🇷","Taiwan":"🇹🇼","Hong Kong":"🇭🇰","China":"🇨🇳",
  "Switzerland":"🇨🇭","Belgium":"🇧🇪","Denmark":"🇩🇰","Norway":"🇳🇴","Finland":"🇫🇮",
  "New Zealand":"🇳🇿","Chile":"🇨🇱","Colombia":"🇨🇴","Morocco":"🇲🇦","Qatar":"🇶🇦",
};

const S = {
  input: { width:"100%", padding:"10px 12px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" },
  label: { fontSize:11, color:"#737373", fontWeight:700, letterSpacing:"0.08em", marginBottom:5, display:"block" },
  field: { marginBottom:14 },
};

function fmt(val, currency = "INR") {
  const sym = { INR:"₹",USD:"$",EUR:"€",GBP:"£",AED:"AED ",SGD:"S$",AUD:"A$",CAD:"C$" }[currency] || "₹";
  if (val >= 10000000) return `${sym}${(val/10000000).toFixed(1)}Cr`;
  if (val >= 100000)   return `${sym}${(val/100000).toFixed(1)}L`;
  if (val >= 1000)     return `${sym}${(val/1000).toFixed(0)}K`;
  return `${sym}${val}`;
}
function daysSince(iso) { return Math.floor((Date.now()-new Date(iso).getTime())/86400000); }

function DealModal({ deal, onClose, onSave }) {
  const blank = { title:"",company_name:"",contact_name:"",value:0,currency:"INR",stage:"signal",country:"",industry:"",next_action:"",notes:"" };
  const [form, setForm] = useState(deal ? { ...deal } : blank);
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  async function save() {
    setSaving(true);
    const r = await apiFetch(deal ? `/deals/${deal.id}` : "/deals", { method: deal ? "PUT" : "POST", body: JSON.stringify(form) });
    if (r.success) { onSave(r.deal, !deal); onClose(); }
    setSaving(false);
  }
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#1e1e1e",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"28px 28px 24px",width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:22 }}>
          <div style={{ fontSize:16,fontWeight:800,color:"#fff" }}>{deal ? "Edit Deal" : "New Deal"}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#737373",fontSize:20,cursor:"pointer" }}>✕</button>
        </div>
        <div style={S.field}><label style={S.label}>TITLE *</label><input style={S.input} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Acme Corp — SaaS Expansion"/></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div style={S.field}><label style={S.label}>COMPANY</label><input style={S.input} value={form.company_name} onChange={e=>set("company_name",e.target.value)}/></div>
          <div style={S.field}><label style={S.label}>CONTACT</label><input style={S.input} value={form.contact_name} onChange={e=>set("contact_name",e.target.value)}/></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div style={S.field}><label style={S.label}>VALUE</label><input style={S.input} type="number" min="0" value={form.value} onChange={e=>set("value",parseFloat(e.target.value)||0)}/></div>
          <div style={S.field}><label style={S.label}>CURRENCY</label>
            <select style={{ ...S.input }} value={form.currency} onChange={e=>set("currency",e.target.value)}>
              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div style={S.field}><label style={S.label}>STAGE</label>
            <select style={{ ...S.input }} value={form.stage} onChange={e=>set("stage",e.target.value)}>
              {STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div style={S.field}><label style={S.label}>COUNTRY</label><input style={S.input} value={form.country} onChange={e=>set("country",e.target.value)} placeholder="e.g. Germany"/></div>
        </div>
        <div style={S.field}><label style={S.label}>INDUSTRY</label><input style={S.input} value={form.industry} onChange={e=>set("industry",e.target.value)} placeholder="SaaS / Logistics / FinTech…"/></div>
        <div style={S.field}><label style={S.label}>NEXT ACTION</label><input style={S.input} value={form.next_action} onChange={e=>set("next_action",e.target.value)} placeholder="e.g. Send proposal by Friday"/></div>
        <div style={S.field}><label style={S.label}>NOTES</label><textarea style={{ ...S.input,resize:"vertical",minHeight:72 }} value={form.notes} onChange={e=>set("notes",e.target.value)}/></div>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:8 }}>
          <button onClick={onClose} style={{ padding:"10px 20px",borderRadius:4,background:"transparent",border:"1px solid rgba(255,255,255,0.12)",color:"#b3b3b3",fontSize:13,cursor:"pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving||!form.title} style={{ padding:"10px 24px",borderRadius:8,background:saving?"rgba(124,58,237,0.5)":"linear-gradient(135deg,#00F0FF,#7C3AED)",color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer",border:"none" }}>
            {saving ? "Saving…" : deal ? "Save Changes" : "Create Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ deal, onMove, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const days = daysSince(deal.updated_at);
  const stageIdx = STAGES.findIndex(s => s.key === deal.stage);
  useEffect(() => {
    if (!menuOpen) return;
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);
  return (
    <div style={{ background:"#242424",border:"1px solid rgba(255,255,255,0.07)",borderRadius:5,padding:"12px 14px",marginBottom:8,position:"relative" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6 }}>
        <div style={{ fontSize:13,fontWeight:700,color:"#fff",lineHeight:1.4,flex:1 }}>{deal.company_name||deal.title}</div>
        <div ref={menuRef} style={{ position:"relative",flexShrink:0 }}>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{ background:"none",border:"none",color:"#737373",fontSize:16,cursor:"pointer",padding:"0 4px" }}>⋯</button>
          {menuOpen && (
            <div style={{ position:"absolute",top:"100%",right:0,zIndex:50,background:"#2a2a2a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,minWidth:150,boxShadow:"0 8px 24px rgba(0,0,0,0.6)",overflow:"hidden" }}>
              {[
                stageIdx < STAGES.length-1 && { label:`→ ${STAGES[stageIdx+1]?.label}`, fn:()=>{onMove(deal.id,"forward");setMenuOpen(false);} },
                stageIdx > 0               && { label:`← ${STAGES[stageIdx-1]?.label}`, fn:()=>{onMove(deal.id,"back");setMenuOpen(false);} },
                { label:"✏ Edit",   fn:()=>{onEdit(deal);setMenuOpen(false);} },
                { label:"🗑 Delete", fn:()=>{onDelete(deal.id);setMenuOpen(false);} },
              ].filter(Boolean).map((item,i)=>(
                <div key={i} onClick={item.fn} style={{ padding:"9px 14px",fontSize:12,color:"#e5e5e5",cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{item.label}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      {deal.company_name && deal.title !== deal.company_name && (
        <div style={{ fontSize:11,color:"#737373",marginBottom:6 }}>{deal.title}</div>
      )}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
        <span style={{ fontSize:15,fontWeight:900,color:"#fff" }}>{fmt(deal.value,deal.currency)}</span>
        <span style={{ fontSize:13 }}>{FLAGS[deal.country]||"🌍"} {deal.country||""}</span>
      </div>
      {deal.next_action && (
        <div style={{ fontSize:11,color:"#737373",lineHeight:1.5,marginBottom:6,borderLeft:"2px solid rgba(255,255,255,0.08)",paddingLeft:8 }}>
          {deal.next_action.slice(0,80)}{deal.next_action.length>80?"…":""}
        </div>
      )}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <span style={{ fontSize:10,color:days>21?"#7C3AED":days>7?"#f59e0b":"#737373",fontWeight:days>21?700:400 }}>
          {days>21?`⚠ ${days}d stale`:`${days}d ago`}
        </span>
        {stageIdx < STAGES.length-1 && (
          <button onClick={()=>onMove(deal.id,"forward")} style={{ padding:"4px 10px",borderRadius:20,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#b3b3b3",fontSize:10,fontWeight:700,cursor:"pointer" }}>
            {STAGES[stageIdx+1]?.label} →
          </button>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const [deals,    setDeals]    = useState([]);
  const [pipeline, setPipeline] = useState({});
  const [summary,  setSummary]  = useState({});
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState("kanban");
  const [modal,    setModal]    = useState(null);
  const [toast,    setToast]    = useState(null);
  const [sortKey,  setSortKey]  = useState("updated_at");
  const [sortDir,  setSortDir]  = useState(-1);

  const showT = useCallback((msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const [dl, pl] = await Promise.all([apiFetch("/deals"), apiFetch("/deals/pipeline")]);
    if (dl.success) setDeals(dl.deals);
    if (pl.success) { setPipeline(pl.pipeline); setSummary(pl.summary); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function moveDeal(id, dir) {
    if (dir === "forward") {
      const r = await apiFetch(`/deals/${id}/move`, { method:"POST" });
      if (r.success) { showT(`Moved to ${r.deal.stage}`); load(); }
    } else {
      const deal = deals.find(d => d.id === id);
      if (!deal) return;
      const idx = STAGES.findIndex(s => s.key === deal.stage);
      if (idx <= 0) return;
      const r = await apiFetch(`/deals/${id}`, { method:"PUT", body: JSON.stringify({ stage: STAGES[idx-1].key }) });
      if (r.success) { showT(`Moved back to ${r.deal.stage}`); load(); }
    }
  }

  async function deleteDeal(id) {
    if (!confirm("Delete this deal?")) return;
    const r = await apiFetch(`/deals/${id}`, { method:"DELETE" });
    if (r.success) { showT("Deal deleted", "warn"); load(); }
  }

  function handleSave(deal, isNew) {
    showT(isNew ? `Deal created: ${deal.company_name||deal.title}` : "Deal updated");
    load();
  }

  const sorted = [...deals].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === "string") va = va.toLowerCase(), vb = vb.toLowerCase();
    return va < vb ? sortDir : va > vb ? -sortDir : 0;
  });
  function toggleSort(key) { sortKey === key ? setSortDir(d => -d) : (setSortKey(key), setSortDir(-1)); }

  const pv  = summary.total_pipeline_value || 0;
  const wv  = summary.won_value || 0;
  const tot = summary.total_deals || 0;
  const won = deals.filter(d => d.stage === "won").length;
  const closed = deals.filter(d => ["won","lost"].includes(d.stage)).length;
  const wr  = closed > 0 ? Math.round(won/closed*100) : 0;

  return (
    <div>
      {toast && (
        <div style={{ position:"fixed",bottom:32,right:32,zIndex:300,background:toast.type==="success"?"#22c55e":toast.type==="warn"?"#f59e0b":"#7C3AED",color:"#fff",padding:"12px 20px",borderRadius:6,fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideUp 0.3s ease" }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {toast.msg}
        </div>
      )}

      {modal !== null && <DealModal deal={modal==="new"?null:modal} onClose={()=>setModal(null)} onSave={handleSave}/>}

      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:28,fontWeight:900,color:"#fff",marginBottom:4 }}>Deal Pipeline</h1>
          <p style={{ color:"#737373",fontSize:13 }}>Track every opportunity from signal to closed revenue.</p>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <div style={{ display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:4,padding:2 }}>
            {[["kanban","⊞ Kanban"],["list","≡ List"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:"7px 14px",borderRadius:3,fontSize:12,fontWeight:600,cursor:"pointer",background:view===v?"rgba(255,255,255,0.12)":"transparent",color:view===v?"#fff":"#737373",border:"none",transition:"all 0.15s" }}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setModal("new")} style={{ padding:"9px 20px",borderRadius:8,background:"linear-gradient(135deg,#00F0FF,#7C3AED)",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",border:"none" }}>+ New Deal</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24 }}>
        {[
          { label:"Pipeline Value", val:fmt(pv),       color:"#fff" },
          { label:"Won Revenue",    val:fmt(wv),        color:"#22c55e" },
          { label:"Win Rate",       val:`${wr}%`,       color:wr>=50?"#22c55e":wr>=25?"#f59e0b":"#7C3AED" },
          { label:"Total Deals",    val:tot,            color:"#b3b3b3" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#1a1a1a",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"14px 18px" }}>
            <div style={{ fontSize:24,fontWeight:900,color:s.color,marginBottom:4 }}>{s.val}</div>
            <div style={{ fontSize:11,color:"#737373" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:80,gap:12,color:"#737373" }}>
          <div style={{ width:24,height:24,border:"2px solid #E50914",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading pipeline…
        </div>
      )}

      {/* Kanban */}
      {!loading && view === "kanban" && (
        <div style={{ display:"flex",gap:12,overflowX:"auto",paddingBottom:16,alignItems:"flex-start" }}>
          {STAGES.map(stage => {
            const col = pipeline[stage.key] || { deals:[],count:0,value:0 };
            const isWon = stage.key === "won";
            return (
              <div key={stage.key} style={{ minWidth:232,flex:"0 0 232px" }}>
                <div style={{ background:isWon?"rgba(70,211,105,0.08)":"#1a1a1a",border:`1px solid ${isWon?"rgba(70,211,105,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:5,padding:"12px 14px",marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ width:8,height:8,borderRadius:"50%",background:stage.color,display:"inline-block" }}/>
                      <span style={{ fontSize:12,fontWeight:700,color:"#fff" }}>{stage.label}</span>
                    </div>
                    <span style={{ background:stage.color+"22",color:stage.color,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10 }}>{col.count}</span>
                  </div>
                  <div style={{ fontSize:13,fontWeight:700,color:stage.color }}>{fmt(col.value)}</div>
                </div>
                {col.deals?.length === 0 ? (
                  <div style={{ padding:"20px 14px",textAlign:"center",color:"#444",fontSize:12,border:"1px dashed rgba(255,255,255,0.06)",borderRadius:5 }}>No deals</div>
                ) : col.deals.map(deal=>(
                  <KanbanCard key={deal.id} deal={deal} onMove={moveDeal} onEdit={d=>setModal(d)} onDelete={deleteDeal}/>
                ))}
                <button onClick={()=>setModal({ stage:stage.key,title:"",company_name:"",value:0,currency:"INR",country:"",industry:"",next_action:"",notes:"" })}
                  style={{ width:"100%",padding:"9px",borderRadius:4,background:"transparent",border:"1px dashed rgba(255,255,255,0.06)",color:"#444",fontSize:12,cursor:"pointer",marginTop:4 }}
                  onMouseEnter={e=>{e.currentTarget.style.color="#737373";e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";}}
                  onMouseLeave={e=>{e.currentTarget.style.color="#444";e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";}}>
                  + Add deal
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {!loading && view === "list" && (
        <div style={{ background:"#1a1a1a",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 2fr 1fr 1fr",background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            {[["company_name","Company"],["value","Value"],["stage","Stage"],["country","Country"],["next_action","Next Action"],["updated_at","Days Old"],["","Actions"]].map(([key,label],i)=>(
              <div key={i} onClick={()=>key&&toggleSort(key)} style={{ padding:"11px 14px",fontSize:11,fontWeight:700,color:sortKey===key?"#fff":"#737373",letterSpacing:"0.08em",cursor:key?"pointer":"default",userSelect:"none",display:"flex",alignItems:"center",gap:4 }}>
                {label}{sortKey===key&&<span style={{ fontSize:9 }}>{sortDir>0?"▲":"▼"}</span>}
              </div>
            ))}
          </div>
          {sorted.length === 0 && <div style={{ padding:"40px",textAlign:"center",color:"#737373",fontSize:13 }}>No deals yet. Click "+ New Deal" to add one.</div>}
          {sorted.map((deal,i)=>{
            const stage = STAGE_MAP[deal.stage]||{ color:"#737373",label:deal.stage };
            const days = daysSince(deal.updated_at);
            return (
              <div key={deal.id} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 2fr 1fr 1fr",borderBottom:i<sorted.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ padding:"13px 14px" }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#fff" }}>{deal.company_name||deal.title}</div>
                  {deal.company_name&&<div style={{ fontSize:11,color:"#737373" }}>{deal.title}</div>}
                </div>
                <div style={{ padding:"13px 14px",fontSize:13,fontWeight:700,color:"#fff",display:"flex",alignItems:"center" }}>{fmt(deal.value,deal.currency)}</div>
                <div style={{ padding:"13px 14px",display:"flex",alignItems:"center" }}>
                  <span style={{ background:stage.color+"20",color:stage.color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{stage.label}</span>
                </div>
                <div style={{ padding:"13px 14px",fontSize:13,color:"#b3b3b3",display:"flex",alignItems:"center" }}>{FLAGS[deal.country]||"🌍"} {deal.country}</div>
                <div style={{ padding:"13px 14px",fontSize:12,color:"#737373",display:"flex",alignItems:"center" }}>{deal.next_action?.slice(0,60)||"—"}</div>
                <div style={{ padding:"13px 14px",display:"flex",alignItems:"center" }}>
                  <span style={{ fontSize:12,color:days>21?"#7C3AED":days>7?"#f59e0b":"#737373",fontWeight:days>21?700:400 }}>{days>21?`⚠ ${days}d`:`${days}d`}</span>
                </div>
                <div style={{ padding:"13px 14px",display:"flex",alignItems:"center",gap:8 }}>
                  <button onClick={()=>setModal(deal)} style={{ padding:"5px 10px",borderRadius:3,background:"rgba(255,255,255,0.06)",border:"none",color:"#b3b3b3",fontSize:11,cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>deleteDeal(deal.id)} style={{ padding:"5px 10px",borderRadius:3,background:"rgba(124,58,237,0.08)",border:"none",color:"#7C3AED",fontSize:11,cursor:"pointer" }}>Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
