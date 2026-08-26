import { supabase } from "./supabaseClient";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function getAccessToken(refresh = false) {
  if (!supabase) return null;
  const result = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
  if (result.error) throw result.error;
  return result.data.session?.access_token || null;
}

async function send(path, options, token) {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}/api${path}`, { ...options, headers, body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body });
}

async function request(path, options = {}) {
  let token;
  try { token = await getAccessToken(); } catch { token = null; }
  let response;
  try { response = await send(path, options, token); }
  catch { throw new ApiError("Could not reach the API. Check that the backend is running.", 0, "NETWORK_ERROR"); }

  if (response.status === 401 && supabase) {
    try {
      const refreshedToken = await getAccessToken(true);
      if (!refreshedToken) throw new Error("No refreshed session");
      response = await send(path, options, refreshedToken);
    } catch {
      await supabase.auth.signOut().catch(() => {});
      if (window.location.pathname !== "/auth") window.location.assign("/auth");
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const detail = payload.detail || payload; throw new ApiError(detail.message || "Something went wrong.", response.status, detail.code); }
  return payload;
}

export const api = {
  get: path => request(path), post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }), patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: path => request(path, { method: "DELETE" }), upload: (path, data) => request(path, { method: "POST", body: data }),
};
