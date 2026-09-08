/**
 * The whole API surface, which is small on purpose.
 *
 * There are no accounts and no tokens. Every request carries a fridge session
 * id the browser made up once and keeps in localStorage — it identifies a
 * shelf, not a person, and there is nothing behind it worth protecting.
 */

const BASE = "/api";
const SESSION_KEY = "fridgemama_session";

function sessionId() {
  let id = null;

  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {
    // Private browsing with storage blocked: fall through to a per-tab id.
  }

  if (!id) {
    id = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .replace(/[^A-Za-z0-9_-]/g, "");
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      // Nothing to do — the id still works for the life of this page.
    }
  }

  return id;
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {
    Accept: "application/json",
    "X-Fridge-Session": sessionId(),
    ...(isForm ? {} : body ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const payload = (response.headers.get("content-type") || "").includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const firstFieldError = payload?.errors ? Object.values(payload.errors).flat()[0] : null;
    const error = new Error(firstFieldError || payload?.message || "Something went wrong.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  // -- the whole screen, in one call --------------------------------------
  fridge: () => request("/fridge"),
  addItem: (name) => request("/fridge/items", { method: "POST", body: { name } }),
  setExpiry: (id, expiresOn) =>
    request(`/fridge/items/${id}`, { method: "PATCH", body: { expires_on: expiresOn || null } }),
  removeItem: (id, binned = false) =>
    request(`/fridge/items/${id}${binned ? "?binned=1" : ""}`, { method: "DELETE" }),

  // -- the demo clock ------------------------------------------------------
  fastForward: (days = 1) => request("/fridge/fast-forward", { method: "POST", body: { days } }),
  reset: () => request("/fridge/reset", { method: "POST", body: {} }),

  // -- scanning ------------------------------------------------------------
  scanStatus: () => request("/fridge/scan/status"),
  scan: (file) => {
    const form = new FormData();
    form.append("photo", file);
    return request("/fridge/scan", { method: "POST", body: form, isForm: true });
  },
  confirmScan: (items) => request("/fridge/scan/confirm", { method: "POST", body: { items } }),

  // -- cooking -------------------------------------------------------------
  recipe: (id) => request(`/recipes/${id}`),
  cooked: (id, pantryItemIds) =>
    request(`/recipes/${id}/cooked`, {
      method: "POST",
      body: pantryItemIds ? { pantry_item_ids: pantryItemIds } : {},
    }),
  restore: (items) => request("/fridge/restore", { method: "POST", body: { items } }),

  // -- manual correction ---------------------------------------------------
  ingredients: (search) =>
    request(`/ingredients${search ? `?search=${encodeURIComponent(search)}&limit=8` : "?limit=8"}`),
};

export const recipeImage = (path) => (path ? `${BASE}/recipe-images/${path}` : null);
