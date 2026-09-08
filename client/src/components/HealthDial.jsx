import { TIERS } from "../freshness";

/**
 * Fridge health, as one dial.
 *
 * A stacked ring rather than a bar chart: the question it answers is "how much
 * of what I own is still good", which is a proportion, and a ring reads as a
 * proportion from across a room. The number in the middle is the fresh share,
 * so watching it drop while pressing fast-forward is the whole story in one
 * shape.
 *
 * Counts items, not weight or money — that is the only quantity the app
 * actually knows, and inventing the others would be theatre.
 */
export default function HealthDial({ health }) {
  const size = 168;
  const stroke = 14;
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
    <div className="flex items-center gap-5">
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
            <div className="font-mono text-3xl font-bold leading-none text-[var(--text)]">
              {health.score}%
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--faint)]">fresh</div>
          </div>
        </div>
      </div>

      <dl className="m-0 grid flex-1 gap-2.5">
        <Row tier="fresh" count={health.fresh} />
        <Row tier="soon" count={health.soon} />
        <Row tier="today" count={health.today} />
        {health.undated > 0 && (
          <div className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-[var(--line)]" />
            <dt className="flex-1 text-[var(--faint)]">Cupboard staples</dt>
            <dd className="m-0 font-mono text-[var(--faint)]">{health.undated}</dd>
          </div>
        )}
      </dl>
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
