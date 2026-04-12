"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser, logout, apiFetch, getLogoutReason } from "../../lib/api";

// ── CSV download helper ──────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const NAV = [
  { href: "/dashboard",                  label: "Home" },
  { href: "/dashboard/analytics",        label: "Analytics" },
  { href: "/dashboard/contacts",         label: "Contacts" },
  { href: "/dashboard/accounts",         label: "Accounts" },
  { href: "/dashboard/deals",            label: "Deals" },
  { href: "/dashboard/activities",       label: "Activities" },
  { href: "/dashboard/tasks",            label: "Tasks" },
  { href: "/dashboard/sequences",        label: "Sequences" },
  { href: "/dashboard/forecast",         label: "Forecast" },
  { href: "/dashboard/watchlist",        label: "Watchlist" },
  { href: "/dashboard/leads",            label: "Leads" },
  { href: "/dashboard/buyer-map",        label: "Buyer Map" },
  { href: "/dashboard/compliance",       label: "Compliance" },
  { href: "/dashboard/next-actions",     label: "Next Actions" },
  { href: "/dashboard/country-intel",    label: "Country Intel" },
  { href: "/dashboard/email-templates",  label: "Email" },
  { href: "/dashboard/settings",         label: "Settings" },
];

const FREE_PATHS = ["/dashboard/payment"];

