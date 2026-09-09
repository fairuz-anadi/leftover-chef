import { TIERS } from "../freshness";

/**
 * Ingredients health, as one dial.
 *
 * A stacked ring rather than a bar chart: the question it answers is "how much
 * of what is shown is still good", which is a proportion, and a ring reads as a
 * proportion from across a room. The number in the middle is the fresh share.
 *
 * When a photo is uploaded, this computes and reflects the ingredients health
 * directly from the picture.
 */
export default function HealthDial({ health, isFromPhoto = false, photoIngredients = [] }) {
  const size = 152;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const tracked = Math.max(1, health.fresh + health.soon + health.today);
  const segments = [
    { key: "fresh", value: health.fresh },
    { key: "soon", value: health.soon },
    { key: "today", value: health.today },
  ].filter((segment) => segment.value > 0);

  let offset = 0;

  return (
    <div>
      {/* Context badge */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isFromPhoto
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-[var(--raised)] text-[var(--dim)]"
          }`}
        >
          {isFromPhoto ? "📷 From uploaded photo" : "All ingredients"}
        </span>
        <span className="font-mono text-[11px] text-[var(--faint)]">
          {health.total} {health.total === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--track)"
              strokeWidth={stroke}
            />
            {segments.map((segment) => {
              const length = (segment.value / tracked) * circumference;
              const dash = `${length} ${circumference - length}`;
              const element = (
                <circle
                  key={segment.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={TIERS[segment.key].colour}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              );
              offset += length;
              return element;
            })}
          </svg>

          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-mono text-2xl font-bold leading-none text-[var(--text)]">
                {health.score}%
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-widest text-[var(--faint)]">
                fresh
              </div>
            </div>
          </div>
        </div>

        <dl className="m-0 grid flex-1 gap-2">
          <Row tier="fresh" count={health.fresh} />
          <Row tier="soon" count={health.soon} />
          <Row tier="today" count={health.today} />
          {health.undated > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-[var(--line)]" />
              <dt className="flex-1 text-[var(--faint)]">Cupboard staples</dt>
              <dd className="m-0 font-mono text-[var(--faint)]">{health.undated}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Itemised photo ingredient pills */}
      {isFromPhoto && photoIngredients.length > 0 ? (
        <div className="mt-3.5 border-t border-[var(--line)] pt-3">
          <p className="m-0 mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--faint)]">
            Detected from photo ({photoIngredients.length})
          </p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {photoIngredients.map((item) => {
              const days = item.shelf_life_days;
              const tier =
                days === null || days === undefined
                  ? "undated"
                  : days <= 0
                    ? "today"
                    : days <= 3
                      ? "soon"
                      : "fresh";
              const dotColor = tier === "undated" ? "var(--faint)" : TIERS[tier]?.colour;
              const label =
                days === null || days === undefined ? "staple" : days <= 0 ? "today" : `${days}d left`;

              return (
                <span
                  key={item.slug || item.name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--raised)] px-2.5 py-0.5 text-xs text-[var(--text)]"
                >
                  <span
                    style={{ backgroundColor: dotColor }}
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                  />
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono text-[10px] text-[var(--dim)]">{label}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="m-0 mt-3 text-[11px] text-[var(--faint)]">
          Upload or capture a photo to calculate ingredients health from your picture.
        </p>
      )}
    </div>
  );
}

function Row({ tier, count }) {
  const { label, bn, colour } = TIERS[tier];

  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span style={{ backgroundColor: colour }} className="h-2.5 w-2.5 shrink-0 rounded-full" />
      <dt className="flex-1 text-[var(--dim)]">
        {label} <span className="text-xs text-[var(--faint)]">{bn}</span>
      </dt>
      <dd className="m-0 font-mono font-semibold text-[var(--text)]">{count}</dd>
    </div>
  );
}
