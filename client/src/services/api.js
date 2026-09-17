// Base URL for the backend. In dev, Vite proxies /api and /uploads to the
// Express server (see vite.config.js), so a relative path works both in
// dev and in a same-origin production deploy.
const BASE = "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listProjects: () => request("/api/projects"),
  createProject: (payload) =>
    request("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  getProject: (id) => request(`/api/projects/${id}`),
  saveProject: (id, payload) =>
    request(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  renameProject: (id, name) =>
    request(`/api/projects/${id}/rename`, { method: "PUT", body: JSON.stringify({ name }) }),
  saveProjectAs: (id, name) =>
    request(`/api/projects/${id}/save-as`, { method: "POST", body: JSON.stringify({ name }) }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: "DELETE" }),
  upload: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/upload", { method: "POST", body: formData });
  },
};
