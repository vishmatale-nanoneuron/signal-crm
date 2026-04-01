"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";

const TYPE_META = {
  hiring_spike:      { color:"#E50914", label:"Hiring Spike",      icon:"📈" },
  new_country_page:  { color:"#0071eb", label:"Country Expansion",  icon:"🌍" },
  pricing_change:    { color:"#f5a623", label:"Pricing Change",     icon:"💰" },
  leadership_change: { color:"#a855f7", label:"Leadership",         icon:"👤" },
  new_product:       { color:"#46d369", label:"New Product",        icon:"🚀" },
  compliance_update: { color:"#e87c03", label:"Compliance",         icon:"⚖️"  },
  partner_page:      { color:"#58a6ff", label:"Partner",            icon:"🤝" },
};
const STRENGTH_COLOR = { high:"#E50914", medium:"#f5a623", low:"#46d369" };
const AVATAR_COLORS  = ["#E50914","#0071eb","#f5a623","#46d369","#a855f7","#58a6ff"];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding:"5px 14px", borderRadius:4, fontSize:11, fontWeight:700, cursor:"pointer",
        background: copied ? "rgba(70,211,105,0.15)" : "rgba(255,255,255,0.08)",
        border: copied ? "1px solid rgba(70,211,105,0.4)" : "1px solid rgba(255,255,255,0.12)",
        color: copied ? "#46d369" : "#b3b3b3", transition:"all 0.2s" }}>
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

