"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser, logout, apiFetch, getLogoutReason } from "../../lib/api";

const NAV = [
  { href: "/dashboard",              label: "Home" },
  { href: "/dashboard/watchlist",    label: "Watchlist" },
  { href: "/dashboard/leads",        label: "Leads" },
  { href: "/dashboard/buyer-map",    label: "Buyer Map" },
  { href: "/dashboard/compliance",   label: "Compliance" },
  { href: "/dashboard/deals",        label: "Deals" },
  { href: "/dashboard/next-actions", label: "Next Actions" },
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
  const [toast,       setToast]       = useState(null); // { msg, type }
  const dropdownRef = useRef(null);
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

      if (d.trial?.status === "expired" && !FREE_PATHS.includes(path)) {
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

  // Re-check trial status on path change
  useEffect(() => {
    if (trial?.status === "expired" && !FREE_PATHS.includes(path)) {
      router.replace("/dashboard/payment");
    }
  }, [path, trial]);

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
    const handler = (e) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
        <a href="/dashboard" style={{ fontSize:24, fontWeight:900, color:"#E50914", letterSpacing:"-0.5px", fontStyle:"italic", marginRight:32, flexShrink:0, textDecoration:"none" }}>
          SIGNAL
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
