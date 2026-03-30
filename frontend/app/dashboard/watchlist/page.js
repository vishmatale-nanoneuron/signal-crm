"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const INDUSTRIES = ["SaaS","Fintech","IT Services","Logistics","Manufacturing","Healthcare","Ecommerce","HR Tech","Legal","Education","Media","Pharma","Clean Energy","Real Estate","Food & Beverage","Construction"];
const PRIORITIES = ["high","medium","low"];

function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--text2)" }}>
      <div onClick={() => onChange(!value)} style={{ width: 30, height: 16, borderRadius: 8, background: value ? "var(--accent)" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", cursor: "pointer" }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: value ? 16 : 2, transition: "left 0.2s" }} />
      </div>
      {label}
    </label>
  );
}

export default function WatchlistPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ company_name: "", domain: "", industry: "", country: "", priority: "medium", watch_hiring: true, watch_pricing: true, watch_compliance: true, watch_leadership: true, watch_expansion: true });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function load() {
    setLoading(true);
    const d = await apiFetch("/watchlist");
    if (d.success) setAccounts(d.accounts || []);
    setLoading(false);
  }

  async function add(e) {
    e.preventDefault();
    setSaving(true);
    const d = await apiFetch("/watchlist", { method: "POST", body: JSON.stringify(form) });
    if (d.success) { await load(); setShowAdd(false); setForm({ company_name: "", domain: "", industry: "", country: "", priority: "medium", watch_hiring: true, watch_pricing: true, watch_compliance: true, watch_leadership: true, watch_expansion: true }); }
    setSaving(false);
  }

  async function remove(id) {
    await apiFetch(`/watchlist/${id}`, { method: "DELETE" });
    setAccounts(a => a.filter(x => x.id !== id));
  }

  useEffect(() => { load(); }, []);

  const priorityColor = { high: "#F85149", medium: "#D29922", low: "#3FB950" };
  const inp = { width: "100%", marginBottom: 10 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👁 Watchlist</h1>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>Target companies you want to monitor for web changes.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: "9px 18px", borderRadius: 8, background: "linear-gradient(135deg,#00D9FF,#A855F7)", color: "#06080D", fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none" }}>
          + Add Account
        </button>
      </div>

      {showAdd && (
        <form onSubmit={add} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "22px 24px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Add New Watchlist Account</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input style={inp} placeholder="Company name *" value={form.company_name} onChange={e => set("company_name", e.target.value)} required />
            <input style={inp} placeholder="Domain (e.g. stripe.com) *" value={form.domain} onChange={e => set("domain", e.target.value)} required />
            <select style={inp} value={form.industry} onChange={e => set("industry", e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
            <input style={inp} placeholder="Target country (e.g. Germany)" value={form.country} onChange={e => set("country", e.target.value)} />
            <select style={inp} value={form.priority} onChange={e => set("priority", e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)} Priority</option>)}
            </select>
          </div>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>SIGNAL TYPES TO MONITOR</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Toggle label="Hiring" value={form.watch_hiring} onChange={v => set("watch_hiring", v)} />
              <Toggle label="Pricing" value={form.watch_pricing} onChange={v => set("watch_pricing", v)} />
              <Toggle label="Compliance" value={form.watch_compliance} onChange={v => set("watch_compliance", v)} />
              <Toggle label="Leadership" value={form.watch_leadership} onChange={v => set("watch_leadership", v)} />
              <Toggle label="Expansion" value={form.watch_expansion} onChange={v => set("watch_expansion", v)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={saving} style={{ padding: "9px 20px", borderRadius: 7, background: "var(--accent)", color: "#06080D", fontWeight: 700, cursor: "pointer", border: "none" }}>{saving ? "Saving…" : "Add to Watchlist"}</button>
            <button type="button" onClick={() => setShowAdd(false)} style={{ padding: "9px 16px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: "var(--text3)", padding: 24 }}>Loading watchlist…</div>
      ) : accounts.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👁</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>No accounts yet</div>
          <div style={{ color: "var(--text2)", fontSize: 13 }}>Add your top 5-10 target companies to start receiving signals.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map(a => (
            <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: priorityColor[a.priority] || "#888", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.company_name}</span>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>{a.domain}</span>
                  {a.industry && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: 10 }}>{a.industry}</span>}
                  {a.country && <span style={{ fontSize: 11, color: "var(--text3)" }}>📍 {a.country}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text3)" }}>
                  {a.watch_hiring && <span>Hiring</span>}
                  {a.watch_pricing && <span>Pricing</span>}
                  {a.watch_compliance && <span>Compliance</span>}
                  {a.watch_leadership && <span>Leadership</span>}
                  {a.watch_expansion && <span>Expansion</span>}
                </div>
              </div>
              {a.signal_count > 0 && (
                <div style={{ background: "rgba(0,217,255,0.1)", color: "var(--accent)", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{a.signal_count} signals</div>
              )}
              <button onClick={() => remove(a.id)} style={{ color: "#F85149", fontSize: 12, cursor: "pointer", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(248,81,73,0.2)", background: "transparent" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