function SignalDetail() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const id = searchParams.get("id");

  const [signal,      setSignal]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [analysis,    setAnalysis]    = useState(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [emailDraft,  setEmailDraft]  = useState("");
  const [drafting,    setDrafting]    = useState(false);
  const [showEmail,   setShowEmail]   = useState(false);
  const [dealCreated, setDealCreated] = useState(false);
  const [dealLoading, setDealLoading] = useState(false);
  const [offering,    setOffering]    = useState("cross-border IT services");

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    apiFetch(`/signals/${id}`).then(d => {
      if (d.success) setSignal(d.signal);
      setLoading(false);
    });
  }, [id]);

  async function runAnalysis() {
    setAnalyzing(true);
    const d = await apiFetch(`/ai/analyze/${id}`);
    if (d.success) setAnalysis(d.analysis);
    setAnalyzing(false);
  }

  async function draftEmail() {
    setDrafting(true); setShowEmail(true);
    const d = await apiFetch(`/ai/draft-email/${id}`, {
      method:"POST", body: JSON.stringify({ offering }),
    });
    if (d.success) setEmailDraft(d.email_draft);
    setDrafting(false);
  }

  async function addToPipeline() {
    if (!signal) return;
    setDealLoading(true);
    const r = await apiFetch("/deals", { method:"POST", body: JSON.stringify({
      title: `${signal.account_name} — ${(signal.signal_type||"").replace(/_/g," ")}`,
      company_name: signal.account_name, country: signal.country_hint,
      signal_trigger: signal.title, next_action: signal.recommended_action, stage:"signal",
    })});
    if (r.success) setDealCreated(true);
    setDealLoading(false);
  }

  async function markActioned() {
    await apiFetch(`/signals/${id}/action`, { method:"POST" });
    setSignal(s => s ? { ...s, is_actioned:true } : s);
  }

  if (!id) return (
    <div style={{ textAlign:"center", padding:80 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📡</div>
      <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:8 }}>No signal selected</div>
      <button onClick={() => router.push("/dashboard")} style={{ padding:"10px 24px", borderRadius:4, background:"#E50914", color:"#fff", fontWeight:700, border:"none", cursor:"pointer" }}>← Go to Dashboard</button>
    </div>
  );

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:100, gap:12, color:"#737373" }}>
      <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading signal…
    </div>
  );

  if (!signal) return (
    <div style={{ textAlign:"center", padding:80 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
      <div style={{ fontSize:20, fontWeight:700, color:"#fff", marginBottom:8 }}>Signal not found</div>
      <button onClick={() => router.back()} style={{ padding:"10px 24px", borderRadius:4, background:"#E50914", color:"#fff", fontWeight:700, border:"none", cursor:"pointer", fontSize:14 }}>← Go Back</button>
    </div>
  );

  const t = TYPE_META[signal.signal_type] || { color:"#b3b3b3", label:signal.signal_type, icon:"📡" };
  const avatarColor = AVATAR_COLORS[(signal.account_name?.charCodeAt(0)||0) % AVATAR_COLORS.length];
  const detectedDate = new Date(signal.detected_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

  return (
    <div style={{ maxWidth:920, margin:"0 auto" }}>

      {/* Back */}
      <button onClick={() => router.back()} style={{
        marginBottom:20, padding:"7px 16px", borderRadius:4,
        background:"transparent", border:"1px solid rgba(255,255,255,0.1)",
        color:"#737373", fontSize:12, cursor:"pointer",
      }}>
        ← Back to Signals
      </button>

      {/* Header */}
      <div style={{
        background:"#1a1a1a", border:`1px solid ${t.color}33`,
        borderLeft:`4px solid ${t.color}`, borderRadius:8,
        padding:"28px 32px", marginBottom:20,
      }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:16 }}>
          <div style={{
            width:52, height:52, borderRadius:8, background:avatarColor, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, fontSize:22, color:"#fff",
          }}>
            {signal.account_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
              <span style={{ background:t.color+"20", color:t.color, padding:"3px 12px", borderRadius:20, fontSize:12, fontWeight:700 }}>
                {t.icon} {t.label}
              </span>
              <span style={{
                background: STRENGTH_COLOR[signal.signal_strength]+"20",
                color: STRENGTH_COLOR[signal.signal_strength],
                padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
              }}>
                {(signal.signal_strength||"").toUpperCase()} SIGNAL
              </span>
              {signal.country_hint && <span style={{ color:"#737373", fontSize:13 }}>📍 {signal.country_hint}</span>}
              <span style={{ color:"#737373", fontSize:12 }}>🕐 {detectedDate}</span>
            </div>
            <h1 style={{ fontSize:22, fontWeight:900, color:"#fff", lineHeight:1.4, marginBottom:6 }}>{signal.title}</h1>
            <div style={{ fontSize:13, color:"#b3b3b3", fontWeight:600 }}>{signal.account_name}</div>
          </div>
          <div style={{
            fontSize:32, fontWeight:900, color:"#fff",
            background:"rgba(255,255,255,0.06)", borderRadius:6,
            padding:"8px 16px", textAlign:"center", flexShrink:0,
          }}>
            {signal.score || "—"}<span style={{ fontSize:12, color:"#737373", fontWeight:400 }}>/10</span>
          </div>
        </div>
        <p style={{ color:"#b3b3b3", fontSize:14, lineHeight:1.8, margin:0 }}>{signal.summary}</p>
      </div>

      {/* Before vs After */}
      {(signal.before_snapshot || signal.after_snapshot) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#737373", letterSpacing:"0.1em", marginBottom:10 }}>BEFORE — PREVIOUS STATE</div>
            <pre style={{
              background:"rgba(0,0,0,0.4)", borderRadius:4, padding:"12px 14px",
              fontFamily:"'SF Mono','Fira Code',monospace", fontSize:12, color:"#737373",
              lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
            }}>
              {signal.before_snapshot || "No prior snapshot"}
            </pre>
          </div>
          <div style={{ background:"#1a1a1a", border:"1px solid rgba(70,211,105,0.2)", borderRadius:6, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#46d369", letterSpacing:"0.1em", marginBottom:10 }}>AFTER — DETECTED CHANGE</div>
            <pre style={{
              background:"rgba(70,211,105,0.04)", borderRadius:4, padding:"12px 14px",
              fontFamily:"'SF Mono','Fira Code',monospace", fontSize:12, color:"#46d369",
              lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
            }}>
              {signal.after_snapshot || "Change details unavailable"}
            </pre>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:20, marginBottom:20 }}>

        {/* Left: Evidence + Action */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {signal.proof_text && (
            <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"18px 20px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#737373", letterSpacing:"0.1em", marginBottom:10 }}>🔍 EVIDENCE / PROOF</div>
              <div style={{
                background:"rgba(0,0,0,0.4)", borderRadius:4, padding:"12px 14px",
                fontFamily:"'SF Mono','Fira Code',monospace", fontSize:12, color:"#b3b3b3",
                lineHeight:1.8,
              }}>
                {signal.proof_text}
              </div>
              {signal.proof_url && (
                <a href={signal.proof_url} target="_blank" rel="noreferrer"
                  style={{ display:"inline-block", marginTop:10, fontSize:12, color:"#0071eb", textDecoration:"underline" }}>
                  → View Source ↗
                </a>
              )}
            </div>
          )}
          {signal.recommended_action && (
            <div style={{
              background:"rgba(70,211,105,0.05)", border:"1px solid rgba(70,211,105,0.2)",
              borderRadius:6, padding:"18px 20px",
            }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#46d369", letterSpacing:"0.1em", marginBottom:8 }}>💡 RECOMMENDED ACTION</div>
              <p style={{ fontSize:14, color:"#e5e5e5", lineHeight:1.8, margin:0 }}>{signal.recommended_action}</p>
            </div>
          )}
        </div>

        {/* Right: Actions panel */}
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"22px 20px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#737373", letterSpacing:"0.1em", marginBottom:16 }}>TAKE ACTION</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

            {!dealCreated ? (
              <button onClick={addToPipeline} disabled={dealLoading || signal.is_actioned} style={{
                padding:"12px 18px", borderRadius:4, background:"#E50914", color:"#fff",
                fontWeight:700, fontSize:13, cursor: dealLoading ? "not-allowed" : "pointer",
                border:"none", opacity: signal.is_actioned ? 0.5 : 1,
              }}>
                {dealLoading ? "Creating…" : signal.is_actioned ? "✓ Already in Pipeline" : "+ Add to Pipeline"}
              </button>
            ) : (
              <div style={{ padding:"12px", borderRadius:4, background:"rgba(70,211,105,0.1)", border:"1px solid rgba(70,211,105,0.3)", color:"#46d369", fontWeight:700, fontSize:13, textAlign:"center" }}>
                ✓ Deal Created in Pipeline
              </div>
            )}

            <button onClick={runAnalysis} disabled={analyzing} style={{
              padding:"12px 18px", borderRadius:4, background:"rgba(0,113,235,0.12)",
              border:"1px solid rgba(0,113,235,0.3)", color:"#0071eb",
              fontWeight:700, fontSize:13, cursor: analyzing ? "not-allowed" : "pointer",
            }}>
              {analyzing ? "Analyzing…" : "🤖 AI Analysis"}
            </button>

            <button onClick={() => setShowEmail(e => !e)} style={{
              padding:"12px 18px", borderRadius:4, background:"rgba(168,85,247,0.1)",
              border:"1px solid rgba(168,85,247,0.3)", color:"#a855f7",
              fontWeight:700, fontSize:13, cursor:"pointer",
            }}>
              ✉ Draft Outreach Email
            </button>

            {!signal.is_actioned && (
              <button onClick={markActioned} style={{
                padding:"12px 18px", borderRadius:4, background:"rgba(70,211,105,0.08)",
                border:"1px solid rgba(70,211,105,0.2)", color:"#46d369",
                fontWeight:700, fontSize:13, cursor:"pointer",
              }}>
                ✓ Mark as Done
              </button>
            )}

            {signal.country_hint && (
              <a href={`/dashboard/compliance?country=${encodeURIComponent(signal.country_hint)}`} style={{
                padding:"12px 18px", borderRadius:4, textAlign:"center",
                background:"rgba(245,166,35,0.08)", border:"1px solid rgba(245,166,35,0.2)",
                color:"#f5a623", fontWeight:700, fontSize:13, textDecoration:"none",
              }}>
                ⚖ {signal.country_hint} Compliance
              </a>
            )}

            <a href="/dashboard/email-templates" style={{
              padding:"12px 18px", borderRadius:4, textAlign:"center",
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              color:"#737373", fontWeight:600, fontSize:13, textDecoration:"none",
            }}>
              📧 Email Template Generator
            </a>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(0,113,235,0.2)", borderRadius:6, padding:"22px 24px", marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#0071eb", letterSpacing:"0.1em", marginBottom:16 }}>
            🤖 AI ANALYSIS {analysis.source === "gpt-4o-mini" ? "(GPT-4o-mini)" : "(Rule-Based)"}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:11, color:"#737373", fontWeight:700, marginBottom:6 }}>WHY THIS MATTERS</div>
              <p style={{ fontSize:13, color:"#e5e5e5", lineHeight:1.8, margin:0 }}>{analysis.why_important}</p>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#737373", fontWeight:700, marginBottom:6 }}>SUGGESTED NEXT STEP</div>
              <p style={{ fontSize:13, color:"#e5e5e5", lineHeight:1.8, margin:0 }}>{analysis.suggested_action}</p>
            </div>
          </div>
          <div style={{ padding:"10px 14px", borderRadius:4,
            background: analysis.urgency?.startsWith("HIGH") ? "rgba(229,9,20,0.08)" : "rgba(245,166,35,0.08)",
            border: `1px solid ${analysis.urgency?.startsWith("HIGH") ? "rgba(229,9,20,0.2)" : "rgba(245,166,35,0.2)"}`,
          }}>
            <span style={{ fontSize:11, fontWeight:700, color: analysis.urgency?.startsWith("HIGH") ? "#E50914" : "#f5a623" }}>
              ⏱ URGENCY: {analysis.urgency}
            </span>
            {analysis.ai_score && <span style={{ marginLeft:16, fontSize:11, color:"#737373" }}>AI Score: <b style={{ color:"#fff" }}>{analysis.ai_score}/10</b></span>}
          </div>
        </div>
      )}

      {/* Email Draft */}
      {showEmail && (
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(168,85,247,0.2)", borderRadius:6, padding:"22px 24px", marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#a855f7", letterSpacing:"0.1em", marginBottom:16 }}>✉ AI EMAIL DRAFT</div>
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"#737373", fontWeight:700, marginBottom:5 }}>YOUR OFFERING</div>
              <input value={offering} onChange={e => setOffering(e.target.value)}
                placeholder="e.g. cross-border compliance consulting"
                style={{ width:"100%", padding:"9px 12px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4, color:"#fff", fontSize:13, boxSizing:"border-box" }} />
            </div>
            <button onClick={draftEmail} disabled={drafting} style={{
              padding:"9px 20px", borderRadius:4, background:"#a855f7", color:"#fff",
              fontWeight:700, fontSize:13, cursor:"pointer", border:"none", flexShrink:0,
            }}>
              {drafting ? "Drafting…" : "Generate →"}
            </button>
          </div>
          {drafting && (
            <div style={{ display:"flex", alignItems:"center", gap:8, color:"#737373", fontSize:13 }}>
              <div style={{ width:18, height:18, border:"2px solid #a855f7", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Drafting email…
            </div>
          )}
          {emailDraft && !drafting && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#737373", fontWeight:700 }}>GENERATED EMAIL</div>
                <CopyBtn text={emailDraft} />
              </div>
              <pre style={{
                fontFamily:"'SF Mono','Fira Code',monospace", fontSize:12, color:"#e5e5e5",
                lineHeight:1.9, whiteSpace:"pre-wrap", wordBreak:"break-word",
                background:"rgba(0,0,0,0.4)", padding:"16px", borderRadius:4, margin:0,
              }}>
                {emailDraft}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SignalDetailPage() {
  return (
    <Suspense fallback={
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:100, gap:12, color:"#737373" }}>
        <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Loading…
      </div>
    }>
      <SignalDetail />
    </Suspense>
  );
}
