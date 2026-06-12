export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export const VERIFY_API_URL = `${API_BASE}/api/certificates/verify`;
export const PUBLIC_VERIFY_BASE = (import.meta.env.VITE_PUBLIC_VERIFY_BASE_URL || "https://cerbro.vercel.app").replace(/\/$/, "");

/**
 * Thin fetch wrapper. Returns the raw Response on 2xx; throws an Error with
 * `.status` and `.message` set to the API's `detail` field on non-2xx.
 *
 * Pass `token` in options to add an Authorization header automatically.
 */
export async function apiFetch(path, { token, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.clone().json();
      detail = body.detail || detail;
    } catch {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  return res;
}
