/**
 * The whole API surface, which is small on purpose.
 *
 * There are no accounts and no tokens. Every request carries a fridge session
 * id the browser made up once and keeps in localStorage — it identifies a
 * shelf, not a person, and there is nothing behind it worth protecting.
 */

const SESSION_KEY = "fridgemama_session";
const HOST_KEY = "fridgemama_kitchen";

/**
 * Where the API lives, which is not the same question in both places this app
 * runs.
 *
 * In a browser it is same-origin. The page and `/api` come off the same
 * server, which is exactly why a phone that visits the address the laptop
 * prints needs no configuration at all.
 *
 * Inside the Android app there is no such luck. The screens are served out of
 * the APK itself, so a relative `/api` resolves to a file that is not in
 * there. The app has to be told the laptop's address once and remember it —
 * which is honest about what this is: a phone talking to a kitchen server two
 * feet away, not a cloud service pretending the laptop does not exist.
 *
 * Capacitor defines window.Capacitor before any of our code runs, so this is
 * decided before the first request rather than configured at build time. One
 * build, two homes.
 */
export const isNativeApp = (() => {
  try {
    const bridge = window.Capacitor;
    if (!bridge) return false;
    // isNativePlatform() is the documented answer. Falling back to the mere
    // presence of the bridge matters because getting this wrong in that
    // direction is fatal — the app would ask itself for /api, find a file that
    // is not there, and show "couldn't reach the kitchen" forever with no way
    // to reach the screen that fixes it.
    return typeof bridge.isNativePlatform === "function" ? bridge.isNativePlatform() : true;
  } catch {
    return false;
  }
})();

// Baked in at build time so the APK you hand a judge already knows where the
// laptop was when you built it. Still editable in the app, because the address
// changes the moment you move to a different hotspot.
const DEFAULT_KITCHEN = (import.meta.env.VITE_KITCHEN_HOST || "").trim();

/**
 * Accept what somebody standing at a stall would actually type.
 *
 *   192.168.0.203            -> http://192.168.0.203:8000
 *   192.168.0.203:8000       -> http://192.168.0.203:8000
 *   http://192.168.0.203:8000 -> unchanged
 */
export function normaliseKitchen(value) {
  let host = String(value || "").trim().replace(/\/+$/, "");
  if (!host) return "";
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
  if (!/:\d+$/.test(host.replace(/^https?:\/\//i, ""))) host = `${host}:8000`;
  return host;
}

export function kitchenHost() {
  try {
    return localStorage.getItem(HOST_KEY) || DEFAULT_KITCHEN;
  } catch {
    return DEFAULT_KITCHEN;
  }
}

export function setKitchenHost(value) {
  const host = normaliseKitchen(value);
  try {
    if (host) localStorage.setItem(HOST_KEY, host);
    else localStorage.removeItem(HOST_KEY);
  } catch {
    // Storage blocked. The value still holds for the life of this page.
  }
  return host;
}

function base() {
  if (!isNativeApp) return "/api";
  const host = kitchenHost();
  return host ? `${host}/api` : "/api";
}

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

  const response = await fetch(`${base()}${path}`, {
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

export const recipeImage = (path) => (path ? `${base()}/recipe-images/${path}` : null);

/**
 * Is there a kitchen at this address?
 *
 * Used by the connect screen before it saves anything, because "saved" and
 * "works" being different things is how somebody ends up staring at a spinner
 * with a judge waiting.
 */
export async function pingKitchen(value) {
  const host = normaliseKitchen(value);
  if (!host) throw new Error("Type the address shown on the laptop.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${host}/api/fridge/scan/status`, {
      headers: { Accept: "application/json", "X-Fridge-Session": sessionId() },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`The kitchen answered ${response.status}.`);
    await response.json();
    return host;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("No answer. Check both devices are on the same WiFi.");
    }
    throw new Error("Couldn't reach that address. Check it and try again.");
  } finally {
    clearTimeout(timer);
  }
}
