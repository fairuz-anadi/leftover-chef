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
  fresh: { label: "Fresh", colour: "#3ddc84", soft: "rgba(61,220,132,0.14)" },
  soon: { label: "Use soon", colour: "#ffc043", soft: "rgba(255,192,67,0.15)" },
  today: { label: "Use today", colour: "#ff5d5d", soft: "rgba(255,93,93,0.16)" },
};

export const tierOf = (freshness) => TIERS[freshness?.tier] ?? null;
