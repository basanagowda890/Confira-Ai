import { supabase } from "./supabaseClient";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export class ApiError extends Error {
  constructor(message, status = 0, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function getAccessToken(refresh = false) {
  if (!supabase) return null;
  try {
    const result = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
    if (result.error) return null;
    return result.data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function send(path, options = {}, token = null) {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${baseUrl}/api${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
}

async function request(path, options = {}) {
  let token = await getAccessToken();
  let response;

  try {
    response = await send(path, options, token);
  } catch (err) {
    // Only true network / connection failures reach here
    throw new ApiError("Could not connect to the backend. Make sure the API is running on port 8001.", 0, "NETWORK_ERROR");
  }

  // Handle 401 unauthenticated with automatic token refresh attempt
  if (response.status === 401 && supabase) {
    try {
      const refreshedToken = await getAccessToken(true);
      if (refreshedToken) {
        response = await send(path, options, refreshedToken);
      }
    } catch {
      // Ignore refresh error and process initial response
    }
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload.detail || payload;
    let message = detail?.message || detail?.error;

    // Handle FastAPI / Pydantic validation array
    if (!message && Array.isArray(detail)) {
      message = detail.map(d => d.msg || d.message || JSON.stringify(d)).filter(Boolean).join(", ") || "Please check the interview details.";
    }

    if (!message) {
      if (response.status === 401) {
        message = "Your session has expired. Please log in again.";
      } else if (response.status === 403) {
        message = "You are not authorized to schedule this interview.";
      } else if (response.status === 404) {
        message = "Candidate or position was not found.";
      } else if (response.status === 409) {
        message = "This interview already exists.";
      } else if (response.status === 422) {
        message = "Please check the interview details.";
      } else if (response.status >= 500) {
        message = "Unable to schedule the interview. Please try again.";
      } else {
        message = "Something went wrong.";
      }
    }

    throw new ApiError(message, response.status, detail?.code || (response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR"));
  }

  return payload;
}

export const api = {
  get: path => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: path => request(path, { method: "DELETE" }),
  upload: (path, data) => request(path, { method: "POST", body: data }),
};
