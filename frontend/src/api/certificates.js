import { apiFetch } from "./client";

export const listCertificates = (token) =>
  apiFetch("/api/certificates/", { token }).then((r) => r.json());

/**
 * Issue a single certificate.
 * Pass a FormData as `body`; returns the Response so the caller can read
 * either a PDF blob or JSON depending on whether a template was uploaded.
 */
export const issueCertificate = (formData, token) =>
  apiFetch("/api/certificates/issue", { method: "POST", body: formData, token });

/**
 * Bulk-issue from CSV.
 * Returns the Response so the caller can read either a ZIP blob or JSON array.
 */
export const bulkIssueCertificates = (formData, token) =>
  apiFetch("/api/certificates/bulk-issue", { method: "POST", body: formData, token });
