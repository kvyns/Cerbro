import { apiFetch } from "./client";

export const getMe = (token) =>
  apiFetch("/api/users/me", { token }).then((r) => r.json());

export const addCredits = (amount, token) =>
  apiFetch("/api/users/me/credits/add", {
    method: "POST",
    body: JSON.stringify({ amount }),
    headers: { "Content-Type": "application/json" },
    token,
  }).then((r) => r.json());

/** Returns raw Response so the caller can stream the ZIP blob. */
export const exportData = (token) =>
  apiFetch("/api/users/me/export", { token });

export const deleteAccount = (token) =>
  apiFetch("/api/users/me", { method: "DELETE", token });
