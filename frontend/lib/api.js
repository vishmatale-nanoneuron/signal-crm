// NEXT_PUBLIC_API_URL must be set in Cloudflare Pages environment variables
// Value: your Railway backend URL e.g. https://signal-crm-production.up.railway.app
export const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL)
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000";

export function apiFetch(path, opts = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("sig_token") : "";
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = "Bearer " + token;
  return fetch(API_BASE + "/api" + path, { ...opts, headers }).then((r) => r.json());
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sig_user") || "null"); } catch { return null; }
}

export function saveAuth(token, user) {
  localStorage.setItem("sig_token", token);
  localStorage.setItem("sig_user", JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem("sig_token");
  localStorage.removeItem("sig_user");
}

export function isLoggedIn() {
  return typeof window !== "undefined" && !!localStorage.getItem("sig_token");
}
