import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import FridgeScan from "../components/FridgeScan";
import IngredientPicker from "../components/IngredientPicker";
import NutritionPanel from "../components/NutritionPanel";
import { useToast } from "../components/useToast";

const QUICK_ADD = [
  "Onion", "Garlic", "Tomato", "Egg", "Rice", "Pasta", "Potato",
  "Chicken Breast", "Olive Oil", "Butter", "Milk", "Lentils", "Cheddar Cheese",
];

/**
 * "What's in my fridge" — the scan-and-search screen.
 *
 * Two ways in: photograph the shelf, or type ingredients. Both land on the
 * same confirmed chip list, and the same ranked results. Signed-in cooks get a
 * saved fridge with use-by dates; signed-out visitors get a one-off search, so
 * a judge can try the camera without making an account first.
 */
export default function PantryPage({ user, onRequireAuth }) {
  const [pantry, setPantry] = useState([]);
  const [guestIngredients, setGuestIngredients] = useState([]);
  const [matches, setMatches] = useState([]);
  const [meta, setMeta] = useState(null);
  const [searching, setSearching] = useState(false);
  // 10 on the slider means "don't filter on missing count at all".
  const [maxMissing, setMaxMissing] = useState(4);
  const [maxMinutes, setMaxMinutes] = useState("");
  const [skill, setSkill] = useState("");
  const [editingExpiry, setEditingExpiry] = useState(null);
  const { showToast } = useToast();

  const ingredientNames = useMemo(
    () => (user ? pantry.map((item) => item.ingredient?.name).filter(Boolean) : guestIngredients),
    [user, pantry, guestIngredients]
  );

  const quickAdd = useMemo(() => {
    const owned = new Set(ingredientNames.map((name) => name.toLowerCase()));
    return QUICK_ADD.filter((name) => !owned.has(name.toLowerCase()));
  }, [ingredientNames]);

  // Signed in, the fridge itself carries the dates, so the shelf is right the
  // moment the page loads rather than after the first search comes back.
  // Signed out there is no saved fridge to expire, and the list stays empty.
  const expiringSoon = useMemo(
    () =>
      pantry
        .map((item) => item.expiry)
        .filter((expiry) => expiry && expiry.state !== "fresh")
        .sort((a, b) => a.days_left - b.days_left),
    [pantry]
  );

  const loadPantry = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.pantry();
      setPantry(response.data);
    } catch (error) {
      showToast(error.message, "error");
    }
  }, [user, showToast]);

  useEffect(() => {
    loadPantry();
  }, [loadPantry]);

  const runSearch = useCallback(async () => {
    if (ingredientNames.length === 0) {
      setMatches([]);
      setMeta(null);
      return;
    }

    setSearching(true);
    try {
      const response = await api.searchByIngredients({
        ingredients: ingredientNames,
        max_missing: maxMissing >= 10 ? 50 : maxMissing,
        ...(maxMinutes ? { max_minutes: Number(maxMinutes) } : {}),
        ...(skill ? { skill } : {}),
      });
      setMatches(response.data);
      setMeta(response.meta);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSearching(false);
    }
  }, [ingredientNames, maxMissing, maxMinutes, skill, showToast]);

  useEffect(() => {
    const timer = setTimeout(runSearch, 250);
    return () => clearTimeout(timer);
  }, [runSearch]);

  async function addIngredient(name) {
    if (!user) {
      setGuestIngredients((current) =>
        current.some((item) => item.toLowerCase() === name.toLowerCase()) ? current : [...current, name]
      );
      return;
    }

    try {
      const response = await api.addPantryItem({ name });
      setPantry(response.data);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function removeIngredient(item) {
    if (!user) {
      setGuestIngredients((current) => current.filter((name) => name !== item));
      return;
    }

    try {
      const response = await api.removePantryItem(item.id);
      setPantry(response.data);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  /** Confirmed scan chips land here. Signed-out cooks keep them in the session only. */
  async function confirmScan(items) {
    if (!user) {
      setGuestIngredients((current) => {
        const owned = new Set(current.map((name) => name.toLowerCase()));
        return [...current, ...items.map((item) => item.name).filter((name) => !owned.has(name.toLowerCase()))];
      });
      showToast(`${items.length} ingredients added — sign in to keep them.`);
      return;
    }

    try {
      const response = await api.confirmScan(items);
      setPantry(response.data);
      showToast(response.message);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function saveExpiry(item, value) {
    setEditingExpiry(null);

    try {
      const response = await api.setPantryExpiry(item.id, value || null);
      setPantry(response.data);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const cookNow = matches.filter((match) => match.match_ratio === 1);
  const almost = matches.filter((match) => match.match_ratio < 1);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* ── Scan ───────────────────────────────────────────────── */}
      <FridgeScan onConfirm={confirmScan} alreadyInFridge={ingredientNames} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ── Fridge ─────────────────────────────────────────────── */}
      <aside className="grid h-fit gap-6">
        <section className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-sm)]">
          <h1 className="m-0 font-[var(--font-display)] text-2xl font-black text-[var(--text)]">
            What&apos;s in your fridge?
          </h1>
          <p className="mt-2 mb-5 text-sm leading-relaxed text-[var(--muted)]">
            {user
              ? "Your fridge is saved, so this list is waiting for you next time. Tap a date to tell us when something needs using."
              : "Add ingredients to search now — sign in to keep your fridge and track use-by dates."}
          </p>

          <IngredientPicker onAdd={addIngredient} exclude={ingredientNames} />

          <div className="mt-5 flex flex-wrap gap-2">
            {user
              ? pantry.map((item) => (
                  <PantryChip
                    key={item.id}
                    item={item}
                    editing={editingExpiry === item.id}
                    onEdit={() => setEditingExpiry(item.id)}
                    onCancelEdit={() => setEditingExpiry(null)}
                    onSaveExpiry={(value) => saveExpiry(item, value)}
                    onRemove={() => removeIngredient(item)}
                  />
                ))
              : guestIngredients.map((name) => (
                  <Chip key={name} label={name} onRemove={() => removeIngredient(name)} />
                ))}
          </div>

          {quickAdd.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wider text-[var(--muted-light)]">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {quickAdd.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addIngredient(name)}
                    className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-3 py-1.5 text-xs hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <hr className="my-6 border-0 border-t border-[var(--border)]" />

          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--text)]">
                Missing ingredients allowed: {maxMissing >= 10 ? "any" : maxMissing}
              </span>
              <input
                type="range"
                min="0"
                max="10"
                value={maxMissing}
                onChange={(event) => setMaxMissing(Number(event.target.value))}
                className="accent-[var(--brand)]"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--text)]">Ready within</span>
              <select
                value={maxMinutes}
                onChange={(event) => setMaxMinutes(event.target.value)}
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              >
                <option value="">Any time</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--text)]">Skill level</span>
              <select
                value={skill}
                onChange={(event) => setSkill(event.target.value)}
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              >
                <option value="">
                  {user ? `My profile (${user.skill_level ?? "beginner"})` : "Any level"}
                </option>
                <option value="beginner">Beginner only</option>
                <option value="intermediate">Up to intermediate</option>
                <option value="advanced">Anything</option>
              </select>
            </label>
          </div>

          {!user && (
            <button
              type="button"
              onClick={onRequireAuth}
              className="mt-6 w-full rounded-[var(--r-pill)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Sign in to save your fridge
            </button>
          )}
        </section>
      </aside>

      {/* ── Matches ────────────────────────────────────────────── */}
      <section>
        {expiringSoon.length > 0 && <UseItUpShelf items={expiringSoon} />}

        {ingredientNames.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="m-0 font-[var(--font-display)] text-2xl font-black text-[var(--text)]">
                {searching ? "Searching…" : `${matches.length} recipes you can make`}
              </h2>
              {meta && (
                <p className="m-0 text-sm text-[var(--muted)]">
                  {meta.cook_now} ready right now from {meta.ingredient_count} ingredients
                  {meta.rescues_waste > 0 && ` · ${meta.rescues_waste} use up something expiring`}
                </p>
              )}
            </header>

            {cookNow.length > 0 && (
              <MatchGroup
                title="Cook right now"
                caption="Everything on the list is already in your fridge."
                matches={cookNow}
              />
            )}

            {almost.length > 0 && (
              <MatchGroup
                title="Almost there"
                caption="A short shopping trip away."
                matches={almost}
              />
            )}

            {!searching && matches.length === 0 && (
              <p className="rounded-[var(--r-md)] border border-dashed border-[var(--border-strong)] p-8 text-center text-[var(--muted)]">
                Nothing matched. Try allowing more missing ingredients, or add a few staples to your fridge.
              </p>
            )}
          </>
        )}
      </section>
      </div>
    </div>
  );
}

