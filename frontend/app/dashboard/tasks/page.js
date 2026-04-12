"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const PRIORITY_COLOR = { low: "#6b7280", medium: "#6366f1", high: "#f59e0b", urgent: "#ef4444" };
const PRIORITY_BG    = { low: "#6b728015", medium: "#6366f115", high: "#f59e0b15", urgent: "#ef444415" };
const STATUS_COLOR   = { open: "#6366f1", in_progress: "#f59e0b", done: "#22c55e", cancelled: "#6b7280" };

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", status: "open", due_date: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  async function load(f = filter) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f === "open") params.set("status", "open");
    else if (f === "overdue") params.set("filter", "overdue");
    else if (f === "today") params.set("filter", "today");
    else if (f === "done") params.set("status", "done");
    const d = await apiFetch(`/tasks?${params}`);
    if (d.success) { setTasks(d.tasks); setStats(d.stats || {}); }
    setLoading(false);
  }

  useEffect(() => { load("open"); }, []);

  function handleFilter(f) { setFilter(f); load(f); }

  function openCreate() {
    setEditing(null);
    setForm({ title: "", description: "", priority: "medium", status: "open", due_date: "" });
    setShowForm(true);
  }

  function openEdit(t) {
    setEditing(t);
    setForm({ title: t.title, description: t.description, priority: t.priority, status: t.status, due_date: t.due_date || "" });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim()) { showToast("Title required.", false); return; }
    setSaving(true);
    const d = editing
      ? await apiFetch(`/tasks/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : await apiFetch("/tasks", { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (d.success) { showToast(editing ? "Updated!" : "Task created!"); setShowForm(false); load(filter); }
    else showToast(d.detail || "Error", false);
  }

  async function complete(t) {
    const d = await apiFetch(`/tasks/${t.id}/complete`, { method: "POST" });
    if (d.success) { showToast("Task done! ✓"); load(filter); }
  }

  async function del(t) {
    if (!confirm("Delete this task?")) return;
    const d = await apiFetch(`/tasks/${t.id}`, { method: "DELETE" });
    if (d.success) { showToast("Deleted."); load(filter); }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Tasks</h1>
          <p style={{ color: "#737373", fontSize: 14, margin: "4px 0 0" }}>
            {stats.open || 0} open · <span style={{ color: "#ef4444" }}>{stats.overdue || 0} overdue</span> · {stats.due_today || 0} due today
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: "10px 20px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + New Task
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Open", value: stats.open || 0, color: "#6366f1" },
          { label: "Overdue", value: stats.overdue || 0, color: "#ef4444" },
          { label: "Due Today", value: stats.due_today || 0, color: "#f59e0b" },
          { label: "Urgent", value: stats.urgent || 0, color: "#ef4444" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#737373", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 16 }}>
        {[["open", "Open"], ["today", "Due Today"], ["overdue", "Overdue"], ["done", "Completed"]].map(([f, lbl]) => (
          <button key={f} onClick={() => handleFilter(f)} style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: filter === f ? "rgba(255,255,255,0.1)" : "transparent", border: `1px solid ${filter === f ? "rgba(255,255,255,0.2)" : "transparent"}`, color: filter === f ? "#fff" : "#737373" }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#737373" }}>Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#b3b3b3", marginBottom: 8 }}>
            {filter === "open" ? "No open tasks" : filter === "overdue" ? "No overdue tasks" : filter === "today" ? "Nothing due today" : "No completed tasks"}
          </div>
          {filter === "open" && (
            <button onClick={openCreate} style={{ padding: "10px 24px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", marginTop: 16 }}>Create Task</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map(t => (
            <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${t.is_overdue ? "rgba(239,68,68,0.25)" : t.is_today ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, opacity: t.status === "done" ? 0.6 : 1 }}>
              {/* Complete checkbox */}
              <button onClick={() => t.status !== "done" && complete(t)} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${t.status === "done" ? "#22c55e" : PRIORITY_COLOR[t.priority]}`, background: t.status === "done" ? "#22c55e" : "transparent", cursor: t.status === "done" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>
                {t.status === "done" && <span style={{ color: "#fff" }}>✓</span>}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.status === "done" ? "#737373" : "#fff", textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
                  <span style={{ background: PRIORITY_BG[t.priority], color: PRIORITY_COLOR[t.priority], border: `1px solid ${PRIORITY_COLOR[t.priority]}40`, borderRadius: 12, padding: "1px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                    {t.priority}
                  </span>
                  {t.is_overdue && <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>OVERDUE</span>}
                  {t.is_today && !t.is_overdue && <span style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>TODAY</span>}
                </div>
                {t.description && <div style={{ fontSize: 12, color: "#737373", marginBottom: 2 }}>{t.description}</div>}
                {t.due_date && (
                  <div style={{ fontSize: 11, color: t.is_overdue ? "#ef4444" : t.is_today ? "#f59e0b" : "#737373" }}>
                    Due: {new Date(t.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {t.status !== "done" && (
                  <button onClick={() => openEdit(t)} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e5e5e5", fontSize: 12, cursor: "pointer" }}>Edit</button>
                )}
                <button onClick={() => del(t)} style={{ padding: "5px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", fontSize: 12, cursor: "pointer" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 32, width: "100%", maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700 }}>{editing ? "Edit Task" : "New Task"}</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Follow up with CTO at Freshworks"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Notes</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  style={{ width: "100%", padding: "9px 10px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 13 }}>
                  {["low", "medium", "high", "urgent"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ width: "100%", padding: "9px 10px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 13 }}>
                  {["open", "in_progress", "done", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : editing ? "Update Task" : "Create Task"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#b3b3b3", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
