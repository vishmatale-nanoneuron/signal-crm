"use client";
import { useState, useEffect } from "react";
import { apiFetch, getUser, saveAuth } from "../../../lib/api";

export const metadata = { title: "Settings" };

function Section({ title, children }) {
  return (
    <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, marginBottom:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 24px", borderBottom:"1px solid rgba(255,255,255,0.07)", fontSize:13, fontWeight:700, color:"#fff", letterSpacing:"0.02em" }}>
        {title}
      </div>
      <div style={{ padding:"24px" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#b3b3b3", marginBottom:6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:"#555", marginTop:5 }}>{hint}</div>}
    </div>
  );
}

function Input({ value, onChange, type="text", placeholder="", disabled=false, style={} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width:"100%", padding:"10px 14px", borderRadius:6, fontSize:13,
        background: disabled ? "#111" : "#252525",
        border: "1px solid rgba(255,255,255,0.1)",
        color: disabled ? "#555" : "#fff",
        outline:"none", boxSizing:"border-box",
        cursor: disabled ? "not-allowed" : "text",
        ...style,
      }}
    />
  );
}

function SaveBtn({ loading, label="Save changes", onClick, disabled=false }) {
  return (
    <button onClick={onClick} disabled={loading || disabled} style={{
      padding:"10px 24px", borderRadius:6, fontWeight:700, fontSize:13, cursor:"pointer",
      background: loading || disabled ? "rgba(229,9,20,0.4)" : "#E50914",
      color:"#fff", border:"none", opacity: loading || disabled ? 0.7 : 1,
      transition:"opacity 0.15s",
    }}>
      {loading ? "Saving…" : label}
    </button>
  );
}

