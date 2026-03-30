"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

export default function BuyerMapPage() {
  const [industries, setIndustries] = useState([]);
  const [countries, setCountries] = useState([]);
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("/buyer-map/industries").then(d => { if (d.success) setIndustries(d.industries || []); });
    apiFetch("/buyer-map/countries").then(d => { if (d.success) setCountries(d.countries || []); });
  }, []);

  async function search(e) {
    e.preventDefault();
    if (!industry || !country) return;
    setLoading(true); setResult(null);
    const d = await apiFetch(`/buyer-map?industry=${encodeURIComponent(industry)}&country=${encodeURIComponent(country)}`);
    setResult(d);
    setLoading(false);
  }

  async function createDeal() {
    if (!result?.data) return;
    const d = await apiFetch("/deals", {
      method: "POST",
      body: JSON.stringify({
        title: `${industry} deal — ${country}`,
        country,
        industry,
        contact_title: result.data.primary_buyer,
        stage: "signal",
        next_action: `Target: ${result.data.primary_buyer}. ${result.data.notes}`,
      }),
    });
    setMsg(d.success ? `✓ Deal created — targeting ${result.data.primary_buyer} in ${country}` : "Failed to create deal");
    setTimeout(() => setMsg(""), 3000);
  }

  const diffColor = { easy: "#3FB950", medium: "#D29922", hard: "#F85149" };
  const sel = { width: "100%", marginBottom: 0 };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🗺 Buyer Map</h1>
        <p style={{ color: "var(--text2)", fontSize: 13 }}>Find the right person to contact in any country, for any industry.</p>
      </div>

      <form onSubmit={search} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.06em" }}>INDUSTRY</div>
          <select style={sel} value={industry} onChange={e => setIndustry(e.target.value)} required>
            <option value="">Select industry…</option>
            {industries.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.06em" }}>TARGET COUNTRY</div>
          <select style={sel} value={country} onChange={e => setCountry(e.target.value)} required>
            <option value="">Select country…</option>
            {countries.map(c => <option key={c.country}>{c.country}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading} style={{ padding: "10px 24px", borderRadius: 8, background: "linear-gradient(135deg,#00D9FF,#A855F7)", color: "#06080D", fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none", flexShrink: 0 }}>
          {loading ? "Searching…" : "Find Buyers →"}
        </button>
      </form>

      {msg && <div style={{ background: "rgba(63,185,80,0.1)", border: "1px solid rgba(63,185,80,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#3FB950" }}>{msg}</div>}

      {result && result.success && result.data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
          {/* Main result */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 6 }}>PRIMARY BUYER — {industry.toUpperCase()} IN {country.toUpperCase()}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "var(--accent)", marginBottom: 6 }}>{result.data.primary_buyer}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>ENTRY DIFFICULTY</div>
                <span style={{ background: (diffColor[result.data.entry_difficulty] || "#888") + "20", color: diffColor[result.data.entry_difficulty] || "#888", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  {(result.data.entry_difficulty || "").toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 10 }}>SECONDARY BUYERS</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(result.data.secondary_buyers || []).map(b => (
                  <span key={b} style={{ background: "rgba(255,255,255,0.06)", padding: "5px 12px", borderRadius: 20, fontSize: 13, fontWeight: 500 }}>{b}</span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>TYPICAL DEAL CYCLE</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{result.data.typical_deal_cycle} days</div>
              </div>
            </div>

            {result.data.notes && (
              <div style={{ background: "rgba(0,217,255,0.06)", border: "1px solid rgba(0,217,255,0.15)", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.06em", marginBottom: 6 }}>MARKET INTELLIGENCE</div>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>{result.data.notes}</div>
              </div>
            )}

            <button onClick={createDeal} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(0,217,255,0.1)", border: "1px solid rgba(0,217,255,0.3)", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Export to Deal Pipeline
            </button>
          </div>

          {/* Country summary */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em", marginBottom: 16 }}>COUNTRIES BY EASE OF ENTRY</div>
            {countries.slice(0, 12).map(c => (
              <div key={c.country} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.country}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{c.cold_email_allowed === "yes" ? "Cold email ✓" : "Email restricted"}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: diffColor[c.entry_difficulty] || "#888", background: (diffColor[c.entry_difficulty] || "#888") + "20", padding: "2px 8px", borderRadius: 10 }}>
                  {(c.entry_difficulty || "").toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && !result.success && (
        <div style={{ background: "rgba(248,81,73,0.07)", border: "1px solid rgba(248,81,73,0.2)", borderRadius: 10, padding: "16px 20px", color: "var(--red)" }}>
          {result.error || "No data found for this combination."}
        </div>
      )}
    </div>
  );
}
