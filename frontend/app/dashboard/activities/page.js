"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const TYPE_ICON = { call: "📞", email: "📧", meeting: "🤝", note: "📝", linkedin: "💼", whatsapp: "💬", demo: "🖥️", task: "✅" };
const TYPE_COLOR = { call: "#22c55e", email: "#6366f1", meeting: "#f59e0b", note: "#00F0FF", linkedin: "#0ea5e9", whatsapp: "#22c55e", demo: "#a855f7", task: "#f97316" };
const TYPES = ["call", "email", "meeting", "note", "linkedin", "whatsapp", "demo"];

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [typeCounts, setTypeCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "call", direction: "outbound", title: "", body: "", outcome: "", duration_secs: 0 });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  async function load(type = filterType) {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50 });
    if (type) params.set("type", type);
    const d = await apiFetch(`/activities?${params}`);
    if (d.success) { setActivities(d.activities); setTotal(d.total); setTypeCounts(d.type_counts || {}); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { load(filterType); }, [filterType]);

  async function logActivity() {
    if (!form.title.trim() && !form.body.trim()) { showToast("Add a title or note.", false); return; }
    setSaving(true);
    const d = await apiFetch("/activities", { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (d.success) { showToast("Activity logged!"); setShowForm(false); load(); setForm({ type: "call", direction: "outbound", title: "", body: "", outcome: "", duration_secs: 0 }); }
    else showToast(d.detail || "Error", false);
  }

  async function del(a) {
    const d = await apiFetch(`/activities/${a.id}`, { method: "DELETE" });
    if (d.success) { showToast("Deleted."); load(); }
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const totalActivities = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Activity Timeline</h1>
          <p style={{ color: "#737373", fontSize: 14, margin: "4px 0 0" }}>{total} interactions logged</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + Log Activity
        </button>
      </div>

      {/* Type filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <button onClick={() => setFilterType("")} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !filterType ? "rgba(255,255,255,0.12)" : "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>
          All ({totalActivities})
        </button>
        {TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(filterType === t ? "" : t)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterType === t ? `${TYPE_COLOR[t]}20` : "transparent", border: `1px solid ${TYPE_COLOR[t]}50`, color: filterType === t ? TYPE_COLOR[t] : "#b3b3b3" }}>
            {TYPE_ICON[t]} {t} {typeCounts[t] ? `(${typeCounts[t]})` : ""}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#737373" }}>Loading activities…</div>
      ) : activities.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#b3b3b3", marginBottom: 8 }}>No activities logged yet</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Log calls, emails, meetings, and notes here.</div>
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 24px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Log First Activity</button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Timeline line */}
          <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {activities.map((a, i) => (
              <div key={a.id} style={{ display: "flex", gap: 20, paddingBottom: 20 }}>
                {/* Icon dot */}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${TYPE_COLOR[a.type] || "#6366f1"}20`, border: `2px solid ${TYPE_COLOR[a.type] || "#6366f1"}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, zIndex: 1 }}>
                  {TYPE_ICON[a.type] || "📌"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TYPE_COLOR[a.type] || "#6366f1", textTransform: "capitalize" }}>{a.type}</span>
                      {a.direction && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#737373", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>
                          {a.direction}
                        </span>
                      )}
                      {a.outcome && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                          {a.outcome}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "#737373" }}>{timeAgo(a.created_at)}</span>
                      <button onClick={() => del(a)} style={{ padding: "2px 8px", background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, color: "#ef4444", fontSize: 11, cursor: "pointer" }}>×</button>
                    </div>
                  </div>
                  {a.title && <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{a.title}</div>}
                  {a.body && <div style={{ fontSize: 13, color: "#b3b3b3", lineHeight: 1.6 }}>{a.body}</div>}
                  {a.duration_secs > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#737373" }}>
                      Duration: {Math.floor(a.duration_secs / 60)}m {a.duration_secs % 60}s
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 32, width: "100%", maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700 }}>Log Activity</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14 }}>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Direction</label>
                <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14 }}>
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Discovery call with VP Sales"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Notes</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Key points, action items, follow-ups…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none", resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Outcome</label>
                <select value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14 }}>
                  <option value="">— Select outcome —</option>
                  {["connected", "voicemail", "no_answer", "meeting_booked", "demo_done", "replied", "completed"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Duration (mins)</label>
                <input type="number" value={Math.floor((form.duration_secs || 0) / 60)} onChange={e => setForm(f => ({ ...f, duration_secs: parseInt(e.target.value || 0) * 60 }))}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={logActivity} disabled={saving} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Logging…" : "Log Activity"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#b3b3b3", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
