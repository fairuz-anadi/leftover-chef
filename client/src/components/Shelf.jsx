import { useState } from "react";
import { FreshnessBadge, FreshnessBar } from "./Freshness";

/**
 * What is in the fridge, worst first.
 *
 * Sorted by how little time is left rather than alphabetically, because the
 * question a person actually has is "what do I need to deal with", and the
 * answer should be the first thing their eye lands on.
 */
export default function Shelf({ items, alertIds, onSetDate, onRemove, onBin }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#2a3438] p-8 text-center text-sm text-[#61706f]">
        Nothing in here yet. Scan a photo, or add something by hand.
      </p>
    );
  }

  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {items.map((item) => (
        <ShelfItem
          key={item.id}
          item={item}
          alarmed={alertIds.has(item.ingredient_id)}
          onSetDate={onSetDate}
          onRemove={onRemove}
          onBin={onBin}
        />
      ))}
    </ul>
  );
}

function ShelfItem({ item, alarmed, onSetDate, onRemove, onBin }) {
  const [editing, setEditing] = useState(false);
  const freshness = item.freshness;
  const overdue = freshness && freshness.days_left <= 0;

  return (
    <li
      className={`rounded-xl border border-[#2a3438] bg-[#141a1c] px-3.5 py-3 ${
        alarmed ? "lc-alarm" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm font-semibold text-[#eef3f3]">
          {item.name}
          {item.source === "scan" && (
            <span title="Added from a photo" className="ml-1.5 text-[11px]">
              📷
            </span>
          )}
        </span>

        {editing ? (
          <input
            type="date"
            autoFocus
            defaultValue={item.expires_on ?? ""}
            onBlur={(event) => {
              setEditing(false);
              onSetDate(item, event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setEditing(false);
                onSetDate(item, event.target.value);
              }
              if (event.key === "Escape") setEditing(false);
            }}
            className="rounded-md border border-[#2a3438] bg-[#0a0e0f] px-2 py-1 font-mono text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title={
              freshness
                ? `${freshness.estimated ? "Estimated — " : ""}use by ${freshness.expires_on}`
                : "Set a use-by date"
            }
          >
            <FreshnessBadge freshness={freshness} />
          </button>
        )}

        {overdue ? (
          <button
            type="button"
            onClick={() => onBin(item)}
            title="Threw it away — counts against the save rate"
            className="rounded-full border border-[#4a2a2a] px-2 py-0.5 font-mono text-[10px] text-[#ff5d5d] transition hover:bg-[rgba(255,93,93,0.12)]"
          >
            binned
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.name}`}
            className="grid h-5 w-5 place-items-center rounded-full text-xs text-[#61706f] transition hover:bg-[#242e31] hover:text-[#eef3f3]"
          >
            ×
          </button>
        )}
      </div>

      <div className="mt-2.5">
        <FreshnessBar freshness={freshness} />
      </div>
    </li>
  );
}
