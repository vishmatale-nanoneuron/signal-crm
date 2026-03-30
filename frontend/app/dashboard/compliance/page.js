"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

export default function CompliancePage() {
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [checked, setChecked] = useState([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("/compliance/countries").then(d => { if (d.success) setCountries(d.countries || []); });
    apiFetch("/compliance/saved").then(d => { if (d.success) setSaved(d.saved || []); });
  }, []);

  async function check(country) {
    setSelected(country); setData(null); setChecked([]); setNotes("");
    const d = await apiFetch(`/compliance/check?country=${encodeURIComponent(country)}`);
    if (d.success) {
      setData(d);
      const prev = saved.find(s => s.country === country);
      setChecked(prev?.checked_items || []);
      setNotes(prev?.notes || "");
    }
  }

  async function save() {
    setSaving(true);
    const d = await apiFetch("/compliance/save", { method: "POST", body: JSON.stringify({ country: selected, checked_items: checked, notes }) });
    if (d.success) {
      setMsg("✓ Compliance checklist saved");
      const d2 = await apiFetch("/compliance/saved");
      if (d2.success) setSaved(d2.saved || []);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 2500);
  }

  function toggleCheck(item) {
    setChecked(c => c.includes(item) ? c.filter(x => x !== item) : [...c, item]);
  }

  const riskColor = { low: "#3FB950", medium: "#D29922", high: "#F85149" };
  const yesNo = v => v === "yes" ? <span style={{ color: "#3FB950" }}>✓ Yes</span> : v === "no" ? <span style={{ color: "#F85149" }}>✗ No</span> : <span style={{ color: "#D29922" }}>⚠ Conditional</span>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🛡 Compliance Checker</h1>
        <p style={{ color: "var(--text2)", fontSize: 13 }}>Country-specific outbound rules before you contact any prospect.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
        {/* Country list */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", height: "fit-content" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 12 }}>SELECT COUNTRY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 420, overflowY: "auto" }}>
            {countries.map(c => (
              <button key={c.country} onClick={() => check(c.country)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", borderRadius: 7, cursor: "pointer", border: "none",
                background: selected === c.country ? "rgba(0,217,255,0.1)" : "transparent",
                color: selected === c.country ? "var(--accent)" : "var(--text2)",
                textAlign: "left", fontSize: 13,
              }}>
                <span>{c.country}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor[c.risk_level] || "#888", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          {!data ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "40px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🛡</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Select a country</div>
              <div style={{ color: "var(--text2)", fontSize: 13 }}>Choose a country to see full compliance rules and your outreach checklist.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Header card */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{data.country}</h2>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(data.key_frameworks || []).map(f => (
                        <span key={f} style={{ background: "rgba(0,217,255,0.1)", color: "var(--accent)", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>RISK LEVEL</div>
                    <span style={{ background: (riskColor[data.risk_level] || "#888") + "20", color: riskColor[data.risk_level] || "#888", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{(data.risk_level || "").toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
                  <div><div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Cold Email</div><div style={{ fontWeight: 600 }}>{yesNo(data.cold_email_allowed)}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Cold Call</div><div style={{ fontWeight: 600 }}>{yesNo(data.cold_call_allowed)}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>GDPR Applies</div><div style={{ fontWeight: 600 }}>{data.gdpr_applicable ? <span style={{ color: "#D29922" }}>⚠ Yes</span> : <span style={{ color: "#3FB950" }}>✓ No</span>}</div></div>
                </div>
                {data.notes && <div style={{ marginTop: 14, fontSize: 13, color: "var(--text2)", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: 14 }}>{data.notes}</div>}
              </div>

              {/* Checklist */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Pre-Outreach Checklist</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>{checked.length}/{(data.checklist || []).length} completed</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(data.checklist || []).map((item, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={checked.includes(item)} onChange={() => toggleCheck(item)} style={{ marginTop: 3, width: 14, height: 14, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: checked.includes(item) ? "var(--text3)" : "var(--text2)", textDecoration: checked.includes(item) ? "line-through" : "none" }}>{item}</span>
                    </label>
                  ))}
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add your notes…" style={{ width: "100%", marginTop: 14, height: 64, resize: "vertical", fontSize: 13 }} />
                {msg && <div style={{ fontSize: 13, color: "#3FB950", marginTop: 8 }}>{msg}</div>}
                <button onClick={save} disabled={saving} style={{ marginTop: 12, padding: "9px 20px", borderRadius: 7, background: "var(--accent)", color: "#06080D", fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none" }}>{saving ? "Saving…" : "Save Progress"}</button>
              </div>

              {/* Blocking rules */}
              <div style={{ background: "rgba(248,81,73,0.05)", border: "1px solid rgba(248,81,73,0.2)", borderRadius: 12, padding: "18px 22px" }}>
                <div style={{ fontWeight: 700, color: "#F85149", marginBottom: 12 }}>⛔ Blocking Rules — Do NOT Do This</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {(data.blocking_rules || []).map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(248,81,73,0.85)" }}>
                      <span>✗</span><span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safe channels */}
              <div style={{ background: "rgba(63,185,80,0.05)", border: "1px solid rgba(63,185,80,0.2)", borderRadius: 12, padding: "18px 22px" }}>
                <div style={{ fontWeight: 700, color: "#3FB950", marginBottom: 12 }}>✓ Safe Outreach Channels</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(data.safe_channels || []).map((c, i) => (
                    <span key={i} style={{ background: "rgba(63,185,80,0.1)", color: "#3FB950", padding: "5px 12px", borderRadius: 20, fontSize: 12 }}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Previously saved */}
          {saved.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Previously Checked</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {saved.map(s => (
                  <button key={s.id} onClick={() => check(s.country)} style={{ padding: "6px 14px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 12, cursor: "pointer" }}>
                    {s.country} <span style={{ color: "var(--accent)", marginLeft: 4 }}>{s.progress_pct}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
