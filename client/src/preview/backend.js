import fixture from "./fixture.json";
import capturedScan from "./scan-1-kitchen-counter.json";

/**
 * The API, reimplemented in the browser, for the deployed preview.
 *
 * FridgeMama's back end is Laravel over SQLite and a Python sidecar holding
 * 370 MB of YOLO weights. None of that fits on a static host, and the project's
 * whole argument is that it does not need to: it runs on the laptop, offline.
 *
 * But a link somebody can only read is a poor way to show an app. So this
 * stands in — the same arithmetic, over the same seeded data, with the
 * detector's answer for the bundled photo recorded from a real run rather than
 * invented.
 *
 * Two rules kept it honest while writing it:
 *
 *   The data is dumped, not authored. `fixture.json` comes out of the real
 *   database: 132 ingredients with their Bangla names and shelf lives, 40
 *   seeded recipes with their real ingredient lists and method steps, the demo
 *   fridge, and the composer's own templates — exported from the PHP constants
 *   so the two cannot drift.
 *
 *   The behaviour is ported, not approximated. The freshness tiers, the
 *   urgency curve, the health dial, the ranking formula and its qualification
 *   gate, and the recipe composer are the same rules as the server, written
 *   again here. Where a number differs from the laptop it is a bug in this
 *   file, not a simplification.
 *
 * What it cannot do is run the model. `POST /fridge/scan` replays a recording
 * of the detector's real output for the one bundled photo — 6 ingredients,
 * boxes and confidences included, 428 ms as measured. An uploaded photo gets
 * the same recording with an honest note attached, because the alternative is
 * pretending.
 */

const HORIZON_DAYS = 7;
const SOON_DAYS = 3;

const WEIGHT_MATCH = 0.6;
const WEIGHT_URGENCY = 0.4;
const MIN_MATCH_PERCENT = 40;
const LOCAL_BONUS = { Bangladesh: 8 };
const REGION_BONUS = { "South Asia": 4 };

const HOUSEHOLDS = [
  { name: "The Rahman family", rescued: 34 },
  { name: "Flat 4B, Tejgaon", rescued: 21 },
  { name: "Nusrat & Arif", rescued: 12 },
  { name: "Hall 3, Room 210", rescued: 6 },
  { name: "Shanto (first week)", rescued: 2 },
];

const bySlug = new Map(fixture.ingredients.map((i) => [i.slug, i]));
const byId = new Map(fixture.ingredients.map((i) => [i.id, i]));
const byName = new Map(fixture.ingredients.map((i) => [i.name.toLowerCase(), i]));

/** The alias table's job, in the small: find an ingredient however it is spelt. */
function lookup(name) {
  const cleaned = String(name || "").trim().toLowerCase();
  if (!cleaned) return null;

  return (
    byName.get(cleaned) ||
    bySlug.get(cleaned.replace(/[\s_]+/g, "-")) ||
    fixture.ingredients.find((i) => i.name.toLowerCase() === cleaned.replace(/s$/, "")) ||
    null
  );
}

// ── state ────────────────────────────────────────────────────────────────
let state = null;
let nextItemId = 1;

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + state.dayOffset);
  return d;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((new Date(to).setHours(0, 0, 0, 0) - from.getTime()) / 86400000);
}

function stock() {
  state = { dayOffset: 0, items: [], waste: [], composed: [] };
  nextItemId = 1;

  for (const row of fixture.demo_fridge) {
    const ingredient = lookup(row.name);
    if (!ingredient) continue;

    addItem(ingredient, row.days_left === null ? null : row.days_left, "seed", false);
  }
}

function addItem(ingredient, daysLeft, source, estimated) {
  const expires =
    daysLeft === null ? null : iso(new Date(today().getTime() + daysLeft * 86400000));

  const existing = state.items.find((i) => i.ingredient_id === ingredient.id);
  if (existing) {
    existing.expires_on = expires;
    return existing;
  }

  const item = {
    id: nextItemId++,
    ingredient_id: ingredient.id,
    expires_on: expires,
    expiry_estimated: estimated,
    source,
  };
  state.items.push(item);
  return item;
}

