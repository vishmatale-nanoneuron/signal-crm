"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";

const PRIORITY_META = {
  urgent: { color:"#E50914", bg:"rgba(229,9,20,0.12)",    label:"URGENT",  icon:"🔥", order:0 },
  high:   { color:"#f5a623", bg:"rgba(245,166,35,0.12)",  label:"HIGH",    icon:"⚡", order:1 },
  medium: { color:"#0071eb", bg:"rgba(0,113,235,0.12)",   label:"MEDIUM",  icon:"📌", order:2 },
  low:    { color:"#737373", bg:"rgba(115,115,115,0.12)", label:"LOW",     icon:"📎", order:3 },
};

const TYPE_LABEL = {
  signal_action:    { label:"Signal Follow-up",  icon:"📡" },
  deal_followup:    { label:"Deal Follow-up",    icon:"💼" },
  compliance_check: { label:"Compliance Check",  icon:"⚖️"  },
  watchlist_setup:  { label:"Setup",             icon:"👁"  },
  default:          { label:"Action",            icon:"✅"  },
};

function ActionCard({ action, onComplete, completing }) {
  const priority = PRIORITY_META[action.priority] || PRIORITY_META.medium;
  const typeInfo = TYPE_LABEL[action.action_type] || TYPE_LABEL.default;

  return (
    <div style={{
      background:"#1a1a1a", borderRadius:6, padding:"18px 20px", marginBottom:8,
      border:"1px solid rgba(255,255,255,0.06)",
      borderLeft:`3px solid ${priority.color}`,
      transition:"background 0.15s, opacity 0.3s",
      opacity: completing ? 0.4 : 1,
    }}
      onMouseEnter={e => !completing && (e.currentTarget.style.background="#222")}
      onMouseLeave={e => !completing && (e.currentTarget.style.background="#1a1a1a")}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
        <div style={{ flex:1 }}>
          {/* Badges */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            <span style={{ background:priority.bg, color:priority.color, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
              {priority.icon} {priority.label}
            </span>
            <span style={{ background:"rgba(255,255,255,0.05)", color:"#b3b3b3", padding:"2px 10px", borderRadius:20, fontSize:11 }}>
              {typeInfo.icon} {typeInfo.label}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:6, lineHeight:1.4 }}>
            {action.title || action.action}
          </div>

          {/* Description */}
          {action.description && (
            <div style={{ fontSize:13, color:"#b3b3b3", lineHeight:1.6, marginBottom:8 }}>
              {action.description}
            </div>
          )}

          {/* Company / context */}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            {action.company_name && (
              <span style={{ color:"#737373", fontSize:12 }}>🏢 {action.company_name}</span>
            )}
            {action.country && (
              <span style={{ color:"#737373", fontSize:12 }}>📍 {action.country}</span>
            )}
          </div>
        </div>

        {/* Complete button */}
        <button
          onClick={() => onComplete(action.id)}
          disabled={completing}
          style={{
            padding:"9px 18px", borderRadius:20,
            background: completing ? "rgba(70,211,105,0.05)" : "rgba(70,211,105,0.1)",
            border:"1px solid rgba(70,211,105,0.3)", color:"#46d369",
            fontSize:12, fontWeight:700, cursor: completing ? "not-allowed" : "pointer",
            flexShrink:0, transition:"all 0.15s",
            whiteSpace:"nowrap",
          }}
          onMouseEnter={e => !completing && (e.currentTarget.style.background="rgba(70,211,105,0.2)")}
          onMouseLeave={e => !completing && (e.currentTarget.style.background="rgba(70,211,105,0.1)")}
        >
          {completing ? "Done ✓" : "✓ Done"}
        </button>
      </div>
    </div>
  );
}

export default function NextActionsPage() {
  const [actions,    setActions]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [completing, setCompleting] = useState(null);
  const [doneCount,  setDoneCount]  = useState(0);
  const [toast,      setToast]      = useState(null);

  const showT = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const d = await apiFetch("/next-actions");
    if (d.success) setActions(d.actions || d.next_actions || []);
    setLoading(false);
  }

  async function complete(id) {
    setCompleting(id);
    await apiFetch(`/next-actions/${id}/complete`, { method:"POST" });
    // Brief pause for feedback
    await new Promise(r => setTimeout(r, 600));
    setActions(a => a.filter(x => x.id !== id));
    setDoneCount(c => c + 1);
    setCompleting(null);
    showT("Action completed!");
  }

  useEffect(() => { load(); }, []);

  // Group by priority
  const grouped = Object.entries(PRIORITY_META)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, meta]) => ({
      key, meta,
      items: actions.filter(a => (a.priority || "medium") === key),
    }))
    .filter(g => g.items.length > 0);

  const urgentCount = actions.filter(a => a.priority === "urgent").length;

  return (
    <div>
      {toast && (
        <div style={{
          position:"fixed", bottom:32, right:32, zIndex:999, background:"#46d369",
          color:"#fff", padding:"12px 20px", borderRadius:6,
          fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
          animation:"slideUp 0.3s ease",
        }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>Next Actions</h1>
        <p style={{ color:"#737373", fontSize:13 }}>AI-ranked sales actions based on your signals, deals, and pipeline.</p>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:10, marginBottom:28, flexWrap:"wrap" }}>
        <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"14px 22px" }}>
          <div style={{ fontSize:24, fontWeight:900, color:"#fff" }}>{actions.length}</div>
          <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Pending Actions</div>
        </div>
        {urgentCount > 0 && (
          <div style={{ background:"rgba(229,9,20,0.08)", border:"1px solid rgba(229,9,20,0.2)", borderRadius:6, padding:"14px 22px" }}>
            <div style={{ fontSize:24, fontWeight:900, color:"#E50914" }}>{urgentCount}</div>
            <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Urgent Today</div>
          </div>
        )}
        {doneCount > 0 && (
          <div style={{ background:"rgba(70,211,105,0.06)", border:"1px solid rgba(70,211,105,0.2)", borderRadius:6, padding:"14px 22px" }}>
            <div style={{ fontSize:24, fontWeight:900, color:"#46d369" }}>{doneCount}</div>
            <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>Completed Today</div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:"#737373" }}>
          <div style={{ width:24, height:24, border:"2px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Generating actions…
        </div>
      )}

      {!loading && actions.length === 0 && (
        <div style={{ background:"#1a1a1a", borderRadius:8, padding:"72px 32px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
          {doneCount > 0 ? (
            <>
              <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
              <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>All done for today!</div>
              <div style={{ color:"#737373", fontSize:14 }}>You completed {doneCount} action{doneCount > 1 ? "s" : ""}. Check back when new signals arrive.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize:56, marginBottom:16 }}>📋</div>
              <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>No actions pending</div>
              <div style={{ color:"#737373", fontSize:14, maxWidth:360, margin:"0 auto" }}>
                Actions are generated from your signals and deal pipeline. Add companies to your watchlist or load signals to get started.
              </div>
            </>
          )}
        </div>
      )}

      {/* Priority-grouped actions */}
      {grouped.map(({ key, meta, items }) => (
        <div key={key} style={{ marginBottom:32 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <span style={{ fontSize:18 }}>{meta.icon}</span>
            <span style={{ fontSize:16, fontWeight:700, color:meta.color }}>{meta.label}</span>
            <span style={{ fontSize:12, background:meta.bg, color:meta.color, padding:"2px 8px", borderRadius:10, fontWeight:700 }}>
              {items.length}
            </span>
          </div>
          {items.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onComplete={complete}
              completing={completing === action.id}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
