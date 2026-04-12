"use client";
import { useState, useEffect } from "react";
import { apiFetch, getUser } from "../../../lib/api";
import { useRouter } from "next/navigation";

const STAGE_ORDER = ["signal","qualified","demo","proposal","negotiation","won","closed won","lost","closed lost"];
const STAGE_COLOR = {
  signal:"#6b7280", qualified:"#6366f1", demo:"#00F0FF",
  proposal:"#f59e0b", negotiation:"#a855f7",
  won:"#22c55e", "closed won":"#22c55e",
  lost:"#ef4444", "closed lost":"#ef4444",
};
const TYPE_ICON = { call:"📞", email:"📧", meeting:"🤝", note:"📝", linkedin:"💼", whatsapp:"💬", demo:"🖥️", task:"✅" };
const PLAN_COLOR = { starter:"#6366f1", pro:"#00F0FF", enterprise:"#a855f7", trial:"#6b7280" };

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, gradient, icon, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:14, padding:"20px 22px", cursor: onClick ? "pointer" : "default",
      transition:"border-color 0.15s, transform 0.15s",
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor="rgba(0,240,255,0.3)"; e.currentTarget.style.transform="translateY(-2px)"; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; e.currentTarget.style.transform="translateY(0)"; }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <span style={{ fontSize:11, color:"#737373", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>
        {icon && <span style={{ fontSize:20 }}>{icon}</span>}
      </div>
      <div style={{
        fontSize:32, fontWeight:900, lineHeight:1, marginBottom:6,
        color: gradient ? "transparent" : (color || "#fff"),
        backgroundImage: gradient,
        backgroundClip: gradient ? "text" : undefined,
        WebkitBackgroundClip: gradient ? "text" : undefined,
      }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:"#737373" }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden", marginTop:6 }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:color, borderRadius:2, transition:"width 0.6s ease" }} />
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:14, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>{title}</div>
      {sub && <div style={{ fontSize:12, color:"#737373", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function TrendBar({ data, field, color, label }) {
  if (!data?.length) return null;
  const vals = data.map(d => d[field] || 0);
  const max = Math.max(...vals, 1);
  return (
    <div>
      <div style={{ fontSize:11, color:"#737373", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:48 }}>
        {data.slice(-14).map((d, i) => {
          const h = Math.max(2, Math.round(((d[field] || 0) / max) * 44));
          const isLast = i === Math.min(data.length - 1, 13);
          return (
            <div key={i} style={{ flex:1, position:"relative" }}
              title={`${d.date}: ${d[field] || 0}`}>
              <div style={{
                height: h,
                background: isLast ? color : color + "50",
                borderRadius:"2px 2px 0 0",
                transition:"height 0.4s",
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontSize:10, color:"#555" }}>{data[0]?.date}</span>
        <span style={{ fontSize:10, color:"#555" }}>{data[data.length-1]?.date}</span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CeoDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState("overview");
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    if (!u?.is_owner) {
      router.replace("/dashboard");
      return;
    }
    apiFetch("/ceo/dashboard").then(d => {
      if (d.success) setData(d);
      else setError(d.detail || d.message || "Access denied");
      setLoading(false);
    }).catch(() => {
      setError("Could not load CEO dashboard.");
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, gap:16 }}>
      <div style={{ width:40, height:40, border:"3px solid transparent", borderTopColor:"#00F0FF", borderRightColor:"#7C3AED", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color:"#737373", fontSize:14 }}>Loading Command Center…</div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign:"center", padding:80, color:"#ef4444" }}>
      <div style={{ fontSize:36, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Access Restricted</div>
      <div style={{ fontSize:14, color:"#737373" }}>{error}</div>
    </div>
  );

  const { revenue, users, pipeline, crm, top_accounts, recent_signups, activity_feed, kpi_trend, system, founder_insight, owner } = data;

  const TABS = [
    { key:"overview",  label:"Overview"  },
    { key:"revenue",   label:"Revenue"   },
    { key:"users",     label:"Users"     },
    { key:"pipeline",  label:"Pipeline"  },
    { key:"intel",     label:"Intel"     },
  ];

  return (
    <div style={{ maxWidth:1200, margin:"0 auto" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:32 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 0 0 rgba(34,197,94,0.4)", animation:"livePulse 1.5s ease-out infinite" }} />
          <style>{`@keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
          <span style={{ fontSize:11, color:"#22c55e", fontWeight:700, letterSpacing:"0.1em" }}>LIVE · CEO COMMAND CENTER</span>
        </div>
        <h1 style={{ fontSize:34, fontWeight:900, margin:0, letterSpacing:"-0.04em", backgroundImage:"linear-gradient(135deg,#fff 30%,#b3b3b3)", backgroundClip:"text", WebkitBackgroundClip:"text", color:"transparent" }}>
          Signal CRM
        </h1>
        <p style={{ color:"#737373", fontSize:14, margin:"4px 0 0" }}>
          {owner.name} · Updated {new Date(data.generated_at).toLocaleTimeString("en-IN")}
        </p>
      </div>

      {/* ── Founder Insight ───────────────────────────────────────────────── */}
      <div style={{ background:"linear-gradient(135deg,rgba(0,240,255,0.04),rgba(124,58,237,0.06))", border:"1px solid rgba(0,240,255,0.15)", borderRadius:14, padding:"18px 22px", marginBottom:28, display:"flex", gap:14, alignItems:"flex-start" }}>
        <div style={{ fontSize:24, flexShrink:0 }}>🧠</div>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#00F0FF", letterSpacing:"0.08em", marginBottom:4 }}>FOUNDER INSIGHT</div>
          <div style={{ fontSize:13, color:"#e5e5e5", lineHeight:1.7 }}>{founder_insight}</div>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:24, borderBottom:"1px solid rgba(255,255,255,0.07)", paddingBottom:1 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:"8px 18px", borderRadius:"8px 8px 0 0", fontSize:13, fontWeight:600, cursor:"pointer",
            background: tab === t.key ? "rgba(255,255,255,0.07)" : "transparent",
            border: "none",
            borderBottom: tab === t.key ? "2px solid #00F0FF" : "2px solid transparent",
            color: tab === t.key ? "#fff" : "#737373",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════════════════ OVERVIEW TAB ═══════════════════════════ */}
      {tab === "overview" && (
        <>
          {/* Top KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            <KpiCard label="MRR" value={revenue.mrr_fmt} sub={`ARR ${revenue.arr_fmt}`} gradient="linear-gradient(135deg,#00F0FF,#7C3AED)" icon="💰" />
            <KpiCard label="Paid Users" value={users.paid} sub={`${users.conversion_rate}% conversion`} color="#22c55e" icon="✅" />
            <KpiCard label="Pipeline" value={pipeline.pipeline_fmt} sub={`Win rate ${pipeline.win_rate}%`} color="#a855f7" icon="📊" />
            <KpiCard label="CRM Accounts" value={crm.total_accounts} sub={`ARR ${crm.total_arr_fmt}`} color="#00F0FF" icon="🏢" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
            <KpiCard label="Total Users" value={users.total} sub={`+${users.new_today} today`} color="#fff" icon="👥" />
            <KpiCard label="Trial Users" value={users.trial} sub="Not yet paid" color="#f59e0b" icon="⏳" />
            <KpiCard label="Contacts" value={crm.total_contacts} sub={`${crm.activities_week} activities/wk`} color="#6366f1" icon="📇" />
            <KpiCard label="Open Tasks" value={crm.tasks_open} sub={crm.tasks_overdue > 0 ? `⚠ ${crm.tasks_overdue} overdue` : "All on track"} color={crm.tasks_overdue > 0 ? "#ef4444" : "#22c55e"} icon="✅" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:24 }}>
            {/* KPI Trend */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="30-Day Trend" sub="Paid users & MRR growth" />
              {kpi_trend.length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <TrendBar data={kpi_trend} field="paid_users" color="#22c55e" label="Paid Users" />
                  <TrendBar data={kpi_trend} field="mrr" color="#00F0FF" label="MRR (₹)" />
                  <TrendBar data={kpi_trend} field="new_signups" color="#7C3AED" label="New Signups" />
                </div>
              ) : (
                <div style={{ color:"#737373", fontSize:13, padding:"20px 0", textAlign:"center" }}>
                  Trend data builds up over daily visits to this dashboard.
                </div>
              )}
            </div>

            {/* System health + Plan dist */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:18 }}>
                <SectionHeader title="System Health" />
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: system.db_ok ? "#22c55e" : "#ef4444" }} />
                  <span style={{ fontSize:13, color: system.db_ok ? "#22c55e" : "#ef4444", fontWeight:600 }}>
                    Database {system.db_ok ? "Healthy" : "Down"}
                  </span>
                  <span style={{ fontSize:11, color:"#737373", marginLeft:"auto" }}>{system.db_ms}ms</span>
                </div>
                <div style={{ fontSize:12, color:"#737373" }}>Signal CRM v{system.version} · {system.env}</div>
              </div>

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:18, flex:1 }}>
                <SectionHeader title="Plan Distribution" />
                {Object.entries(revenue.plan_dist).length === 0 ? (
                  <div style={{ fontSize:13, color:"#737373" }}>No paid subscribers yet.</div>
                ) : Object.entries(revenue.plan_dist).map(([plan, cnt]) => (
                  <div key={plan} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:12, color: PLAN_COLOR[plan] || "#b3b3b3", fontWeight:600, textTransform:"capitalize" }}>{plan}</span>
                      <span style={{ fontSize:12, color:"#e5e5e5", fontWeight:700 }}>{cnt} users</span>
                    </div>
                    <MiniBar pct={(cnt / Math.max(users.paid, 1)) * 100} color={PLAN_COLOR[plan] || "#b3b3b3"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════ REVENUE TAB ════════════════════════════ */}
      {tab === "revenue" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
            <KpiCard label="Monthly Recurring Revenue" value={revenue.mrr_fmt} sub="From active paid subscriptions" gradient="linear-gradient(135deg,#00F0FF,#7C3AED)" icon="💰" />
            <KpiCard label="Annual Run Rate" value={revenue.arr_fmt} sub="MRR × 12" color="#a855f7" icon="📈" />
            <KpiCard label="Account ARR" value={crm.total_arr_fmt} sub="From accounts table" color="#22c55e" icon="🏢" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Revenue by Plan" sub="MRR contribution per tier" />
              {Object.keys(revenue.plan_mrr).length === 0 ? (
                <div style={{ color:"#737373", fontSize:13, padding:"20px 0" }}>No paid subscribers yet.</div>
              ) : (
                (() => {
                  const maxMrr = Math.max(...Object.values(revenue.plan_mrr), 1);
                  return Object.entries(revenue.plan_mrr).map(([plan, mrr]) => (
                    <div key={plan} style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:13, color: PLAN_COLOR[plan] || "#b3b3b3", fontWeight:700, textTransform:"capitalize" }}>{plan}</span>
                        <div style={{ textAlign:"right" }}>
                          <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>₹{mrr.toLocaleString("en-IN")}</span>
                          <span style={{ fontSize:11, color:"#737373", marginLeft:6 }}>{revenue.plan_dist[plan]} users</span>
                        </div>
                      </div>
                      <div style={{ height:8, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ width:`${(mrr/maxMrr)*100}%`, height:"100%", background:`linear-gradient(90deg,${PLAN_COLOR[plan]||"#b3b3b3"},${PLAN_COLOR[plan]||"#b3b3b3"}80)`, borderRadius:4, transition:"width 0.6s" }} />
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>

            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Revenue Milestones" />
              {[
                { label:"₹10L ARR", target:1_000_000, hint:"10 Pro users" },
                { label:"₹1Cr ARR", target:10_000_000, hint:"~105 Pro users" },
                { label:"₹5Cr ARR", target:50_000_000, hint:"~520 Pro users" },
              ].map(m => {
                const pct = Math.min((revenue.arr / m.target) * 100, 100);
                return (
                  <div key={m.label} style={{ marginBottom:18 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:"#e5e5e5" }}>{m.label}</span>
                      <span style={{ fontSize:12, color: pct >= 100 ? "#22c55e" : "#737373" }}>
                        {pct >= 100 ? "✓ Achieved" : `${pct.toFixed(1)}% · ${m.hint}`}
                      </span>
                    </div>
                    <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background: pct >= 100 ? "#22c55e" : "linear-gradient(90deg,#00F0FF,#7C3AED)", borderRadius:3, transition:"width 0.8s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════ USERS TAB ══════════════════════════════ */}
      {tab === "users" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            <KpiCard label="Total Users" value={users.total} sub="All time" color="#fff" icon="👥" />
            <KpiCard label="Paid" value={users.paid} sub={`${users.conversion_rate}% of total`} color="#22c55e" icon="✅" />
            <KpiCard label="Trial / Unpaid" value={users.trial} sub="Need conversion" color="#f59e0b" icon="⏳" />
            <KpiCard label="New This Month" value={users.new_month} sub={`+${users.new_week} this week · +${users.new_today} today`} color="#6366f1" icon="🆕" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
            {/* Conversion funnel */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Conversion Funnel" sub="Trial → Paid" />
              {[
                { label:"Total Signups", count:users.total, color:"#6366f1" },
                { label:"Active Users",  count:users.total, color:"#a855f7" },
                { label:"Paid Subscribers", count:users.paid, color:"#22c55e" },
              ].map((f, i, arr) => (
                <div key={f.label} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:13, color:f.color, fontWeight:600 }}>{f.label}</span>
                    <span style={{ fontSize:13, color:"#fff", fontWeight:700 }}>{f.count}</span>
                  </div>
                  <div style={{ height:8, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${(f.count / Math.max(users.total, 1)) * 100}%`, height:"100%", background:f.color, borderRadius:4, transition:"width 0.6s" }} />
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ fontSize:11, color:"#555", textAlign:"right", marginTop:4 }}>
                      ↓ {((f.count > 0 ? arr[i+1]?.count / f.count : 0) * 100).toFixed(0)}% drop-through
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recent signups */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Recent Signups" sub="Last 10 registrations" />
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {recent_signups.map(u => (
                  <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"rgba(255,255,255,0.02)", borderRadius:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,#6366f1,#a855f7)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0 }}>
                      {u.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name || u.email}</div>
                      <div style={{ fontSize:10, color:"#737373" }}>{u.company || u.email}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:10, color: u.is_paid ? "#22c55e" : "#f59e0b", fontWeight:700 }}>
                        {u.is_paid ? `✓ ${u.plan}` : "trial"}
                      </div>
                      <div style={{ fontSize:10, color:"#555" }}>{u.joined.split(" ").slice(0, 2).join(" ")}</div>
                    </div>
                  </div>
                ))}
                {recent_signups.length === 0 && (
                  <div style={{ color:"#737373", fontSize:13, padding:"20px 0", textAlign:"center" }}>No signups yet.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════ PIPELINE TAB ═══════════════════════════ */}
      {tab === "pipeline" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            <KpiCard label="Pipeline Value" value={pipeline.pipeline_fmt} sub={`${pipeline.total_deals} total deals`} color="#a855f7" icon="💼" />
            <KpiCard label="Won Revenue" value={pipeline.won_fmt} sub="Closed won" color="#22c55e" icon="🏆" />
            <KpiCard label="Win Rate" value={`${pipeline.win_rate}%`} sub="Based on closed deals" color={pipeline.win_rate >= 30 ? "#22c55e" : pipeline.win_rate >= 15 ? "#f59e0b" : "#ef4444"} icon="🎯" />
            <KpiCard label="Avg Deal Size" value={pipeline.avg_deal_fmt} sub="Open pipeline" color="#00F0FF" icon="📐" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
            {/* Stage breakdown */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Pipeline by Stage" sub="Deal count and value per stage" />
              {STAGE_ORDER.filter(s => pipeline.by_stage[s]).map(stage => {
                const d = pipeline.by_stage[stage];
                const col = STAGE_COLOR[stage] || "#737373";
                const maxVal = Math.max(...Object.values(pipeline.by_stage).map(s => s.value || 0), 1);
                return (
                  <div key={stage} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:col }} />
                        <span style={{ fontSize:12, color:col, fontWeight:600, textTransform:"capitalize" }}>{stage}</span>
                        <span style={{ fontSize:11, color:"#737373" }}>×{d.count}</span>
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:"#e5e5e5" }}>₹{(d.value||0).toLocaleString("en-IN")}</span>
                    </div>
                    <div style={{ height:5, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${((d.value||0)/maxVal)*100}%`, height:"100%", background:col, borderRadius:3, transition:"width 0.6s" }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(pipeline.by_stage).length === 0 && (
                <div style={{ color:"#737373", fontSize:13, padding:"20px 0" }}>No deals yet.</div>
              )}
            </div>

            {/* Top accounts */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Top Accounts by ARR" sub="Highest value customers" />
              {top_accounts.length === 0 ? (
                <div style={{ color:"#737373", fontSize:13, padding:"20px 0" }}>No accounts with ARR yet.</div>
              ) : top_accounts.map((acc, i) => (
                <div key={acc.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i < top_accounts.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,#00F0FF,#7C3AED)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>
                    {acc.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acc.name}</div>
                    <div style={{ fontSize:11, color:"#737373" }}>{acc.industry || acc.country || "—"}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#22c55e" }}>{acc.arr_fmt}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════ INTEL TAB ══════════════════════════════ */}
      {tab === "intel" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
            {/* Activity feed */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
              <SectionHeader title="Live Activity Feed" sub="Recent actions across all users" />
              {activity_feed.length === 0 ? (
                <div style={{ color:"#737373", fontSize:13, padding:"20px 0", textAlign:"center" }}>No activity yet.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {activity_feed.map(a => (
                    <div key={a.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                        {TYPE_ICON[a.type] || "📌"}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#e5e5e5", lineHeight:1.4 }}>{a.title}</div>
                        <div style={{ fontSize:10, color:"#737373", marginTop:2 }}>{a.time}{a.outcome ? ` · ${a.outcome}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CRM health */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
                <SectionHeader title="CRM Health" />
                {[
                  { label:"Contacts", value:crm.total_contacts, color:"#6366f1", icon:"📇" },
                  { label:"Accounts", value:crm.total_accounts, color:"#00F0FF", icon:"🏢" },
                  { label:"Activities Today", value:crm.activities_today, color:"#a855f7", icon:"⚡" },
                  { label:"Activities This Week", value:crm.activities_week, color:"#7C3AED", icon:"📅" },
                  { label:"Open Tasks", value:crm.tasks_open, color: crm.tasks_overdue > 0 ? "#ef4444" : "#22c55e", icon:"✅" },
                ].map(item => (
                  <div key={item.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14 }}>{item.icon}</span>
                      <span style={{ fontSize:13, color:"#b3b3b3" }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize:18, fontWeight:800, color:item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:"rgba(34,197,94,0.04)", border:"1px solid rgba(34,197,94,0.15)", borderRadius:14, padding:18 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#22c55e", marginBottom:8 }}>SYSTEM STATUS</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: system.db_ok ? "#22c55e" : "#ef4444" }} />
                  <span style={{ fontSize:13, color:"#e5e5e5" }}>API &amp; Database</span>
                  <span style={{ fontSize:12, color: system.db_ok ? "#22c55e" : "#ef4444", marginLeft:"auto", fontWeight:700 }}>
                    {system.db_ok ? "✓ Operational" : "✗ Degraded"}
                  </span>
                </div>
                <div style={{ fontSize:11, color:"#737373", marginTop:8 }}>Latency: {system.db_ms}ms · v{system.version} · {system.env}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
