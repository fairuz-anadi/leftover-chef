/**
 * The three tiers, in one place.
 *
 * 🟢 Fresh · 🟡 Use soon · 🔴 Use today. Every badge, bar and dial reads its
 * colour from here, so there is a single definition of "at risk" on screen
 * rather than four that drift apart.
 *
 * Kept apart from the components that use it so the module exports components
 * only — otherwise fast refresh stops working on the whole file.
 */

export const TIERS = {
  fresh: { label: "Fresh", bn: "\u09a4\u09be\u099c\u09be", colour: "var(--fresh)", soft: "var(--fresh-soft)" },
  soon: { label: "Use soon", bn: "\u09b6\u09c0\u0998\u09cd\u09b0\u0987", colour: "var(--soon)", soft: "var(--soon-soft)" },
  today: { label: "Use today", bn: "\u0986\u099c\u0987", colour: "var(--today)", soft: "var(--today-soft)" },
};

export const tierOf = (freshness) => TIERS[freshness?.tier] ?? null;

export function calculateIngredientsHealth(items) {
  let fresh = 0;
  let soon = 0;
  let today = 0;
  let undated = 0;

  for (const item of items) {
    let tier = item.freshness?.tier;

    if (tier === undefined) {
      const days = item.shelf_life_days;
      if (days === null || days === undefined) {
        tier = "undated";
      } else if (days <= 0) {
        tier = "today";
      } else if (days <= 3) {
        tier = "soon";
      } else {
        tier = "fresh";
      }
    }

    if (tier === "today") {
      today++;
    } else if (tier === "soon") {
      soon++;
    } else if (tier === "fresh") {
      fresh++;
    } else {
      undated++;
    }
  }

  const total = items.length;
  const tracked = Math.max(1, fresh + soon + today);

  return {
    total,
    fresh,
    soon,
    today,
    at_risk: soon + today,
    undated,
    score: total === 0 ? 100 : Math.round((fresh / tracked) * 100),
    percent_fresh: Math.round((fresh / tracked) * 100),
    percent_soon: Math.round((soon / tracked) * 100),
    percent_today: Math.round((today / tracked) * 100),
  };
}