/**
 * "3 items expire in 2 days — here's what to cook tonight."
 *
 * The point of the whole expiry half of the app, stated in one line at the top
 * of the results, before anyone has to read a score.
 */
function UseItUpShelf({ items }) {
  const soonest = items[0];
  const expired = items.filter((item) => item.days_left < 0);

  return (
    <div className="mb-8 rounded-[var(--r-lg)] border-2 border-[var(--accent)] bg-[var(--accent-glow)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 font-[var(--font-display)] text-lg font-black text-[var(--brand-deep)]">
          {expired.length > 0
            ? `${expired.length} item${expired.length === 1 ? "" : "s"} already past its date`
            : `${items.length} item${items.length === 1 ? "" : "s"} to use up ${describeDays(soonest.days_left)}`}
        </h2>
        <p className="m-0 text-xs text-[var(--brand-deep)] opacity-70">
          Recipes below are ranked to use these first
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.ingredient_id}
            className="inline-flex items-center gap-2 rounded-[var(--r-pill)] bg-white/80 px-3 py-1.5 text-sm font-semibold text-[var(--brand-deep)]"
          >
            {item.name}
            <span className="font-[var(--font-mono)] text-[11px] font-normal opacity-70">
              {describeDays(item.days_left)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function describeDays(days) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function expiryTone(state) {
  return {
    expired: "bg-[#fdeaea] text-[#9d174d]",
    today: "bg-[#fdeaea] text-[#9d174d]",
    soon: "bg-[var(--accent-glow)] text-[var(--accent)]",
    fresh: "bg-[var(--brand-glow)] text-[var(--brand-deep)]",
  }[state] ?? "bg-[var(--brand-glow)] text-[var(--brand-deep)]";
}

/** A fridge item with its use-by date inline — click the date to change it. */
function PantryChip({ item, editing, onEdit, onCancelEdit, onSaveExpiry, onRemove }) {
  const label = item.ingredient?.name;
  const expiry = item.expiry;

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--brand)] bg-white py-1 pl-3 pr-1.5 text-sm">
        {label}
        <input
          type="date"
          autoFocus
          defaultValue={item.expires_on ? String(item.expires_on).slice(0, 10) : ""}
          onBlur={(event) => onSaveExpiry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSaveExpiry(event.target.value);
            if (event.key === "Escape") onCancelEdit();
          }}
          className="rounded-[var(--r-sm)] border border-[var(--border-strong)] px-1.5 py-0.5 text-xs"
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--r-pill)] bg-[var(--brand-glow)] py-1.5 pl-3 pr-2 text-sm text-[var(--brand-deep)]">
      {label}

      {item.source === "scan" && (
        <span title="Added from a photo" aria-label="Added from a photo">
          📷
        </span>
      )}

      <button
        type="button"
        onClick={onEdit}
        title={expiry ? `Use by ${expiry.expires_on}` : "Set a use-by date"}
        className={`rounded-[var(--r-pill)] px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] ${
          expiry ? expiryTone(expiry.state) : "bg-white/60 text-[var(--muted)]"
        }`}
      >
        {expiry ? describeDays(expiry.days_left) : "+ date"}
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(10,58,36,0.15)] text-xs leading-none"
      >
        ×
      </button>
    </span>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--r-pill)] bg-[var(--brand-glow)] py-1.5 pl-3 pr-2 text-sm text-[var(--brand-deep)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(10,58,36,0.15)] text-xs leading-none"
      >
        ×
      </button>
    </span>
  );
}