function Toast({ msg, type, onClose }) {
  const colors = { success:"#46d369", error:"#E50914", warn:"#f5a623" };
  const bgs    = { success:"rgba(70,211,105,0.1)", error:"rgba(229,9,20,0.1)", warn:"rgba(245,166,35,0.1)" };
  return (
    <div style={{
      position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)", zIndex:9999,
      background: bgs[type]||bgs.success, border:`1px solid ${colors[type]||colors.success}`,
      color: colors[type]||colors.success, padding:"12px 24px", borderRadius:8, fontSize:13, fontWeight:600,
      boxShadow:"0 4px 24px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:12,
      animation:"slideUp 0.3s ease",
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      {msg}
      <span onClick={onClose} style={{ cursor:"pointer", opacity:0.6, fontSize:16 }}>✕</span>
    </div>
  );
}

const PLAN_META = {
  trial:      { label:"Free Trial",  color:"#f5a623", bg:"rgba(245,166,35,0.1)"  },
  starter:    { label:"Starter",     color:"#0071eb", bg:"rgba(0,113,235,0.1)"   },
  pro:        { label:"Pro",         color:"#a855f7", bg:"rgba(168,85,247,0.1)"  },
  enterprise: { label:"Enterprise",  color:"#46d369", bg:"rgba(70,211,105,0.1)"  },
};

export default function SettingsPage() {
  const [user,    setUser]    = useState(null);
  const [trial,   setTrial]   = useState(null);
  const [toast,   setToast]   = useState(null);
  const [tab,     setTab]     = useState("profile");

  // Profile form
  const [name,    setName]    = useState("");
  const [company, setCompany] = useState("");
  const [phone,   setPhone]   = useState("");
  const [saving,  setSaving]  = useState(false);

  // Password form
  const [curPw,   setCurPw]   = useState("");
  const [newPw,   setNewPw]   = useState("");
  const [conPw,   setConPw]   = useState("");
  const [pwSave,  setPwSave]  = useState(false);

  const show = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    apiFetch("/auth/me").then(d => {
      if (d.success) {
        setUser(d.user);
        setTrial(d.trial);
        setName(d.user.name || "");
        setCompany(d.user.company || "");
        setPhone(d.user.phone || "");
      }
    });
  }, []);

  async function saveProfile() {
    setSaving(true);
    const r = await apiFetch("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ name, company_name: company, phone }),
    });
    setSaving(false);
    if (r.success) {
      setUser(u => ({ ...u, name, company, phone }));
      // Update localStorage cache
      const cached = getUser();
      if (cached) saveAuth(localStorage.getItem("sig_token"), { ...cached, name, company });
      show("Profile updated successfully.");
    } else {
      show(r.detail || "Failed to save.", "error");
    }
  }

  async function changePassword() {
    if (newPw !== conPw) { show("New passwords do not match.", "error"); return; }
    if (newPw.length < 8) { show("Password must be at least 8 characters.", "error"); return; }
    setPwSave(true);
    const r = await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: curPw, new_password: newPw }),
    });
    setPwSave(false);
    if (r.success) {
      show("Password changed successfully.");
      setCurPw(""); setNewPw(""); setConPw("");
    } else {
      show(r.detail || "Failed to change password.", "error");
    }
  }

  const planMeta = PLAN_META[user?.plan] || PLAN_META.trial;
  const TABS = [
    { key:"profile",  label:"Profile" },
    { key:"security", label:"Security" },
    { key:"plan",     label:"Plan & Billing" },
    { key:"api",      label:"API" },
  ];

  return (
    <div style={{ maxWidth:680 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:26, fontWeight:900, color:"#fff", marginBottom:6 }}>Settings</h1>
        <p style={{ color:"#555", fontSize:13 }}>Manage your profile, security, and plan.</p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:24, borderBottom:"1px solid rgba(255,255,255,0.07)", paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:"10px 20px", fontSize:13, fontWeight: tab===t.key ? 700 : 400,
            color: tab===t.key ? "#fff" : "#737373",
            background:"none", border:"none", cursor:"pointer",
            borderBottom: tab===t.key ? "2px solid #E50914" : "2px solid transparent",
            marginBottom:-1, transition:"all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ─────────────────────────────────────────── */}
      {tab === "profile" && (
        <>
          <Section title="Personal Information">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:4 }}>
              <Field label="Full Name">
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </Field>
              <Field label="Email" hint="Contact support to change email.">
                <Input value={user?.email || ""} disabled />
              </Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:4 }}>
              <Field label="Company Name">
                <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your company" />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
              </Field>
            </div>
            <SaveBtn loading={saving} onClick={saveProfile} />
          </Section>

          <Section title="Account Info">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {[
                { label:"Account ID", value: user?.id?.slice(0,8)+"…" || "—" },
                { label:"Member since", value: user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—" },
                { label:"Last login", value: user?.last_login_at ? new Date(user.last_login_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:"#141414", borderRadius:6, padding:"14px 16px", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#b3b3b3", fontFamily:"monospace" }}>{value}</div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* ── Security Tab ────────────────────────────────────────── */}
      {tab === "security" && (
        <Section title="Change Password">
          <Field label="Current Password">
            <Input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="New Password" hint="Minimum 8 characters.">
            <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Confirm New Password">
            <Input
              type="password" value={conPw} onChange={e => setConPw(e.target.value)} placeholder="••••••••"
              style={{ borderColor: conPw && newPw && conPw !== newPw ? "rgba(229,9,20,0.5)" : undefined }}
            />
            {conPw && newPw && conPw !== newPw && (
              <div style={{ fontSize:11, color:"#E50914", marginTop:4 }}>Passwords do not match.</div>
            )}
          </Field>
          <SaveBtn loading={pwSave} onClick={changePassword} label="Change password"
            disabled={!curPw || !newPw || !conPw || newPw !== conPw}
          />

          <div style={{ marginTop:28, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:12 }}>Session</div>
            <div style={{ fontSize:12, color:"#737373", marginBottom:12 }}>
              Your session token expires 7 days after login. Sign in again to refresh.
            </div>
          </div>
        </Section>
      )}

      {/* ── Plan Tab ────────────────────────────────────────────── */}
      {tab === "plan" && (
        <>
          <Section title="Current Plan">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{
                    background: planMeta.bg, color: planMeta.color,
                    padding:"4px 14px", borderRadius:20, fontSize:13, fontWeight:700,
                  }}>
                    {planMeta.label}
                  </span>
                  {trial?.status === "trial" && (
                    <span style={{ fontSize:12, color:"#f5a623" }}>
                      {trial.days_left} days left · ends {trial.trial_end}
                    </span>
                  )}
                  {trial?.status === "active" && (
                    <span style={{ fontSize:12, color:"#46d369" }}>✓ Active</span>
                  )}
                  {trial?.status === "expired" && (
                    <span style={{ fontSize:12, color:"#E50914" }}>✗ Expired</span>
                  )}
                </div>
                <div style={{ fontSize:12, color:"#555" }}>
                  Credits remaining: <span style={{ color:"#fff", fontWeight:700 }}>{user?.credits || 0}</span>
                </div>
              </div>
              <a href="/dashboard/payment" style={{
                padding:"10px 24px", borderRadius:6, background:"#E50914",
                color:"#fff", fontWeight:700, fontSize:13, textDecoration:"none",
              }}>
                {trial?.status === "expired" ? "Upgrade Now →" : "Manage Plan →"}
              </a>
            </div>
          </Section>

          <Section title="Plans Comparison">
            {[
              { name:"Starter", price:"₹4,999/mo", features:["50 signal credits","5 watchlist companies","Buyer map","Compliance checker","Deal pipeline"] },
              { name:"Pro", price:"₹8,000/mo", features:["Unlimited signals","25 watchlist companies","AI action engine","40+ compliance frameworks","5 team members"], popular:true },
              { name:"Enterprise", price:"₹19,999/mo", features:["Everything in Pro","Unlimited watchlist","Dedicated manager","API access","Custom onboarding + SLA 99.9%"] },
            ].map(p => (
              <div key={p.name} style={{
                background: p.popular ? "rgba(229,9,20,0.05)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${p.popular ? "rgba(229,9,20,0.3)" : "rgba(255,255,255,0.07)"}`,
                borderRadius:8, padding:"16px 20px", marginBottom:10,
                display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12,
              }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontWeight:700, color:"#fff", fontSize:14 }}>{p.name}</span>
                    {p.popular && <span style={{ background:"rgba(229,9,20,0.2)", color:"#E50914", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>POPULAR</span>}
                    <span style={{ color:"#b3b3b3", fontSize:13 }}>{p.price}</span>
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {p.features.map(f => (
                      <span key={f} style={{ fontSize:11, color:"#737373" }}>✓ {f}</span>
                    ))}
                  </div>
                </div>
                <a href="/dashboard/payment" style={{
                  padding:"8px 18px", borderRadius:6, fontSize:12, fontWeight:700,
                  background: p.popular ? "#E50914" : "rgba(255,255,255,0.07)",
                  color: p.popular ? "#fff" : "#b3b3b3", textDecoration:"none",
                }}>
                  {user?.plan === p.name.toLowerCase() ? "Current" : "Switch →"}
                </a>
              </div>
            ))}
          </Section>

          <Section title="Payment Methods">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}>
              {[
                { icon:"🇮🇳", label:"Razorpay", sub:"UPI · Cards · NetBanking" },
                { icon:"🏦", label:"NEFT Transfer", sub:"Axis Bank · UTIB0005124" },
                { icon:"🌐", label:"SWIFT", sub:"International wire" },
              ].map(m => (
                <div key={m.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, padding:"14px 16px" }}>
                  <div style={{ fontSize:20, marginBottom:6 }}>{m.icon}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#fff", marginBottom:3 }}>{m.label}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* ── API Tab ─────────────────────────────────────────────── */}
      {tab === "api" && (
        <>
          <Section title="Backend API">
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:"#b3b3b3", marginBottom:8 }}>Base URL</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <code style={{ flex:1, background:"#111", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"10px 14px", fontSize:12, color:"#46d369", fontFamily:"monospace", overflowX:"auto" }}>
                  https://signal-crm-api-production.up.railway.app
                </code>
                <button onClick={() => { navigator.clipboard?.writeText("https://signal-crm-api-production.up.railway.app"); show("Copied!"); }} style={{ padding:"10px 14px", borderRadius:6, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#b3b3b3", fontSize:12, cursor:"pointer" }}>
                  Copy
                </button>
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:"#b3b3b3", marginBottom:8 }}>Documentation</div>
              <div style={{ display:"flex", gap:8 }}>
                {[
                  { label:"Swagger UI", href:"https://signal-crm-api-production.up.railway.app/docs" },
                  { label:"ReDoc", href:"https://signal-crm-api-production.up.railway.app/redoc" },
                  { label:"Health", href:"https://signal-crm-api-production.up.railway.app/api/health" },
                ].map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{
                    padding:"8px 16px", borderRadius:6, fontSize:12, fontWeight:600,
                    background:"rgba(0,113,235,0.1)", border:"1px solid rgba(0,113,235,0.2)",
                    color:"#0071eb", textDecoration:"none",
                  }}>
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Authentication">
            <div style={{ fontSize:12, color:"#b3b3b3", marginBottom:12 }}>
              All API requests require a Bearer token from <code style={{ background:"rgba(255,255,255,0.07)", padding:"2px 6px", borderRadius:4, fontSize:11 }}>POST /api/auth/login</code>
            </div>
            <div style={{ background:"#111", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"14px 16px", fontFamily:"monospace", fontSize:12, color:"#b3b3b3", lineHeight:1.8 }}>
              <div style={{ color:"#555", marginBottom:4 }}># Login to get token</div>
              <div>curl -X POST https://signal-crm-api-production.up.railway.app/api/auth/login \</div>
              <div style={{ paddingLeft:16 }}>{"-H 'Content-Type: application/json' \\"}</div>
              <div style={{ paddingLeft:16 }}>{'-d \'{"email":"your@email.com","password":"yourpass"}\''}</div>
              <br/>
              <div style={{ color:"#555", marginBottom:4 }}># Use token in requests</div>
              <div>curl https://signal-crm-api-production.up.railway.app/api/signals/feed \</div>
              <div style={{ paddingLeft:16 }}>{"-H 'Authorization: Bearer YOUR_TOKEN'"}</div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
