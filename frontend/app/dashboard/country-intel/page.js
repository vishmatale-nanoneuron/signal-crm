"use client";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "../../../lib/api";

const INDUSTRIES = ["SaaS", "Logistics", "Manufacturing", "FinTech"];

const RISK_COLORS = {
  high:    { bg: "rgba(229,9,20,0.15)",  border: "rgba(229,9,20,0.5)",  text: "#E50914" },
  medium:  { bg: "rgba(245,166,35,0.15)", border: "rgba(245,166,35,0.5)", text: "#f5a623" },
  low:     { bg: "rgba(70,211,105,0.15)", border: "rgba(70,211,105,0.5)", text: "#46d369" },
  unknown: { bg: "rgba(179,179,179,0.1)", border: "rgba(179,179,179,0.3)", text: "#737373" },
};

const SPEED_COLORS = {
  "very fast": "#46d369",
  fast:        "#46d369",
  medium:      "#f5a623",
  slow:        "#E50914",
  "very slow": "#c0392b",
};

// Derive flag emoji from country name using Unicode regional indicator symbols
function countryFlag(name) {
  const MAP = {
    "USA": "🇺🇸", "UK": "🇬🇧", "Germany": "🇩🇪", "France": "🇫🇷", "India": "🇮🇳",
    "UAE": "🇦🇪", "Singapore": "🇸🇬", "Japan": "🇯🇵", "Australia": "🇦🇺", "Canada": "🇨🇦",
    "Brazil": "🇧🇷", "Netherlands": "🇳🇱", "Saudi Arabia": "🇸🇦", "South Africa": "🇿🇦",
    "Malaysia": "🇲🇾", "Indonesia": "🇮🇩", "Vietnam": "🇻🇳", "Philippines": "🇵🇭",
    "Thailand": "🇹🇭", "Mexico": "🇲🇽", "Argentina": "🇦🇷", "Nigeria": "🇳🇬",
    "Kenya": "🇰🇪", "Poland": "🇵🇱", "Sweden": "🇸🇪", "Spain": "🇪🇸", "Italy": "🇮🇹",
    "Israel": "🇮🇱", "South Korea": "🇰🇷", "Turkey": "🇹🇷", "Egypt": "🇪🇬",
    "New Zealand": "🇳🇿", "Portugal": "🇵🇹", "Switzerland": "🇨🇭", "Belgium": "🇧🇪",
    "Denmark": "🇩🇰", "Norway": "🇳🇴", "Finland": "🇫🇮", "Czech Republic": "🇨🇿",
    "Romania": "🇷🇴", "Greece": "🇬🇷", "Chile": "🇨🇱", "Colombia": "🇨🇴", "Peru": "🇵🇪",
    "Pakistan": "🇵🇰", "Bangladesh": "🇧🇩", "Sri Lanka": "🇱🇰", "Taiwan": "🇹🇼",
    "Hong Kong": "🇭🇰", "China": "🇨🇳", "Oman": "🇴🇲", "Kuwait": "🇰🇼", "Qatar": "🇶🇦",
    "Bahrain": "🇧🇭", "Morocco": "🇲🇦", "Ghana": "🇬🇭", "Ethiopia": "🇪🇹",
    "Tanzania": "🇹🇿", "Uganda": "🇺🇬", "Angola": "🇦🇴",
  };
  return MAP[name] || "🌐";
}

function RiskBadge({ level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.unknown;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.5px",
    }}>
      {level || "unknown"}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#E50914", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, valueColor }) {
  if (!value && value !== false) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 12, color: "#737373", flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor || "#e5e5e5", textAlign: "right", fontWeight: 500 }}>{String(value)}</span>
    </div>
  );
}

