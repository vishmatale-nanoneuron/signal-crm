export const API_BASE = "https://signal-crm-api-production.up.railway.app";

function broadcastLogout(reason = "session_expired") {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("sig_logout_reason", reason); } catch (_) {}
  window.dispatchEvent(new CustomEvent("sig:logout", { detail: { reason } }));
}

export function apiFetch(path, opts = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("sig_token") : "";

  if (token && isTokenExpired(token)) {
    broadcastLogout("token_expired");
    logout();
    return Promise.resolve({ success: false, _autoLogout: true });
  }

  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = "Bearer " + token;

  return fetch(API_BASE + "/api" + path, { ...opts, headers })
    .then(async (r) => {
      // 401 = invalid/expired token → force logout
      if (r.status === 401) {
        broadcastLogout("unauthorized");
        logout();
        return { success: false, _autoLogout: true };
      }
      // 403 = trial expired or forbidden → return with flag (don't logout)
      if (r.status === 403) {
        let body = {};
        try { body = await r.json(); } catch (_) {}
        if (body.error === "trial_expired" || body.detail?.error === "trial_expired") {
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard/payment";
          }
          return { success: false, _trialExpired: true };
        }
        return { success: false, error: "forbidden", detail: body.detail || "" };
      }
      // 429 = rate limited
      if (r.status === 429) {
        return { success: false, error: "rate_limited", detail: "Too many requests. Please slow down." };
      }
      try { return await r.json(); }
      catch (_) { return { success: false, error: "invalid_response" }; }
    })
    .catch(() => ({ success: false, error: "network_error" }));
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sig_user") || "null"); } catch (_) { return null; }
}

export function saveAuth(token, user) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("sig_token", token);
    localStorage.setItem("sig_user", JSON.stringify(user));
    localStorage.removeItem("sig_logout_reason");
  } catch (_) {}
}

export function logout() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("sig_token");
    localStorage.removeItem("sig_user");
  } catch (_) {}
}

export function isLoggedIn() {
  if (typeof window === "undefined") return false;
  try {
    const token = localStorage.getItem("sig_token");
    if (!token) return false;
    if (isTokenExpired(token)) { logout(); return false; }
    return true;
  } catch (_) { return false; }
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp && Date.now() / 1000 > payload.exp - 30;
  } catch (_) {
    return false;
  }
}

export function getLogoutReason() {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem("sig_logout_reason");
    if (r) localStorage.removeItem("sig_logout_reason");
    return r;
  } catch (_) { return null; }
}
