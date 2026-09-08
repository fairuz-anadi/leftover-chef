/**
 * The food-waste-saved counter, and the households it competes with.
 *
 * This is the project's social-impact claim expressed as a number, so it is
 * worth being precise about what it counts: ingredients used while they were
 * still good. The lost count is shown next to it deliberately — a counter that
 * only goes up is a decoration, not a measurement.
 *
 * The rival households are openly labelled as samples. They exist because a
 * number needs a scale to be read against, the way a step count means nothing
 * until it sits beside a goal.
 */
export default function WastePanel({ waste, leaderboard }) {
  // Re-keying on the count restarts the pop animation, so the number visibly
  // reacts the moment a rescue lands rather than silently ticking over.
  return (
    <div>
      <div className="flex items-end gap-4">
        <div>
          <div
            key={waste.rescued}
            className="lc-pop font-mono text-5xl font-bold leading-none text-[var(--fresh)]"
          >
            {waste.rescued}
          </div>
          <div className="mt-1.5 text-xs text-[var(--dim)]">
            ingredient{waste.rescued === 1 ? "" : "s"} saved from the bin
          </div>
        </div>

        <div className="ml-auto text-right">
          <div className="font-mono text-lg font-semibold text-[var(--today)]">{waste.lost}</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--faint)]">binned</div>
        </div>

        {waste.save_rate !== null && (
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-[var(--text)]">{waste.save_rate}%</div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--faint)]">save rate</div>
          </div>
        )}
      </div>

      {waste.recent.length > 0 && (
        <p className="mt-3 mb-0 text-xs leading-relaxed text-[var(--faint)]">
          Lately:{" "}
          {waste.recent
            .map((item) =>
              item.days_left === null || item.days_left === undefined
                ? item.name
                : `${item.name} (${item.days_left <= 0 ? "on the day" : `${item.days_left}d spare`})`
            )
            .join(", ")}
        </p>
      )}

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <p className="m-0 mb-2.5 text-[10px] uppercase tracking-widest text-[var(--faint)]">
          Sample households
        </p>
        <ol className="lc-stagger m-0 grid list-none gap-1 p-0">
          {leaderboard.map((row) => (
            <li
              key={row.name}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm ${
                row.is_you ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--dim)]"
              }`}
            >
              <span className="w-4 font-mono text-xs text-[var(--faint)]">{row.position}</span>
              <span className="flex-1 truncate">{row.name}</span>
              <span className="font-mono font-semibold">{row.rescued}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