export default function CountryIntelPage() {
  const [countries, setCountries]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState(null);
  const [intel, setIntel]             = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [industry, setIndustry]       = useState("SaaS");
  const [riskFilter, setRiskFilter]   = useState("all");

  useEffect(() => {
    apiFetch("/country-intel/countries").then(d => {
      if (d.success) setCountries(d.countries);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return countries.filter(c => {
      const matchSearch = !q || c.country.toLowerCase().includes(q) || c.language.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q);
      const matchRisk   = riskFilter === "all" || c.risk_level === riskFilter;
      return matchSearch && matchRisk;
    });
  }, [countries, search, riskFilter]);

  function selectCountry(country) {
    setSelected(country);
    setIntel(null);
    setIntelLoading(true);
    apiFetch(`/country-intel/${encodeURIComponent(country.country)}?industry=${encodeURIComponent(industry)}`).then(d => {
      if (d.success) setIntel(d);
      setIntelLoading(false);
    }).catch(() => setIntelLoading(false));
  }

  // Re-fetch intel when industry changes and a country is selected
  useEffect(() => {
    if (!selected) return;
    setIntel(null);
    setIntelLoading(true);
    apiFetch(`/country-intel/${encodeURIComponent(selected.country)}?industry=${encodeURIComponent(industry)}`).then(d => {
      if (d.success) setIntel(d);
      setIntelLoading(false);
    }).catch(() => setIntelLoading(false));
  }, [industry]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
          Country Intelligence
        </h1>
        <p style={{ color: "#737373", fontSize: 14, marginTop: 6, marginBottom: 0 }}>
          Compliance rules, buyer personas, contact strategy and cultural tips for 60+ countries worldwide.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#737373", fontSize: 14 }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search country, language, currency..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 36px",
              background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6, color: "#fff", fontSize: 13, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Industry selector */}
        <div style={{ display: "flex", gap: 6 }}>
          {INDUSTRIES.map(ind => (
            <button
              key={ind}
              onClick={() => setIndustry(ind)}
              style={{
                padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s", border: "1px solid",
                background: industry === ind ? "#E50914" : "transparent",
                borderColor: industry === ind ? "#E50914" : "rgba(255,255,255,0.15)",
                color: industry === ind ? "#fff" : "#b3b3b3",
              }}
            >
              {ind}
            </button>
          ))}
        </div>

        {/* Risk filter */}
        <select
          value={riskFilter}
          onChange={e => setRiskFilter(e.target.value)}
          style={{
            padding: "9px 12px", background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
            color: "#e5e5e5", fontSize: 13, outline: "none", cursor: "pointer",
          }}
        >
          <option value="all">All Risk Levels</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {["low", "medium", "high"].map(level => {
            const count = countries.filter(c => c.risk_level === level).length;
            const c = RISK_COLORS[level];
            return (
              <div
                key={level}
                onClick={() => setRiskFilter(riskFilter === level ? "all" : level)}
                style={{
                  background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8,
                  padding: "8px 16px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: c.text }}>{count}</span>
                <span style={{ fontSize: 11, color: c.text, fontWeight: 600, textTransform: "uppercase" }}>{level} risk</span>
              </div>
            );
          })}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#737373", alignSelf: "center" }}>
            Showing <strong style={{ color: "#e5e5e5" }}>{filtered.length}</strong> of {countries.length} markets
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Country grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div style={{ width: 36, height: 36, border: "3px solid #E50914", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#737373" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌐</div>
              <div style={{ fontSize: 15 }}>No countries match your search.</div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 12,
            }}>
              {filtered.map(c => {
                const isSelected = selected?.country === c.country;
                return (
                  <div
                    key={c.country}
                    onClick={() => selectCountry(c)}
                    style={{
                      background: isSelected ? "rgba(229,9,20,0.08)" : "#1a1a1a",
                      border: `1px solid ${isSelected ? "rgba(229,9,20,0.5)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 8, padding: "14px 14px 12px",
                      cursor: "pointer", transition: "all 0.15s",
                      boxShadow: isSelected ? "0 0 0 1px rgba(229,9,20,0.3)" : "none",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>{countryFlag(c.country)}</span>
                      <RiskBadge level={c.risk_level} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 6 }}>{c.country}</div>
                    <div style={{ fontSize: 11, color: "#737373", marginBottom: 4 }}>
                      {c.currency && <span style={{ marginRight: 8 }}>{c.currency}</span>}
                      {c.cold_email_allowed === true && <span style={{ color: "#46d369" }}>✓ Cold email</span>}
                      {c.cold_email_allowed === false && <span style={{ color: "#E50914" }}>✗ Cold email</span>}
                    </div>
                    {c.decision_speed && (
                      <div style={{ fontSize: 11, color: SPEED_COLORS[c.decision_speed] || "#b3b3b3", fontWeight: 600 }}>
                        {c.decision_speed} decisions
                      </div>
                    )}
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      {c.has_compliance && (
                        <span style={{ fontSize: 9, background: "rgba(70,211,105,0.15)", color: "#46d369", border: "1px solid rgba(70,211,105,0.3)", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>
                          COMPLIANCE
                        </span>
                      )}
                      {c.has_buyer_map && (
                        <span style={{ fontSize: 9, background: "rgba(229,9,20,0.15)", color: "#E50914", border: "1px solid rgba(229,9,20,0.3)", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>
                          BUYER MAP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 360, flexShrink: 0,
            background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: 20,
            position: "sticky", top: "calc(var(--nav-h, 64px) + 24px)",
            maxHeight: "calc(100vh - 120px)", overflowY: "auto",
          }}>
            {/* Panel header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{countryFlag(selected.country)}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{selected.country}</div>
                  <RiskBadge level={selected.risk_level} />
                </div>
              </div>
              <button
                onClick={() => { setSelected(null); setIntel(null); }}
                style={{ background: "none", border: "none", color: "#737373", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2 }}
              >
                ✕
              </button>
            </div>

            {intelLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #E50914", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              </div>
            ) : intel ? (
              <>
                {/* Compliance section */}
                {intel.compliance && (
                  <Section title="Compliance Rules">
                    <InfoRow label="Framework"       value={intel.compliance.framework} />
                    <InfoRow label="Cold Email"      value={intel.compliance.cold_email_allowed === true ? "Allowed" : intel.compliance.cold_email_allowed === false ? "Not Allowed" : "Check local rules"} valueColor={intel.compliance.cold_email_allowed ? "#46d369" : "#E50914"} />
                    <InfoRow label="Data Residency"  value={intel.compliance.data_residency} />
                    <InfoRow label="Opt-out Required" value={intel.compliance.opt_out_required ? "Yes" : "No"} />
                    <InfoRow label="Consent Required" value={intel.compliance.consent_required ? "Yes" : "No"} />
                    <InfoRow label="Regulator"       value={intel.compliance.regulator} />
                    {intel.compliance.notes && (
                      <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, color: "#b3b3b3", lineHeight: 1.6 }}>
                        {intel.compliance.notes}
                      </div>
                    )}
                  </Section>
                )}

                {/* Contact strategy section */}
                {intel.contact_strategy && (
                  <Section title="How to Contact">
                    <InfoRow label="Timezone"       value={intel.contact_strategy.tz} />
                    <InfoRow label="Best Time"      value={intel.contact_strategy.best_contact} />
                    <InfoRow label="Language"       value={intel.contact_strategy.language} />
                    <InfoRow label="Currency"       value={intel.contact_strategy.currency} />
                    <InfoRow label="Greeting"       value={intel.contact_strategy.greeting} />
                    <InfoRow label="Decision Speed" value={intel.contact_strategy.decision_speed} valueColor={SPEED_COLORS[intel.contact_strategy.decision_speed] || "#b3b3b3"} />
                  </Section>
                )}

                {/* Buyer persona section */}
                {intel.buyer_persona ? (
                  <Section title={`Buyer Persona · ${industry}`}>
                    <InfoRow label="Primary Buyer"   value={intel.buyer_persona.primary_buyer} />
                    <InfoRow label="Secondary"       value={intel.buyer_persona.secondary_buyers?.join(", ")} />
                    <InfoRow label="Entry Difficulty" value={intel.buyer_persona.entry_difficulty} valueColor={{ easy: "#46d369", medium: "#f5a623", hard: "#E50914" }[intel.buyer_persona.entry_difficulty] || "#b3b3b3"} />
                    <InfoRow label="Deal Cycle"       value={intel.buyer_persona.typical_deal_cycle ? `${intel.buyer_persona.typical_deal_cycle} days` : null} />
                    {intel.buyer_persona.notes && (
                      <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, color: "#b3b3b3", lineHeight: 1.6 }}>
                        {intel.buyer_persona.notes}
                      </div>
                    )}
                  </Section>
                ) : (
                  <Section title={`Buyer Persona · ${industry}`}>
                    <div style={{ fontSize: 12, color: "#737373", fontStyle: "italic" }}>
                      No buyer persona data for {selected.country} in {industry}.
                      {intel.industries_available?.length > 0 && (
                        <span> Available: {intel.industries_available.join(", ")}.</span>
                      )}
                    </div>
                  </Section>
                )}

                {/* Industries available */}
                {intel.industries_available?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: "#737373", marginBottom: 6 }}>Buyer data available for:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {intel.industries_available.map(ind => (
                        <span
                          key={ind}
                          onClick={() => setIndustry(ind)}
                          style={{
                            fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                            background: ind === industry ? "rgba(229,9,20,0.2)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${ind === industry ? "rgba(229,9,20,0.5)" : "rgba(255,255,255,0.1)"}`,
                            color: ind === industry ? "#E50914" : "#b3b3b3",
                            fontWeight: ind === industry ? 700 : 400,
                          }}
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#737373", textAlign: "center", padding: 20 }}>
                Could not load intelligence for {selected.country}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
