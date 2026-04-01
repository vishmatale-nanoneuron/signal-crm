export const API_BASE = "https://signal-crm-api-production.up.railway.app";

// Broadcast auto-logout to all tabs/listeners
function broadcastLogout(reason = "session_expired") {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("sig_logout_reason", reason); } catch {}
  window.dispatchEvent(new CustomEvent("sig:logout", { detail: { reason } }));
}

export function apiFetch(path, opts = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("sig_token") : "";

  // Client-side token expiry check before even making the request
  if (token && isTokenExpired(token)) {
    broadcastLogout("token_expired");
    logout();
    return Promise.resolve({ success: false, _autoLogout: true });
  }

  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = "Bearer " + token;

  return fetch(API_BASE + "/api" + path, { ...opts, headers })
    .then(async (r) => {
      if (r.status === 401) {
        broadcastLogout("unauthorized");
        logout();
        return { success: false, _autoLogout: true };
      }
      if (r.status === 403) {
        return { success: false, error: "forbidden" };
      }
      const data = await r.json();
      return data;
    })
    .catch(() => ({ success: false, error: "network_error" }));
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sig_user") || "null"); } catch { return null; }
}

export function saveAuth(token, user) {
  localStorage.setItem("sig_token", token);
  localStorage.setItem("sig_user", JSON.stringify(user));
  localStorage.removeItem("sig_logout_reason");
}

export function logout() {
  localStorage.removeItem("sig_token");
  localStorage.removeItem("sig_user");
}

export function isLoggedIn() {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("sig_token");
  if (!token) return false;
  if (isTokenExpired(token)) { logout(); return false; }
  return true;
}

// Decode JWT payload without verification (verification happens server-side)
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // 30-second grace window to account for clock skew
    return payload.exp && Date.now() / 1000 > payload.exp - 30;
  } catch {
    return false; // if we can't decode, let the server decide
  }
}

export function getLogoutReason() {
  if (typeof window === "undefined") return null;
  const r = localStorage.getItem("sig_logout_reason");
  if (r) localStorage.removeItem("sig_logout_reason");
  return r;
}
