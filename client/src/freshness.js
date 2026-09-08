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
