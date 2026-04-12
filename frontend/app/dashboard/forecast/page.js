"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

const PERIOD_LABELS = { month: "This Month", quarter: "This Quarter", year: "This Year" };

function MetricCard({ label, value, sub, color = "#fff", gradient }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, color: "#737373", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: gradient ? "transparent" : color, backgroundImage: gradient, backgroundClip: gradient ? "text" : undefined, WebkitBackgroundClip: gradient ? "text" : undefined, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#737373", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ stage, count, value, maxValue, color }) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 13, color: "#e5e5e5", fontWeight: 600 }}>{stage}</span>
          <span style={{ fontSize: 12, color: "#737373" }}>({count} deals)</span>
        </div>
        <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${color},${color}99)`, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("quarter");

  async function load(p = period) {
    setLoading(true);
    const d = await apiFetch(`/forecast?period=${p}`);
    if (d.success) setData(d);
    setLoading(false);
  }

  useEffect(() => { load("quarter"); }, []);
  function handlePeriod(p) { setPeriod(p); load(p); }

  const fmtCurrency = v => {
    if (!v) return "₹0";
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
    return `₹${Math.round(v).toLocaleString("en-IN")}`;
  };

  const FUNNEL_COLORS = ["#6366f1", "#00F0FF", "#f59e0b", "#a855f7", "#22c55e", "#ef4444", "#6b7280"];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Revenue Forecast</h1>
          <p style={{ color: "#737373", fontSize: 14, margin: "4px 0 0" }}>Pipeline intelligence & revenue projections</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(PERIOD_LABELS).map(([p, lbl]) => (
            <button key={p} onClick={() => handlePeriod(p)} style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: period === p ? "rgba(255,255,255,0.1)" : "transparent", border: `1px solid ${period === p ? "rgba(255,255,255,0.2)" : "transparent"}`, color: period === p ? "#fff" : "#737373" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>Computing forecast…</div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: 80, color: "#737373" }}>No forecast data available.</div>
      ) : (
        <>
          {/* Key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
            <MetricCard label="Pipeline Value" value={fmtCurrency(data.summary?.pipeline_value)} sub={`${data.summary?.open_deals || 0} open deals`} gradient="linear-gradient(135deg,#00F0FF,#7C3AED)" />
            <MetricCard label="Weighted Forecast" value={fmtCurrency(data.summary?.weighted_forecast)} sub="Probability-adjusted" color="#6366f1" />
            <MetricCard label="Won This Period" value={fmtCurrency(data.summary?.won_value)} sub={`${data.summary?.won_deals || 0} deals closed`} color="#22c55e" />
            <MetricCard label="Win Rate" value={`${data.summary?.win_rate || 0}%`} sub="Close probability" color={data.summary?.win_rate >= 30 ? "#22c55e" : data.summary?.win_rate >= 15 ? "#f59e0b" : "#ef4444"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Pipeline Funnel */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 18 }}>Pipeline Funnel</div>
              {data.funnel && data.funnel.length > 0 ? (() => {
                const maxVal = Math.max(...data.funnel.map(f => f.total_value || 0), 1);
                return data.funnel.map((f, i) => (
                  <FunnelBar key={f.stage} stage={f.stage} count={f.count} value={fmtCurrency(f.total_value)} maxValue={maxVal} color={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                ));
              })() : (
                <div style={{ color: "#737373", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No pipeline data yet.</div>
              )}
            </div>

            {/* Monthly trend */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 18 }}>Revenue Trend (6 Months)</div>
              {data.monthly_won && data.monthly_won.length > 0 ? (() => {
                const maxV = Math.max(...data.monthly_won.map(m => m.value || 0), 1);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginBottom: 10 }}>
                    {data.monthly_won.map((m, i) => {
                      const h = Math.max(4, Math.round(((m.value || 0) / maxV) * 100));
                      return (
                        <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ width: "100%", height: h, background: i === data.monthly_won.length - 1 ? "linear-gradient(180deg,#00F0FF,#7C3AED)" : "rgba(99,102,241,0.4)", borderRadius: "4px 4px 0 0", transition: "height 0.5s" }} />
                          <span style={{ fontSize: 9, color: "#737373", textAlign: "center" }}>{m.month}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div style={{ color: "#737373", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No closed deals yet.</div>
              )}
              {data.monthly_won && data.monthly_won.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 4 }}>
                  {data.monthly_won.map(m => (
                    <div key={m.month} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#737373", marginBottom: 3 }}>
                      <span>{m.month}</span>
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>{fmtCurrency(m.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Closing Soon */}
          {data.closing_soon && data.closing_soon.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#f59e0b" }}>⚡</span> Closing Soon (next 30 days)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.closing_soon.map(deal => (
                  <div key={deal.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{deal.title}</div>
                      {deal.company && <div style={{ fontSize: 12, color: "#737373" }}>{deal.company}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{fmtCurrency(deal.value)}</div>
                      <div style={{ fontSize: 11, color: "#f59e0b" }}>
                        {deal.close_date ? new Date(deal.close_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insight */}
          {data.ai_insight && (
            <div style={{ background: "rgba(0,240,255,0.03)", border: "1px solid rgba(0,240,255,0.15)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤖</span>
                <span style={{ background: "linear-gradient(135deg,#00F0FF,#7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Forecast Insight</span>
              </div>
              <div style={{ fontSize: 13, color: "#b3b3b3", lineHeight: 1.7 }}>{data.ai_insight}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
