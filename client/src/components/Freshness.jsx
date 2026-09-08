import { TIERS, tierOf } from "../freshness";

/**
 * The three tiers, in one place.
 *
 * 🟢 Fresh · 🟡 Use soon · 🔴 Use today. Every badge, bar and dial in the app
 * reads its colour from here, so there is a single definition of "at risk" on
 * the screen rather than four that drift apart.
 */

/** The coloured pill: dot, tier name, and how long is left. */
export function FreshnessBadge({ freshness }) {
  const tier = tierOf(freshness);

  if (!tier) {
    return (
      <span className="rounded-full border border-dashed border-[var(--line)] px-2 py-0.5 font-mono text-[10px] text-[var(--faint)]">
        keeps
      </span>
    );
  }

  return (
    <span
      style={{ backgroundColor: tier.soft, color: tier.colour }}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap"
    >
      <span
        style={{ backgroundColor: tier.colour }}
        className="h-1.5 w-1.5 shrink-0 rounded-full"
      />
      {/* The dot already says which tier this is, so the words only need to
          carry the time. Printing both gave "Use today · Use today". */}
      {freshness.label}
    </span>
  );
}

/**
 * The Freshness Race bar.
 *
 * Width is `life_remaining` straight off the server, so pressing fast-forward
 * animates every bar on screen at once. That shared movement is the whole
 * point of the moment — a static number changing would not read from two
 * metres away.
 */
export function FreshnessBar({ freshness }) {
  const tier = tierOf(freshness);
  const pct = tier ? Math.max(freshness.life_remaining * 100, freshness.tier === "today" ? 4 : 6) : 0;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--track)]">
      <div
        className="lc-bar h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: tier?.colour ?? "var(--line)" }}
      />
    </div>
  );
}
