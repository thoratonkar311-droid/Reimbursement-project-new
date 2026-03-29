/**
 * js/api.js
 * Centralized API client - all backend communication
 */

const API_BASE = "/api";

// ─── Request helper ───────────────────────────────────────────
async function request(method, path, body = null, isFormData = false) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  const config = { method, headers };
  if (body) config.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(API_BASE + path, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

const get  = (path) => request("GET", path);
const post = (path, body) => request("POST", path, body);
const put  = (path, body) => request("PUT", path, body);
const del  = (path) => request("DELETE", path);

// ─── Auth ─────────────────────────────────────────────────────
const API = {
  auth: {
    signup: (data) => post("/auth/signup", data),
    login:  (data) => post("/auth/login", data),
    me:     ()     => get("/auth/me"),
  },

  // ─── Users ─────────────────────────────────────────────────
  users: {
    list:    ()           => get("/users"),
    managers:()           => get("/users/managers"),
    create:  (data)       => post("/users", data),
    update:  (id, data)   => put(`/users/${id}`, data),
    remove:  (id)         => del(`/users/${id}`),
  },

  // ─── Expenses ──────────────────────────────────────────────
  expenses: {
    list:       (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get(`/expenses${q ? "?" + q : ""}`);
    },
    pendingMine: () => get("/expenses/pending-mine"),
    get:         (id) => get(`/expenses/${id}`),
    submit:      (data) => post("/expenses", data),
    delete:      (id) => del(`/expenses/${id}`),
  },

  // ─── Approvals ─────────────────────────────────────────────
  approvals: {
    action:   (expenseId, data) => post(`/approvals/${expenseId}/action`, data),
    override: (expenseId, data) => post(`/approvals/${expenseId}/override`, data),
    stats:    () => get("/approvals/stats"),
  },

  // ─── Company ───────────────────────────────────────────────
  company: {
    get:      () => get("/company"),
    update:   (data) => put("/company", data),
    getFlow:  () => get("/company/flow"),
    saveFlow: (data) => post("/company/flow", data),
    stats:    () => get("/company/stats"),
  },

  // ─── OCR ───────────────────────────────────────────────────
  ocr: {
    scanBase64: (data) => post("/ocr/scan-base64", data),
    scan: async (file) => {
      const form = new FormData();
      form.append("receipt", file);
      return request("POST", "/ocr/scan", form, true);
    },
  },

  // ─── Currency ──────────────────────────────────────────────
  currency: {
    countries: () => get("/currency/countries"),
    rates:     (base) => get(`/currency/rates/${base}`),
    convert:   (data) => post("/currency/convert", data),
  },
};

window.API = API;