export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const path     = usePathname();
  const [user,        setUser]        = useState(null);
  const [trial,       setTrial]       = useState(null);
  const [ready,       setReady]       = useState(false);
  const [scrolled,    setScrolled]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast,       setToast]       = useState(null);
  const [sigStats,    setSigStats]    = useState({ total:0, high_priority:0 });
  const [bellOpen,    setBellOpen]    = useState(false);
  const [bellSignals, setBellSignals] = useState([]);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsgs,    setChatMsgs]    = useState([]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const dropdownRef = useRef(null);
  const bellRef     = useRef(null);
  const chatEndRef  = useRef(null);
  const toastTimer  = useRef(null);

  const showToast = useCallback((msg, type = "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const doLogout = useCallback((reason) => {
    logout();
    if (reason === "session_expired" || reason === "token_expired") {
      router.replace("/login?reason=expired");
    } else if (reason === "unauthorized") {
      router.replace("/login?reason=unauthorized");
    } else {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    // Show "why you were logged out" toast on login page redirect check
    const reason = getLogoutReason();
    if (reason === "session_expired" || reason === "token_expired") {
      showToast("Your session expired. Please sign in again.", "warn");
    }

    const u = getUser();
    if (!u) { router.replace("/login"); return; }

    apiFetch("/auth/me").then(d => {
      if (!d.success || d._autoLogout) {
        doLogout(d._autoLogout ? "unauthorized" : "unauthorized");
        return;
      }
      setUser(d.user);
      setTrial(d.trial);
      setReady(true);

      // Load signal stats for notification bell
      apiFetch("/signals/feed").then(sd => {
        if (sd.success) {
          setSigStats(sd.stats || {});
          setBellSignals((sd.feed || []).filter(s => !s.is_actioned).slice(0, 5));
        }
      });

      if (!d.user?.is_paid && !FREE_PATHS.includes(path)) {
        router.replace("/dashboard/payment");
      }
    }).catch(() => {
      doLogout("unauthorized");
    });

    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);

    // Listen for auto-logout events from apiFetch (401 from any page)
    const onAutoLogout = (e) => doLogout(e.detail?.reason);
    window.addEventListener("sig:logout", onAutoLogout);

    // Listen for storage changes (logout from another tab)
    const onStorage = (e) => {
      if (e.key === "sig_token" && !e.newValue) {
        doLogout("session_expired");
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("sig:logout", onAutoLogout);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Re-check payment status on path change — strictly block unpaid users
  useEffect(() => {
    if (user && !user.is_paid && !FREE_PATHS.includes(path)) {
      router.replace("/dashboard/payment");
    }
  }, [path, user]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") { setProfileOpen(false); setBellOpen(false); setChatOpen(false); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close bell on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior:"smooth" });
  }, [chatMsgs]);

  async function sendChat(msg) {
    const text = (msg || chatInput).trim();
    if (!text) return;
    const newMsgs = [...chatMsgs, { role:"user", content:text }];
    setChatMsgs(newMsgs);
    setChatInput("");
    setChatLoading(true);
    try {
      const r = await apiFetch("/ai/chat", {
        method:"POST",
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role:m.role, content:m.content })) }),
      });
      if (r.success) {
        setChatMsgs(prev => [...prev, { role:"assistant", content:r.message }]);
      }
    } catch (e) {
      setChatMsgs(prev => [...prev, { role:"assistant", content:"Sorry, I'm having trouble connecting. Try again." }]);
    }
    setChatLoading(false);
  }

  const active = (href) => href === "/dashboard"
    ? path === "/dashboard"
    : path.startsWith(href);

  if (!ready) {
    return (
      <div style={{ minHeight:"100vh", background:"#141414", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:40, height:40, border:"3px solid #E50914", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text)" }}>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position:"fixed", top:80, left:"50%", transform:"translateX(-50%)",
          zIndex:999, background: toast.type === "warn" ? "rgba(229,9,20,0.95)" : "rgba(229,9,20,0.95)",
          color:"#fff", padding:"12px 24px", borderRadius:4,
          fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.6)",
          display:"flex", alignItems:"center", gap:8,
          animation:"slideDown 0.3s ease",
        }}>
          <span>⚠</span> {toast.msg}
          <span onClick={() => setToast(null)} style={{ marginLeft:12, cursor:"pointer", opacity:0.7 }}>✕</span>
        </div>
      )}
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* Netflix-style top nav */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0,
        height:"var(--nav-h)",
        display:"flex", alignItems:"center",
        padding:"0 56px",
        zIndex:100,
        background: scrolled ? "var(--bg)" : "linear-gradient(180deg,rgba(0,0,0,0.85) 0%,transparent 100%)",
        transition:"background 0.4s",
      }}>
        {/* Logo */}
        <a href="/dashboard" style={{ display:"flex", alignItems:"center", gap:9, marginRight:32, flexShrink:0, textDecoration:"none" }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sg_d" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF"/>
                <stop offset="60%" stopColor="#7C3AED"/>
                <stop offset="100%" stopColor="#A855F7"/>
              </linearGradient>
            </defs>
            <rect width="30" height="30" rx="7" fill="#06080D"/>
            <ellipse cx="15" cy="15" rx="10.5" ry="3" fill="none" stroke="#00F0FF" strokeWidth="0.7" opacity="0.2" transform="rotate(-25 15 15)"/>
            <ellipse cx="15" cy="15" rx="10.5" ry="3" fill="none" stroke="#A855F7" strokeWidth="0.7" opacity="0.2" transform="rotate(25 15 15)"/>
            <rect x="8" y="7.5" width="14" height="3" rx="1.5" fill="url(#sg_d)"/>
            <rect x="8" y="7.5" width="3" height="8" rx="1.5" fill="url(#sg_d)"/>
            <rect x="8" y="13.5" width="14" height="3" rx="1.5" fill="url(#sg_d)"/>
            <rect x="19" y="13.5" width="3" height="8" rx="1.5" fill="url(#sg_d)"/>
            <rect x="8" y="19.5" width="14" height="3" rx="1.5" fill="url(#sg_d)"/>
            <circle cx="4.5" cy="10" r="1.2" fill="#00F0FF" opacity="0.7"/>
            <circle cx="25.5" cy="20" r="1.2" fill="#A855F7" opacity="0.7"/>
            <circle cx="21" cy="7.5" r="0.9" fill="#FFD700" opacity="0.6"/>
          </svg>
          <span style={{ fontSize:16, fontWeight:700, letterSpacing:"-0.3px" }}>
            <span style={{ color:"#fff" }}>Signal</span>
            {" "}
            <span style={{ background:"linear-gradient(135deg,#00F0FF,#A855F7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>CRM</span>
          </span>
        </a>

        {/* Nav links */}
        <div style={{ display:"flex", gap:20, flex:1, alignItems:"center" }}>
          {trial?.status !== "expired" && NAV.map(n => (
            <a key={n.href} href={n.href} style={{
              fontSize:14,
              fontWeight: active(n.href) ? 700 : 400,
              color: active(n.href) ? "#fff" : "#e5e5e5",
              opacity: active(n.href) ? 1 : 0.8,
              textDecoration:"none", whiteSpace:"nowrap",
              transition:"opacity 0.15s",
            }}>
              {n.label}
            </a>
          ))}
          {trial?.status === "expired" && (
            <span style={{ fontSize:13, color:"#E50914", fontWeight:600 }}>
              ⚠ Trial expired — upgrade to continue
            </span>
          )}
        </div>

        {/* Right side */}
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {trial?.status === "trial" && (
            <a href="/dashboard/payment" style={{
              background:"rgba(229,9,20,0.15)", border:"1px solid rgba(229,9,20,0.4)",
              borderRadius:20, padding:"4px 12px", fontSize:12,
              color:"#E50914", fontWeight:600, textDecoration:"none",
            }}>
              {trial.days_left}d trial · Upgrade
            </a>
          )}
          {trial?.status === "active" && (
            <span style={{ fontSize:12, color:"#46d369", fontWeight:600 }}>✓ Active</span>
          )}

          {/* Notification Bell */}
          <div ref={bellRef} style={{ position:"relative" }}>
            <div onClick={() => setBellOpen(o => !o)}
              style={{ cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32 }}>
              <span style={{ fontSize:18 }}>🔔</span>
              {sigStats.high_priority > 0 && (
                <span style={{
                  position:"absolute", top:-2, right:-2,
                  background:"#E50914", color:"#fff", borderRadius:"50%",
                  width:16, height:16, fontSize:10, fontWeight:800,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  lineHeight:1,
                }}>
                  {sigStats.high_priority > 9 ? "9+" : sigStats.high_priority}
                </span>
              )}
            </div>

            {bellOpen && (
              <div style={{
                position:"absolute", top:"calc(100% + 10px)", right:0,
                background:"rgba(20,20,20,0.98)", border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:8, width:340, padding:"12px 0",
                backdropFilter:"blur(12px)", boxShadow:"0 8px 32px rgba(0,0,0,0.8)",
                zIndex:200, animation:"fadeIn 0.15s ease",
              }}>
                <div style={{ padding:"8px 16px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>
                    🔔 Signals
                    {sigStats.high_priority > 0 && (
                      <span style={{ marginLeft:8, background:"rgba(229,9,20,0.15)", color:"#E50914", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>
                        {sigStats.high_priority} high priority
                      </span>
                    )}
                  </div>
                </div>
                {bellSignals.length === 0 ? (
                  <div style={{ padding:"20px 16px", color:"#737373", fontSize:13, textAlign:"center" }}>
                    No active signals. Add companies to your watchlist.
                  </div>
                ) : (
                  bellSignals.map(s => {
                    const colors = { high:"#E50914", medium:"#f5a623", low:"#46d369" };
                    const icons  = { hiring_spike:"📈", new_country_page:"🌍", pricing_change:"💰", new_product:"🚀", leadership_change:"👤", compliance_update:"⚖️" };
                    return (
                      <a key={s.id} href={`/dashboard/signals?id=${s.id}`}
                        onClick={() => setBellOpen(false)}
                        style={{ display:"block", padding:"10px 16px", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.04)" }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      >
                        <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                          <span style={{ fontSize:16, flexShrink:0 }}>{icons[s.signal_type] || "📡"}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:"#fff", lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {s.title}
                            </div>
                            <div style={{ display:"flex", gap:6, marginTop:3 }}>
                              <span style={{ fontSize:10, color:colors[s.signal_strength]||"#737373", fontWeight:700 }}>
                                {(s.signal_strength||"").toUpperCase()}
                              </span>
                              <span style={{ fontSize:10, color:"#737373" }}>{s.account_name}</span>
                            </div>
                          </div>
                          <span style={{ fontSize:13, fontWeight:800, color:"#fff", flexShrink:0 }}>{s.score}/10</span>
                        </div>
                      </a>
                    );
                  })
                )}
                <div style={{ padding:"10px 16px 4px" }}>
                  <a href="/dashboard" onClick={() => setBellOpen(false)}
                    style={{ fontSize:12, color:"#E50914", fontWeight:600, textDecoration:"none" }}>
                    View all signals →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Profile avatar + dropdown */}
          <div ref={dropdownRef} style={{ position:"relative" }}>
            <div
              onClick={() => setProfileOpen(o => !o)}
              style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}
              aria-label="User menu"
              aria-expanded={profileOpen}
            >
              <div style={{
                width:34, height:34, borderRadius:4, background:"#E50914",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:800, fontSize:15, color:"#fff", flexShrink:0,
              }}>
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span style={{ fontSize:11, color:"#e5e5e5", transition:"transform 0.15s", display:"inline-block", transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </div>

            {profileOpen && (
              <div style={{
                position:"absolute", top:"calc(100% + 10px)", right:0,
                background:"rgba(20,20,20,0.97)", border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:6, minWidth:240, padding:"8px 0",
                backdropFilter:"blur(12px)",
                boxShadow:"0 8px 32px rgba(0,0,0,0.8)",
                animation:"fadeIn 0.15s ease",
              }}>
                <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>

                {/* User info */}
                <div style={{ padding:"12px 16px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:4, background:"#E50914", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:17, color:"#fff" }}>
                      {user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#fff" }}>{user?.name}</div>
                      <div style={{ fontSize:11, color:"#b3b3b3" }}>{user?.email}</div>
                    </div>
                  </div>
                  <div style={{ marginTop:10, fontSize:12, color:"#b3b3b3" }}>
                    Plan: <span style={{ color:"#fff", fontWeight:600 }}>{user?.plan || "trial"}</span>
                    &nbsp;·&nbsp;
                    Credits: <span style={{ color:"#fff", fontWeight:600 }}>{user?.credits || 0}</span>
                  </div>
                  {trial?.status === "trial" && (
                    <div style={{ marginTop:8, fontSize:11, color:"#f5a623", fontWeight:600 }}>
                      ⏳ {trial.days_left} days left in free trial
                    </div>
                  )}
                  {trial?.status === "expired" && (
                    <div style={{ marginTop:8, fontSize:11, color:"#E50914", fontWeight:600 }}>
                      ✗ Trial expired — upgrade now
                    </div>
                  )}
                  {trial?.status === "active" && (
                    <div style={{ marginTop:8, fontSize:11, color:"#46d369", fontWeight:600 }}>
                      ✓ Paid plan active
                    </div>
                  )}
                </div>

                {/* Menu items */}
                {[
                  { label:"Upgrade Plan", href:"/dashboard/payment", icon:"⚡" },
                ].map(item => (
                  <div key={item.label}
                    onClick={() => { setProfileOpen(false); router.push(item.href); }}
                    style={{ padding:"10px 16px", fontSize:13, color:"#e5e5e5", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}
                  >
                    <span style={{ opacity:0.7 }}>{item.icon}</span> {item.label}
                  </div>
                ))}

                <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", marginTop:4 }}>
                  <div
                    onClick={() => { setProfileOpen(false); doLogout("manual"); }}
                    style={{ padding:"12px 16px", fontSize:13, color:"#b3b3b3", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}
                  >
                    <span>⎋</span> Sign out of Signal CRM
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── AI Chat Widget ─────────────────────────────────────────────── */}
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:500 }}>

        {/* Chat panel */}
        {chatOpen && (
          <div style={{
            position:"absolute", bottom:60, right:0,
            width:360, height:500, background:"rgba(18,18,18,0.98)",
            border:"1px solid rgba(229,9,20,0.3)", borderRadius:12,
            display:"flex", flexDirection:"column",
            boxShadow:"0 16px 48px rgba(0,0,0,0.9)",
            backdropFilter:"blur(20px)",
            animation:"slideUp 0.2s ease",
          }}>
            {/* Chat header */}
            <div style={{
              padding:"14px 16px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)",
              display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#E50914,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🤖</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Signal AI</div>
                  <div style={{ fontSize:10, color:"#46d369" }}>● Online</div>
                </div>
              </div>
              <button onClick={() => { setChatOpen(false); setChatMsgs([]); }}
                style={{ background:"transparent", border:"none", color:"#737373", cursor:"pointer", fontSize:16 }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
              {chatMsgs.length === 0 && (
                <div>
                  <div style={{ fontSize:12, color:"#b3b3b3", lineHeight:1.7, marginBottom:12 }}>
                    Hi! I'm Signal AI. I know your signals and pipeline. Ask me anything:
                  </div>
                  {[
                    "Which signals should I act on today?",
                    "Draft an email for my top signal",
                    "Can I cold email Germany?",
                    "What's my pipeline status?",
                  ].map(q => (
                    <button key={q} onClick={() => sendChat(q)} style={{
                      display:"block", width:"100%", textAlign:"left", marginBottom:6,
                      padding:"8px 12px", borderRadius:6, fontSize:12, cursor:"pointer",
                      background:"rgba(229,9,20,0.06)", border:"1px solid rgba(229,9,20,0.15)",
                      color:"#b3b3b3",
                    }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chatMsgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth:"88%",
                }}>
                  <div style={{
                    padding:"9px 13px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: m.role === "user" ? "#E50914" : "rgba(255,255,255,0.07)",
                    fontSize:12, color:"#fff", lineHeight:1.7,
                    whiteSpace:"pre-wrap", wordBreak:"break-word",
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf:"flex-start", padding:"9px 13px", borderRadius:"12px 12px 12px 2px", background:"rgba(255,255,255,0.07)" }}>
                  <div style={{ display:"flex", gap:4 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#737373", animation:`bounce 1.2s ${i*0.2}s infinite` }}/>
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:8, flexShrink:0 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }}}
                placeholder="Ask Signal AI…"
                style={{
                  flex:1, padding:"8px 12px", background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.1)", borderRadius:20,
                  color:"#fff", fontSize:12, outline:"none",
                }}
              />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
                style={{
                  padding:"8px 14px", borderRadius:20, background:"#E50914", color:"#fff",
                  fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
                  opacity: (!chatInput.trim() || chatLoading) ? 0.5 : 1,
                }}>
                →
              </button>
            </div>
          </div>
        )}

        {/* Floating button */}
        <button onClick={() => setChatOpen(o => !o)} style={{
          width:52, height:52, borderRadius:"50%",
          background: chatOpen ? "#141414" : "linear-gradient(135deg,#E50914 0%,#a855f7 100%)",
          border: chatOpen ? "1px solid rgba(255,255,255,0.15)" : "none",
          color:"#fff", fontSize:22, cursor:"pointer",
          boxShadow:"0 4px 20px rgba(229,9,20,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all 0.2s",
        }}>
          {chatOpen ? "✕" : "🤖"}
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Main content */}
      <main style={{ padding:"calc(var(--nav-h) + 24px) 56px 48px" }}>
        {trial?.status === "expired" && !FREE_PATHS.includes(path) ? (
          <div style={{ maxWidth:600, margin:"60px auto", textAlign:"center" }}>
            <div style={{ fontSize:56, marginBottom:20 }}>🔒</div>
            <h2 style={{ fontSize:28, fontWeight:800, color:"#fff", marginBottom:12 }}>Your free trial has ended</h2>
            <p style={{ color:"#b3b3b3", fontSize:15, lineHeight:1.8, marginBottom:32 }}>
              Upgrade to keep accessing signals, leads, deals, buyer map, and all CRM features. One closed deal covers months of the plan.
            </p>
            <a href="/dashboard/payment" style={{ display:"inline-block", padding:"14px 40px", background:"#E50914", color:"#fff", fontWeight:700, fontSize:16, borderRadius:4, textDecoration:"none" }}>
              See Plans &amp; Pricing →
            </a>
          </div>
        ) : children}
      </main>
    </div>
  );
}
