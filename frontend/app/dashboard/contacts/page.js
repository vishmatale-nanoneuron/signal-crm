"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const STAGES = ["prospect", "mql", "sql", "opportunity", "customer", "churned"];
const STAGE_COLOR = {
  prospect: "#6366f1", mql: "#8b5cf6", sql: "#00F0FF",
  opportunity: "#f59e0b", customer: "#22c55e", churned: "#6b7280",
};
const STAGE_LABEL = {
  prospect: "Prospect", mql: "MQL", sql: "SQL",
  opportunity: "Opportunity", customer: "Customer", churned: "Churned",
};

function ScoreBadge({ score }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 25 ? "#f97316" : "#ef4444";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: `${color}18`, border: `1px solid ${color}40`,
      color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>
      {score}
    </span>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [stages, setStages] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", title: "", department: "", country: "", linkedin: "", stage: "prospect", source: "manual", notes: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  async function load(q = search, stage = filterStage) {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50, offset: 0 });
    if (q) params.set("q", q);
    if (stage) params.set("stage", stage);
    const d = await apiFetch(`/contacts?${params}`);
    if (d.success) { setContacts(d.contacts); setTotal(d.total); setStages(d.stages || {}); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search, filterStage), 350);
    return () => clearTimeout(t);
  }, [search, filterStage]);

  function openCreate() {
    setEditing(null);
    setForm({ first_name: "", last_name: "", email: "", phone: "", title: "", department: "", country: "", linkedin: "", stage: "prospect", source: "manual", notes: "" });
    setShowForm(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({ first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, title: c.title, department: c.department, country: c.country, linkedin: c.linkedin || "", stage: c.stage, source: c.source, notes: c.notes || "" });
    setShowForm(true);
  }

  async function save() {
    if (!form.first_name.trim()) { showToast("First name required.", false); return; }
    setSaving(true);
    const d = editing
      ? await apiFetch(`/contacts/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : await apiFetch("/contacts", { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (d.success) { showToast(editing ? "Contact updated!" : "Contact created!"); setShowForm(false); load(); }
    else showToast(d.detail || "Error", false);
  }

  async function del(c) {
    if (!confirm(`Delete ${c.name || c.first_name}?`)) return;
    const d = await apiFetch(`/contacts/${c.id}`, { method: "DELETE" });
    if (d.success) { showToast("Deleted."); load(); }
  }

  async function scoreContact(c) {
    const d = await apiFetch(`/contacts/${c.id}/score`, { method: "POST" });
    if (d.success) { showToast(`Score updated: ${d.new_score}`); load(); }
  }

  const totalContacts = Object.values(stages).reduce((a, b) => a + b, 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Contacts</h1>
          <p style={{ color: "#737373", fontSize: 14, margin: "4px 0 0" }}>
            {total} contacts · AI-scored · {Object.keys(stages).length} stages
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: "10px 20px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + Add Contact
        </button>
      </div>

      {/* Stage pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={() => setFilterStage("")} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !filterStage ? "rgba(255,255,255,0.12)" : "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>
          All ({totalContacts})
        </button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setFilterStage(filterStage === s ? "" : s)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterStage === s ? `${STAGE_COLOR[s]}25` : "transparent", border: `1px solid ${STAGE_COLOR[s]}50`, color: filterStage === s ? STAGE_COLOR[s] : "#b3b3b3" }}>
            {STAGE_LABEL[s]} {stages[s] ? `(${stages[s]})` : "(0)"}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search name, email, title…"
        style={{ width: "100%", maxWidth: 400, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, marginBottom: 20, outline: "none", boxSizing: "border-box" }}
      />

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#737373" }}>Loading contacts…</div>
      ) : contacts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#b3b3b3", marginBottom: 8 }}>No contacts yet</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Add your first contact or import from signals.</div>
          <button onClick={openCreate} style={{ padding: "10px 24px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Add First Contact
          </button>
        </div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Name", "Title / Company", "Email", "Country", "Stage", "Score", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${STAGE_COLOR[c.stage] || "#6366f1"},#A855F7)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {(c.first_name?.[0] || "?").toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{c.name || `${c.first_name} ${c.last_name}`}</div>
                        {c.last_contacted && (
                          <div style={{ fontSize: 11, color: "#737373" }}>Contacted {new Date(c.last_contacted).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, color: "#e5e5e5" }}>{c.title || "—"}</div>
                    {c.department && <div style={{ fontSize: 11, color: "#737373" }}>{c.department}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#b3b3b3" }}>{c.email || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#b3b3b3" }}>{c.country || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: `${STAGE_COLOR[c.stage] || "#6366f1"}20`, color: STAGE_COLOR[c.stage] || "#6366f1", border: `1px solid ${STAGE_COLOR[c.stage] || "#6366f1"}40`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                      {STAGE_LABEL[c.stage] || c.stage}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}><ScoreBadge score={c.lead_score} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(c)} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e5e5e5", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => scoreContact(c)} style={{ padding: "4px 10px", background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)", borderRadius: 6, color: "#00F0FF", fontSize: 12, cursor: "pointer" }}>AI Score</button>
                      <button onClick={() => del(c)} style={{ padding: "4px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", fontSize: 12, cursor: "pointer" }}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 32, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700 }}>{editing ? "Edit Contact" : "Add Contact"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["first_name", "First Name *"], ["last_name", "Last Name"],
                ["email", "Email"], ["phone", "Phone"],
                ["title", "Job Title"], ["department", "Department"],
                ["country", "Country"], ["linkedin", "LinkedIn URL"],
              ].map(([k, lbl]) => (
                <div key={k}>
                  <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>{lbl}</label>
                  <input value={form[k] || ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none" }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Stage</label>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14 }}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Source</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14 }}>
                  {["manual", "signal", "import", "form", "linkedin", "referral"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : editing ? "Update Contact" : "Create Contact"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#b3b3b3", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
