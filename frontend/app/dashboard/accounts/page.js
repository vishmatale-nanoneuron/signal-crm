"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const STAGES = ["prospect", "customer", "partner", "churned"];
const STAGE_COLOR = { prospect: "#6366f1", customer: "#22c55e", partner: "#00F0FF", churned: "#6b7280" };

function HealthBar({ score }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 700, minWidth: 28 }}>{score}</span>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalArr, setTotalArr] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", domain: "", industry: "", country: "", city: "", employees: "", revenue_range: "", phone: "", linkedin: "", website: "", stage: "prospect", arr: 0, notes: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  async function load(q = search, stage = filterStage) {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50, offset: 0 });
    if (q) params.set("q", q);
    if (stage) params.set("stage", stage);
    const d = await apiFetch(`/accounts?${params}`);
    if (d.success) { setAccounts(d.accounts); setTotal(d.total); setTotalArr(d.total_arr || 0); setStageCounts(d.stages || {}); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(search, filterStage), 350); return () => clearTimeout(t); }, [search, filterStage]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", domain: "", industry: "", country: "", city: "", employees: "", revenue_range: "", phone: "", linkedin: "", website: "", stage: "prospect", arr: 0, notes: "" });
    setShowForm(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({ name: a.name, domain: a.domain, industry: a.industry, country: a.country, city: a.city, employees: a.employees, revenue_range: a.revenue_range, phone: a.phone, linkedin: a.linkedin, website: a.website, stage: a.stage, arr: a.arr, notes: a.notes });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { showToast("Company name required.", false); return; }
    setSaving(true);
    const d = editing
      ? await apiFetch(`/accounts/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : await apiFetch("/accounts", { method: "POST", body: JSON.stringify({ ...form, arr: parseFloat(form.arr) || 0 }) });
    setSaving(false);
    if (d.success) { showToast(editing ? "Account updated!" : "Account created!"); setShowForm(false); load(); }
    else showToast(d.detail || "Error", false);
  }

  async function del(a) {
    if (!confirm(`Delete ${a.name}?`)) return;
    const d = await apiFetch(`/accounts/${a.id}`, { method: "DELETE" });
    if (d.success) { showToast("Deleted."); load(); }
  }

  const fmtCurrency = v => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${v.toLocaleString()}`;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Accounts</h1>
          <p style={{ color: "#737373", fontSize: 14, margin: "4px 0 0" }}>
            {total} companies · Total ARR: <span style={{ color: "#22c55e", fontWeight: 700 }}>{fmtCurrency(totalArr)}</span>
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: "10px 20px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + Add Account
        </button>
      </div>

      {/* Stage filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={() => setFilterStage("")} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !filterStage ? "rgba(255,255,255,0.12)" : "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>
          All ({total})
        </button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setFilterStage(filterStage === s ? "" : s)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterStage === s ? `${STAGE_COLOR[s]}25` : "transparent", border: `1px solid ${STAGE_COLOR[s]}50`, color: filterStage === s ? STAGE_COLOR[s] : "#b3b3b3" }}>
            {s.charAt(0).toUpperCase() + s.slice(1)} {stageCounts[s] ? `(${stageCounts[s]})` : "(0)"}
          </button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company name or domain…"
        style={{ width: "100%", maxWidth: 400, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, marginBottom: 20, outline: "none", boxSizing: "border-box" }} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#737373" }}>Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#b3b3b3", marginBottom: 8 }}>No accounts yet</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Track your target companies and customers.</div>
          <button onClick={openCreate} style={{ padding: "10px 24px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add First Account</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
          {accounts.map(a => (
            <div key={a.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,240,255,0.25)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg,${STAGE_COLOR[a.stage] || "#6366f1"},#A855F7)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>
                    {a.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "#737373" }}>{a.domain || a.website || a.industry || "—"}</div>
                  </div>
                </div>
                <span style={{ background: `${STAGE_COLOR[a.stage] || "#6366f1"}20`, color: STAGE_COLOR[a.stage] || "#6366f1", border: `1px solid ${STAGE_COLOR[a.stage] || "#6366f1"}40`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                  {a.stage}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, fontSize: 12 }}>
                <div><span style={{ color: "#737373" }}>Country</span><br /><span style={{ color: "#e5e5e5" }}>{a.country || "—"}</span></div>
                <div><span style={{ color: "#737373" }}>Industry</span><br /><span style={{ color: "#e5e5e5" }}>{a.industry || "—"}</span></div>
                <div><span style={{ color: "#737373" }}>Employees</span><br /><span style={{ color: "#e5e5e5" }}>{a.employees || "—"}</span></div>
                <div><span style={{ color: "#737373" }}>ARR</span><br /><span style={{ color: "#22c55e", fontWeight: 700 }}>{a.arr > 0 ? fmtCurrency(a.arr) : "—"}</span></div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#737373", marginBottom: 4 }}>Health Score</div>
                <HealthBar score={a.health_score} />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => openEdit(a)} style={{ flex: 1, padding: "7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e5e5", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Edit</button>
                <button onClick={() => del(a)} style={{ padding: "7px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#ef4444", fontSize: 12, cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 32, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700 }}>{editing ? "Edit Account" : "Add Account"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["name", "Company Name *"], ["domain", "Domain"],
                ["industry", "Industry"], ["country", "Country"],
                ["city", "City"], ["employees", "Employee Size"],
                ["revenue_range", "Revenue Range"], ["phone", "Phone"],
                ["linkedin", "LinkedIn"], ["website", "Website"],
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
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>ARR (INR)</label>
                <input type="number" value={form.arr} onChange={e => setForm(f => ({ ...f, arr: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none" }} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: "#737373", display: "block", marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#00F0FF,#7C3AED)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : editing ? "Update" : "Create Account"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#b3b3b3", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
