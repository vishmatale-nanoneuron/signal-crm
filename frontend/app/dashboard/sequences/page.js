"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const STATUS_COLOR = { draft: "#6b7280", active: "#22c55e", paused: "#f59e0b", completed: "#6366f1" };
const STEP_TYPE_ICON = { email: "📧", call: "📞", linkedin: "💼", whatsapp: "💬", wait: "⏳", task: "✅" };

export default function SequencesPage() {
  const [sequences, setSequences] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", status: "draft" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [steps, setSteps] = useState({});
  const [showStepForm, setShowStepForm] = useState(null);
  const [stepForm, setStepForm] = useState({ step_number: 1, type: "email", subject: "", body: "", delay_days: 1 });

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  async function load() {
    setLoading(true);
    const d = await apiFetch("/sequences");
    if (d.success) { setSequences(d.sequences); setTotal(d.total); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function loadSteps(seqId) {
    const d = await apiFetch(`/sequences/${seqId}/steps`);
    if (d.success) setSteps(s => ({ ...s, [seqId]: d.steps }));
  }

  function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!steps[id]) loadSteps(id);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", status: "draft" });
    setShowForm(true);
  }

  function openEdit(seq) {
    setEditing(seq);
    setForm({ name: seq.name, description: seq.description || "", status: seq.status });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { showToast("Name required.", false); return; }
    setSaving(true);
    const d = editing
      ? await apiFetch(`/sequences/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : await apiFetch("/sequences", { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (d.success) { showToast(editing ? "Updated!" : "Sequence created!"); setShowForm(false); load(); }
    else showToast(d.detail || "Error", false);
  }

  async function del(seq) {
    if (!confirm(`Delete "${seq.name}"?`)) return;
    const d = await apiFetch(`/sequences/${seq.id}`, { method: "DELETE" });
    if (d.success) { showToast("Deleted."); load(); }
  }

  async function addStep(seqId) {
    if (!stepForm.body.trim()) { showToast("Step body required.", false); return; }
    setSaving(true);
    const d = await apiFetch(`/sequences/${seqId}/steps`, { method: "POST", body: JSON.stringify(stepForm) });
    setSaving(false);
    if (d.success) { showToast("Step added!"); setShowStepForm(null); loadSteps(seqId); setStepForm({ step_number: 1, type: "email", subject: "", body: "", delay_days: 1 }); }
    else showToast(d.detail || "Error", false);
  }

  async function delStep(seqId, stepId) {
    const d = await apiFetch(`/sequences/${seqId}/steps/${stepId}`, { method: "DELETE" });
    if (d.success) { showToast("Step removed."); loadSteps(seqId); }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Sequences</h1>
          <p style={{ color: "#737373", fontSize: 14, margin: "4px 0 0" }}>{total} outreach sequences</p>
        </div>
        <button onClick={openCreate} style={{ padding: "10px 20px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + New Sequence
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#737373" }}>Loading sequences…</div>
      ) : sequences.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔁</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#b3b3b3", marginBottom: 8 }}>No sequences yet</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Build automated outreach sequences for your prospects.</div>
          <button onClick={openCreate} style={{ padding: "10px 24px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Create Sequence
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sequences.map(seq => (
            <div key={seq.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => toggleExpand(seq.id)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", color: "#737373", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {expandedId === seq.id ? "▾" : "▸"}
                </button>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{seq.name}</span>
                    <span style={{ background: `${STATUS_COLOR[seq.status]}20`, color: STATUS_COLOR[seq.status], border: `1px solid ${STATUS_COLOR[seq.status]}40`, borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                      {seq.status}
                    </span>
                  </div>
                  {seq.description && <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>{seq.description}</div>}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#737373" }}>
                  <span><span style={{ color: "#6366f1", fontWeight: 700 }}>{seq.total_steps || 0}</span> steps</span>
                  <span><span style={{ color: "#22c55e", fontWeight: 700 }}>{seq.active_enrollments || 0}</span> active</span>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(seq)} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e5e5e5", fontSize: 12, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => del(seq)} style={{ padding: "5px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", fontSize: 12, cursor: "pointer" }}>×</button>
                </div>
              </div>

              {/* Expanded steps */}
              {expandedId === seq.id && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>Steps</span>
                    <button onClick={() => { setShowStepForm(seq.id); setStepForm({ step_number: (steps[seq.id]?.length || 0) + 1, type: "email", subject: "", body: "", delay_days: 1 }); }}
                      style={{ padding: "4px 12px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, color: "#6366f1", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      + Add Step
                    </button>
                  </div>

                  {!steps[seq.id] ? (
                    <div style={{ color: "#737373", fontSize: 13, padding: "8px 0" }}>Loading steps…</div>
                  ) : steps[seq.id].length === 0 ? (
                    <div style={{ color: "#737373", fontSize: 13, padding: "8px 0", textAlign: "center" }}>No steps yet. Add the first step to this sequence.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {steps[seq.id].map((step, idx) => (
                        <div key={step.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          {/* Step connector */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                              {STEP_TYPE_ICON[step.type] || "📌"}
                            </div>
                            {idx < steps[seq.id].length - 1 && (
                              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", marginTop: 4 }} />
                            )}
                          </div>

                          <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "capitalize" }}>Day {step.delay_days} · {step.type}</span>
                                {step.subject && <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginTop: 3 }}>{step.subject}</div>}
                                <div style={{ fontSize: 12, color: "#b3b3b3", marginTop: 2, lineHeight: 1.5, maxWidth: 500 }}>{step.body}</div>
                              </div>
                              <button onClick={() => delStep(seq.id, step.id)} style={{ padding: "2px 8px", background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, color: "#ef4444", fontSize: 11, cursor: "pointer", marginLeft: 8, flexShrink: 0 }}>×</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add step inline form */}
                  {showStepForm === seq.id && (
                    <div style={{ marginTop: 16, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>New Step</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#737373", display: "block", marginBottom: 3 }}>Type</label>
                          <select value={stepForm.type} onChange={e => setStepForm(s => ({ ...s, type: e.target.value }))}
                            style={{ width: "100%", padding: "7px 10px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13 }}>
                            {Object.keys(STEP_TYPE_ICON).map(t => <option key={t} value={t}>{STEP_TYPE_ICON[t]} {t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#737373", display: "block", marginBottom: 3 }}>Send on Day</label>
                          <input type="number" value={stepForm.delay_days} onChange={e => setStepForm(s => ({ ...s, delay_days: parseInt(e.target.value) || 1 }))} min={1}
                            style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#737373", display: "block", marginBottom: 3 }}>Subject (optional)</label>
                          <input value={stepForm.subject} onChange={e => setStepForm(s => ({ ...s, subject: e.target.value }))} placeholder="Email subject…"
                            style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none" }} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: "#737373", display: "block", marginBottom: 3 }}>Message / Notes *</label>
                        <textarea value={stepForm.body} onChange={e => setStepForm(s => ({ ...s, body: e.target.value }))} rows={3} placeholder="Write the message template…"
                          style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", resize: "vertical" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => addStep(seq.id)} disabled={saving} style={{ padding: "7px 18px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                          {saving ? "Adding…" : "Add Step"}
                        </button>
                        <button onClick={() => setShowStepForm(null)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#b3b3b3", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sequence Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 32, width: "100%", maxWidth: 440 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700 }}>{editing ? "Edit Sequence" : "New Sequence"}</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. SaaS Outbound Outreach"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14 }}>
                {["draft", "active", "paused"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#b3b3b3", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
