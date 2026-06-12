import { apiFetch } from "./client";

export const listProjects = (token) =>
  apiFetch("/api/projects/", { token }).then((r) => r.json());

export const createProject = (data, token) =>
  apiFetch("/api/projects/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
    token,
  }).then((r) => r.json());

export const deleteProject = (projectId, token) =>
  apiFetch(`/api/projects/${projectId}`, { method: "DELETE", token });