// ── freshness ────────────────────────────────────────────────────────────
function tierFor(daysLeft) {
  if (daysLeft <= 0) return "today";
  if (daysLeft <= SOON_DAYS) return "soon";
  return "fresh";
}

function urgencyFor(daysLeft) {
  if (daysLeft <= 0) return 1;
  if (daysLeft >= HORIZON_DAYS) return 0;
  return Number((1 - daysLeft / HORIZON_DAYS).toFixed(4));
}

function labelFor(daysLeft) {
  if (daysLeft < -1) return `${Math.abs(daysLeft)} days over`;
  if (daysLeft === -1) return "1 day over";
  if (daysLeft === 0) return "Use today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

function freshnessOf(item) {
  if (!item.expires_on) return null;

  const daysLeft = daysBetween(today(), item.expires_on);
  const ingredient = byId.get(item.ingredient_id);

  return {
    ingredient_id: item.ingredient_id,
    pantry_item_id: item.id,
    name: ingredient.name,
    name_bn: ingredient.name_bn,
    aisle: ingredient.aisle,
    is_staple: ingredient.is_staple,
    expires_on: item.expires_on,
    estimated: item.expiry_estimated,
    days_left: daysLeft,
    tier: tierFor(daysLeft),
    label: labelFor(daysLeft),
    urgency: urgencyFor(daysLeft),
    life_remaining: Number(Math.max(0, Math.min(1, daysLeft / HORIZON_DAYS)).toFixed(3)),
  };
}

function statuses() {
  return state.items.map(freshnessOf).filter(Boolean);
}

function health() {
  const rows = statuses();
  const count = (t) => rows.filter((r) => r.tier === t).length;
  const [fresh, soon, todayCount] = [count("fresh"), count("soon"), count("today")];
  const tracked = Math.max(1, fresh + soon + todayCount);

  return {
    total: state.items.length,
    fresh,
    soon,
    today: todayCount,
    at_risk: soon + todayCount,
    undated: Math.max(0, state.items.length - rows.length),
    percent_fresh: Math.round((fresh / tracked) * 100),
    percent_soon: Math.round((soon / tracked) * 100),
    percent_today: Math.round((todayCount / tracked) * 100),
    score: Math.round((fresh / tracked) * 100),
  };
}

// ── the composer ─────────────────────────────────────────────────────────
function shelfBySlug() {
  const map = new Map();

  for (const item of state.items) {
    const ingredient = byId.get(item.ingredient_id);
    if (!ingredient) continue;
    const status = freshnessOf(item);
    map.set(ingredient.slug, { ingredient, urgency: status ? status.urgency : 0 });
  }

  return map;
}

function pickSlot(slot, shelf, used) {
  const candidates = fixture.composer.slots[slot] || [];
  let best = null;
  let bestScore = null;

  candidates.forEach((slug, rank) => {
    if (used.includes(slug) || !shelf.has(slug)) return;

    const candidate = shelf.get(slug);
    const score = [candidate.urgency, -rank];

    if (
      bestScore === null ||
      score[0] > bestScore[0] ||
      (score[0] === bestScore[0] && score[1] > bestScore[1])
    ) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

function interpolate(text, filled, lower = true) {
  let out = text;
  for (const [slot, pick] of Object.entries(filled)) {
    const name = lower ? pick.ingredient.name.toLowerCase() : pick.ingredient.name;
    out = out.split(`{${slot}}`).join(name);
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Compose up to `limit` dishes, exactly as RecipeComposer does on the server. */
function compose(limit = 2) {
  const shelf = shelfBySlug();
  if (shelf.size === 0) return [];

  const candidates = [];

  for (const template of fixture.composer.templates) {
    const filled = {};
    const used = [];
    let ok = true;

    for (const slot of [...template.needs, ...template.wants]) {
      const pick = pickSlot(slot, shelf, used);

      if (!pick) {
        if (template.needs.includes(slot)) {
          ok = false;
          break;
        }
        continue;
      }

      filled[slot] = pick;
      used.push(pick.ingredient.slug);
    }

    if (!ok) continue;

    const rescues = Object.values(filled).filter((p) => p.urgency > 0).length;
    candidates.push({ template, filled, rescues });
  }

  candidates.sort(
    (a, b) =>
      b.rescues - a.rescues || Object.keys(b.filled).length - Object.keys(a.filled).length
  );

  return candidates.slice(0, limit).map((candidate) => {
    const { template, filled } = candidate;
    const title = interpolate(template.title, filled, false);

    const existing = state.composed.find((r) => r.title === title);
    if (existing) return existing;

    const ingredients = Object.values(filled).map((pick) => ({
      id: pick.ingredient.id,
      name: pick.ingredient.name,
      name_bn: pick.ingredient.name_bn,
      optional: false,
    }));

    const written = Object.entries(filled).map(([slot, pick]) => {
      const amount = fixture.composer.amounts[slot] || "";
      const suffix = slot === "herb" ? ", chopped" : "";
      return `${amount} ${pick.ingredient.name.toLowerCase()}`.trim() + suffix;
    });

    const steps = template.method
      .filter(([, needs]) => needs.every((slot) => slot in filled))
      .map(([text]) => interpolate(text, filled));

    const recipe = {
      // Negative ids so a composed dish can never collide with a seeded one.
      id: -(state.composed.length + 1),
      title,
      description: interpolate(template.description, filled),
      cuisine_country: template.country === "BD" ? "Bangladesh" : template.country,
      cuisine_region: "South Asia",
      difficulty: template.difficulty,
      total_minutes: template.prep + template.cook,
      servings: template.servings,
      image_path: null,
      generated: true,
      required: ingredients.map((i) => i.id),
      ingredients,
      written,
      steps,
    };

    state.composed.push(recipe);
    return recipe;
  });
}

// ── ranking ──────────────────────────────────────────────────────────────
function urgencyScore(rescues) {
  if (rescues.length === 0) return 0;

  let weight = 1;
  let total = 0;
  let maximum = 0;

  for (const rescue of rescues) {
    total += rescue.urgency * weight;
    maximum += weight;
    weight /= 2;
  }

  return Math.round((total / Math.max(maximum, 0.0001)) * 100);
}

function score(recipe, owned, statusByIngredient, localBias) {
  const required = recipe.required;
  const have = required.filter((id) => owned.has(id));
  const missing = required.filter((id) => !owned.has(id));
  const matchPercent = required.length > 0 ? Math.round((have.length / required.length) * 100) : 0;

  const rescues = have
    .map((id) => statusByIngredient.get(id))
    .filter((row) => row && row.urgency > 0)
    .sort((a, b) => b.urgency - a.urgency);

  const urgency = urgencyScore(rescues);
  const bonus = localBias
    ? LOCAL_BONUS[recipe.cuisine_country] ?? REGION_BONUS[recipe.cuisine_region] ?? 0
    : 0;

  return {
    recipe: {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      cuisine_country: recipe.cuisine_country,
      cuisine_region: recipe.cuisine_region,
      difficulty: recipe.difficulty,
      total_minutes: recipe.total_minutes,
      servings: recipe.servings,
      image_path: recipe.image_path,
      generated: !!recipe.generated,
    },
    match_percent: matchPercent,
    have_count: have.length,
    required_count: required.length,
    missing: missing.map((id) => {
      const i = byId.get(id);
      return { id, name: i?.name, name_bn: i?.name_bn, aisle: i?.aisle };
    }),
    rescues,
    urgency_score: urgency,
    local_bonus: bonus,
    priority_score: Math.round(WEIGHT_MATCH * matchPercent + WEIGHT_URGENCY * urgency + bonus),
  };
}

function suggestions() {
  const owned = new Set(state.items.map((i) => i.ingredient_id));
  if (owned.size === 0) return [];

  const statusByIngredient = new Map(statuses().map((s) => [s.ingredient_id, s]));
  const composed = compose();

  return [...fixture.recipes, ...composed]
    .map((r) => score(r, owned, statusByIngredient, true))
    .filter(
      (row) =>
        row.required_count > 0 &&
        row.have_count > 0 &&
        row.match_percent >= MIN_MATCH_PERCENT &&
        row.missing.length <= 4
    )
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 12);
}

function missingLinks(take = 3) {
  const owned = new Set(state.items.map((i) => i.ingredient_id));
  if (owned.size === 0) return [];

  const cheap = ["produce", "pantry", "dairy", "bakery"];
  const blocked = new Map();

  for (const recipe of fixture.recipes) {
    const missing = recipe.required.filter((id) => !owned.has(id));
    if (missing.length === 0 || missing.length > 2) continue;

    for (const id of missing) {
      const ingredient = byId.get(id);
      if (!ingredient) continue;

      if (!blocked.has(id)) {
        blocked.set(id, {
          ingredient_id: id,
          name: ingredient.name,
          name_bn: ingredient.name_bn,
          aisle: ingredient.aisle,
          unlocks: 0,
          recipes: [],
        });
      }

      const row = blocked.get(id);
      row.unlocks++;
      if (row.recipes.length < 3) row.recipes.push(recipe.title);
    }
  }

  return [...blocked.values()]
    .sort(
      (a, b) =>
        b.unlocks - a.unlocks ||
        (cheap.includes(b.aisle) ? 1 : 0) - (cheap.includes(a.aisle) ? 1 : 0)
    )
    .slice(0, take);
}

// ── waste ────────────────────────────────────────────────────────────────
function wasteSummary() {
  const rescued = state.waste.filter((w) => w.kind === "rescued");
  const lost = state.waste.filter((w) => w.kind === "lost");
  const handled = rescued.length + lost.length;

  return {
    rescued: rescued.length,
    lost: lost.length,
    save_rate: handled === 0 ? null : Math.round((rescued.length / handled) * 100),
    recent: rescued
      .slice(-5)
      .reverse()
      .map((w) => ({ name: w.name, days_left: w.days_left })),
  };
}

function leaderboard() {
  const yours = state.waste.filter((w) => w.kind === "rescued").length;

  return [...HOUSEHOLDS.map((h) => ({ ...h, is_you: false })), {
    name: "You, right now",
    rescued: yours,
    is_you: true,
  }]
    .sort((a, b) => b.rescued - a.rescued)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

// ── the payload every screen reads ───────────────────────────────────────
function fridgeState() {
  const statusByIngredient = new Map(statuses().map((s) => [s.ingredient_id, s]));

  const items = state.items
    .map((item) => {
      const ingredient = byId.get(item.ingredient_id);
      return {
        id: item.id,
        ingredient_id: item.ingredient_id,
        name: ingredient.name,
        name_bn: ingredient.name_bn,
        aisle: ingredient.aisle,
        is_staple: ingredient.is_staple,
        source: item.source,
        confidence: item.confidence ?? null,
        expires_on: item.expires_on,
        freshness: statusByIngredient.get(item.ingredient_id) ?? null,
      };
    })
    .sort(
      (a, b) =>
        (a.freshness?.days_left ?? 9999) - (b.freshness?.days_left ?? 9999) ||
        a.name.localeCompare(b.name)
    );

  return {
    session: { day_offset: state.dayOffset, today: iso(today()) },
    items,
    at_risk: statuses()
      .filter((s) => s.tier !== "fresh")
      .sort((a, b) => a.days_left - b.days_left),
    health: health(),
    waste: wasteSummary(),
    leaderboard: leaderboard(),
    suggestions: suggestions(),
    missing_links: missingLinks(),
  };
}

function findRecipe(id) {
  return (
    fixture.recipes.find((r) => r.id === Number(id)) ||
    state.composed.find((r) => r.id === Number(id)) ||
    null
  );
}

// ── the routes ───────────────────────────────────────────────────────────
export const PREVIEW_NOTE =
  "Online preview. The detector's answer for the sample photo is a recording of a real run; " +
  "the live model runs on the laptop.";

/**
 * Dispatch a request the way the server would. Returns the same shapes
 * `api.js` expects, so nothing above this file knows it is here.
 */
export async function previewRequest(path, { method = "GET", body } = {}) {
  if (!state) stock();

  // A touch of latency, because a UI that never waits hides its own loading
  // states and they are half of what makes an app feel built.
  await new Promise((resolve) => setTimeout(resolve, 90));

  const [route, query] = path.split("?");
  const params = new URLSearchParams(query || "");

  if (route === "/fridge" && method === "GET") return fridgeState();

  if (route === "/fridge/items" && method === "POST") {
    const ingredient = lookup(body?.name);
    if (!ingredient) {
      const error = new Error(`"${body?.name}" is not in the ingredient list.`);
      error.status = 422;
      throw error;
    }
    addItem(ingredient, ingredient.shelf_life_days, "manual", ingredient.shelf_life_days !== null);
    return { ...fridgeState(), message: `${ingredient.name} added.` };
  }

  const itemMatch = route.match(/^\/fridge\/items\/(\d+)$/);

  if (itemMatch && method === "PATCH") {
    const item = state.items.find((i) => i.id === Number(itemMatch[1]));
    if (item) {
      item.expires_on = body?.expires_on ?? null;
      item.expiry_estimated = false;
    }
    return fridgeState();
  }

  if (itemMatch && method === "DELETE") {
    const index = state.items.findIndex((i) => i.id === Number(itemMatch[1]));
    if (index >= 0) {
      const [removed] = state.items.splice(index, 1);
      if (params.get("binned")) {
        const ingredient = byId.get(removed.ingredient_id);
        state.waste.push({ kind: "lost", name: ingredient.name, days_left: null });
        return { ...fridgeState(), message: `${ingredient.name} binned.` };
      }
    }
    return fridgeState();
  }

  if (route === "/fridge/fast-forward" && method === "POST") {
    const before = new Map(statuses().map((s) => [s.ingredient_id, s.tier]));
    state.dayOffset = Math.min(30, state.dayOffset + (body?.days ?? 1));

    const alerts = statuses().filter(
      (s) => s.tier === "today" && before.get(s.ingredient_id) !== "today"
    );

    return { ...fridgeState(), alerts };
  }

  if (route === "/fridge/reset" && method === "POST") {
    stock();
    return { ...fridgeState(), message: "Demo fridge reset." };
  }

  if (route === "/fridge/scan/status") {
    return {
      online: true,
      preview: true,
      detector: {
        ready: true,
        backend: "recorded",
        weights: "yolov8s-worldv2.pt",
        class_count: 49,
        error: null,
      },
    };
  }

  if (route === "/fridge/scan" && method === "POST") {
    return { ...capturedScan, meta: { ...capturedScan.meta, preview: true } };
  }

  if (route === "/fridge/scan/confirm" && method === "POST") {
    let added = 0;
    let dated = 0;

    for (const row of body?.items ?? []) {
      const ingredient = lookup(row.name);
      if (!ingredient) continue;

      const known = state.items.some((i) => i.ingredient_id === ingredient.id);
      const item = addItem(
        ingredient,
        ingredient.shelf_life_days,
        "scan",
        ingredient.shelf_life_days !== null
      );
      item.confidence = row.confidence ?? null;

      if (!known) added++;
      if (ingredient.shelf_life_days !== null) dated++;
    }

    return {
      ...fridgeState(),
      added,
      dated,
      message: `${body?.items?.length ?? 0} ingredients confirmed (${added} new).`,
    };
  }

  const recipeMatch = route.match(/^\/recipes\/(-?\d+)$/);

  if (recipeMatch && method === "GET") {
    const recipe = findRecipe(recipeMatch[1]);
    if (!recipe) {
      const error = new Error("Recipe not found.");
      error.status = 404;
      throw error;
    }

    const owned = new Set(state.items.map((i) => i.ingredient_id));
    const statusByIngredient = new Map(statuses().map((s) => [s.ingredient_id, s]));

    return {
      data: {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        cuisine_country: recipe.cuisine_country,
        cuisine_region: recipe.cuisine_region,
        difficulty: recipe.difficulty,
        total_minutes: recipe.total_minutes,
        servings: recipe.servings,
        image_path: recipe.image_path,
        generated: !!recipe.generated,
        ingredients: recipe.ingredients.map((i) => ({
          ...i,
          have: owned.has(i.id),
          freshness: statusByIngredient.get(i.id) ?? null,
        })),
        steps: recipe.steps.map((text, index) => ({
          index,
          number: index + 1,
          text,
          timer_seconds: null,
          speech: text,
        })),
        consumes: recipe.required
          .filter((id) => owned.has(id))
          .map((id) => {
            const item = state.items.find((i) => i.ingredient_id === id);
            return {
              pantry_item_id: item?.id,
              ingredient_id: id,
              name: byId.get(id)?.name,
              freshness: statusByIngredient.get(id) ?? null,
            };
          }),
      },
    };
  }

  const cookedMatch = route.match(/^\/recipes\/(-?\d+)\/cooked$/);

  if (cookedMatch && method === "POST") {
    const recipe = findRecipe(cookedMatch[1]);
    if (!recipe) {
      const error = new Error("Recipe not found.");
      error.status = 404;
      throw error;
    }

    const statusByIngredient = new Map(statuses().map((s) => [s.ingredient_id, s]));
    const removed = [];

    for (const id of recipe.required) {
      const index = state.items.findIndex((i) => i.ingredient_id === id);
      if (index < 0) continue;

      const ingredient = byId.get(id);
      // The cupboard stays. Salt, rice and oil are not used up by cooking once.
      if (ingredient.shelf_life_days === null) continue;

      const status = statusByIngredient.get(id);
      const [item] = state.items.splice(index, 1);
      removed.push({
        name: ingredient.name,
        expires_on: item.expires_on,
        expiry_estimated: item.expiry_estimated,
        source: item.source,
      });

      if (status && status.urgency > 0) {
        state.waste.push({
          kind: "rescued",
          name: ingredient.name,
          days_left: status.days_left,
        });
      }
    }

    return {
      ...fridgeState(),
      removed,
      message: `${removed.length} ingredients taken out of your fridge.`,
    };
  }

  if (route === "/fridge/restore" && method === "POST") {
    for (const row of body?.items ?? []) {
      const ingredient = lookup(row.name);
      if (!ingredient) continue;
      const item = addItem(ingredient, null, row.source || "manual", !!row.expiry_estimated);
      item.expires_on = row.expires_on ?? null;
    }

    // Undo takes the rescue back off the counter too.
    state.waste = state.waste.slice(0, Math.max(0, state.waste.length - (body?.items?.length ?? 0)));

    return { ...fridgeState(), message: "Put back." };
  }

  if (route === "/ingredients") {
    const search = (params.get("search") || "").toLowerCase();
    const limit = Number(params.get("limit") || 8);

    return {
      data: fixture.ingredients
        .filter((i) => !search || i.name.toLowerCase().includes(search))
        .slice(0, limit)
        .map((i) => ({ id: i.id, name: i.name, name_bn: i.name_bn, aisle: i.aisle })),
    };
  }

  const error = new Error(`No preview route for ${method} ${route}`);
  error.status = 404;
  throw error;
}

/** Artwork is bundled rather than served, so the paths differ. */
export function previewImage(path) {
  return path ? `/preview-art/${path}` : null;
}
