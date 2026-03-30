const PROD_API = "https://signal-crm-api.onrender.com";

export const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? PROD_API
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