function MatchGroup({ title, caption, matches }) {
  return (
    <div className="mb-10">
      <div className="mb-4">
        <h3 className="m-0 text-lg font-bold text-[var(--text)]">{title}</h3>
        <p className="m-0 text-sm text-[var(--muted)]">{caption}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.recipe.id} match={match} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match }) {
  const { recipe } = match;
  const rescues = match.rescues ?? [];

  return (
    <article className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="m-0 text-base font-bold text-[var(--text)]">{recipe.title}</h4>
          <p className="m-0 mt-1 text-xs text-[var(--muted)]">
            {recipe.cuisine_country ?? "Uncategorised"} · {recipe.difficulty}
            {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-[var(--r-pill)] px-2.5 py-1 text-xs font-bold ${
            match.match_percent === 100
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--gold-light)] text-[var(--brand-deep)]"
          }`}
        >
          {match.match_percent}%
        </span>
      </div>

      {rescues.length > 0 && (
        <p className="m-0 rounded-[var(--r-sm)] bg-[var(--accent-glow)] px-2.5 py-1.5 text-xs text-[var(--brand-deep)]">
          <strong>Uses up</strong>{" "}
          {rescues
            .slice(0, 3)
            .map((item) => `${item.name} (${describeDays(item.days_left)})`)
            .join(", ")}
          {rescues.length > 3 && ` +${rescues.length - 3} more`}
          <span className="ml-1 font-[var(--font-mono)] opacity-60">
            use-it-up {match.use_it_up_score}
          </span>
        </p>
      )}

      <NutritionPanel nutrition={recipe.nutrition} compact />

      {match.missing.length > 0 && (
        <p className="m-0 text-xs text-[var(--muted)]">
          <strong className="text-[var(--brand-deep)]">Missing:</strong>{" "}
          {match.missing.map((item) => item.name).join(", ")}
        </p>
      )}

      <div className="mt-auto flex gap-2 pt-1">
        <Link
          to={`/recipes/${recipe.id}/cook`}
          className="rounded-[var(--r-pill)] bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white"
        >
          Start cooking
        </Link>
        <Link
          to="/recipes"
          className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold"
        >
          Browse library
        </Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] p-16 text-center">
      <div className="text-5xl">📸</div>
      <h2 className="mt-4 mb-2 font-[var(--font-display)] text-2xl font-black text-[var(--text)]">
        Start with a photo
      </h2>
      <p className="m-0 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        Point a camera at your fridge and we&apos;ll pull out the ingredients, then rank every
        recipe by how much of it you can already make — soonest-to-spoil first. No shopping trip
        required.
      </p>
    </div>
  );
}
