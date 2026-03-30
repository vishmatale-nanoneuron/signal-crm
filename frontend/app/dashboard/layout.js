"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser, logout, apiFetch } from "../../lib/api";

const NAV = [
  { href: "/dashboard", icon: "⚡", label: "Signal Feed" },
  { href: "/dashboard/watchlist", icon: "👁", label: "Watchlist" },
  { href: "/dashboard/leads", icon: "🎯", label: "Leads" },
  { href: "/dashboard/buyer-map", icon: "🗺", label: "Buyer Map" },
  { href: "/dashboard/compliance", icon: "🛡", label: "Compliance" },
  { href: "/dashboard/deals", icon: "💼", label: "Deals" },
  { href: "/dashboard/next-actions", icon: "📋", label: "Next Actions" },
  { href: "/dashboard/payment", icon: "💳", label: "Upgrade" },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [trial, setTrial] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace("/login"); return; }
    setUser(u);
    apiFetch("/auth/me").then(d => {
      if (d.success) { setUser(d.user); setTrial(d.trial); }
      else { logout(); router.replace("/login"); }
    }).catch(() => {});
  }, []);

  function doLogout() { logout(); router.replace("/login"); }

  const active = (href) => {
    if (href === "/dashboard") return path === "/dashboard";
    return path.startsWith(href);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside style={{ width: "var(--sidebar-w)", flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 10 }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#00D9FF,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#06080D" }}>S</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Signal CRM</div>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>by Nanoneuron</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8,
              fontSize: 13, fontWeight: active(n.href) ? 600 : 400,
              background: active(n.href) ? "rgba(0,217,255,0.1)" : "transparent",
              color: active(n.href) ? "var(--accent)" : "var(--text2)",
              transition: "all 0.15s",
              textDecoration: "none",
            }}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>

        {/* User + trial */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          {trial && (
            <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(168,85,247,0.08)", borderRadius: 8, fontSize: 11 }}>
              {trial.status === "trial" && <><span style={{ color: "var(--accent2)", fontWeight: 600 }}>{trial.days_left}d trial left</span><br /><span style={{ color: "var(--text3)" }}>Upgrade to keep access</span></>}
              {trial.status === "active" && <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ {user?.plan} plan active</span>}
              {trial.status === "expired" && <span style={{ color: "var(--red)", fontWeight: 600 }}>Trial expired — upgrade now</span>}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#00D9FF,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: "#06080D" }}>
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "User"}</div>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>{user?.credits || 0} credits</div>
            </div>
          </div>
          <button onClick={doLogout} style={{ width: "100%", padding: "7px 0", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--text3)", fontSize: 11, cursor: "pointer", border: "1px solid var(--border)" }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: "var(--sidebar-w)", flex: 1, minHeight: "100vh", padding: "28px 32px" }}>
        {children}
      </main>
    </div>
  );
}
