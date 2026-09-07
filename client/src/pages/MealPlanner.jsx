import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { useToast } from "../components/useToast";

const SLOT_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/**
 * Weekly Meal Planner — drop recipes into a day/slot grid, see the day's
 * calorie total, and hand the whole week to the shopping list.
 */
export default function MealPlanner({ user }) {
  const [weekStart, setWeekStart] = useState(null);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [picking, setPicking] = useState(null); // { date, slot }
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const load = useCallback(
    async (start) => {
      setLoading(true);
      try {
        const response = await api.mealPlan(start ?? undefined);
        setEntries(response.data);
        setMeta(response.meta);
        setWeekStart(response.meta.week_start);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const byCell = useMemo(() => {
    const map = {};
    entries.forEach((entry) => {
      map[`${entry.plan_date.slice(0, 10)}|${entry.meal_slot}`] = entry;
    });
    return map;
  }, [entries]);

  function shiftWeek(days) {
    if (!weekStart) return;
    const date = new Date(`${weekStart}T00:00:00`);
    date.setDate(date.getDate() + days);
    load(date.toISOString().slice(0, 10));
  }

  async function addEntry(recipeId) {
    if (!picking) return;
    try {
      await api.addMealPlanEntry({
        recipe_id: recipeId,
        plan_date: picking.date,
        meal_slot: picking.slot,
      });
      setPicking(null);
      showToast("Added to your meal plan.");
      load(weekStart);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function removeEntry(entry) {
    try {
      await api.removeMealPlanEntry(entry.id);
      load(weekStart);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function buildShoppingList() {
    try {
      const response = await api.generateShoppingList({ week_start: weekStart });
      showToast(response.message ?? "Shopping list generated.");
      navigate("/shopping-list");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  if (!user) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--muted)]">
        Sign in to plan your week.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--brand)]">
            Meal Planner
          </span>
          <h1 className="mt-2 mb-1 font-[var(--font-display)] text-3xl font-black text-[var(--text)]">
            Your week
          </h1>
          {meta && (
            <p className="m-0 text-sm text-[var(--muted)]">
              {formatDay(meta.week_start)} – {formatDay(meta.week_end)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2 text-sm"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2 text-sm"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2 text-sm"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={buildShoppingList}
            className="rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white"
          >
            Build shopping list
          </button>
        </div>
      </header>

      {loading && <p className="text-sm text-[var(--muted)]">Loading your plan…</p>}

      {meta && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="w-24" />
                {meta.days.map((date) => (
                  <th key={date} className="text-left align-bottom">
                    <div className="text-sm font-bold text-[var(--text)]">{weekdayName(date)}</div>
                    <div className="text-xs font-normal text-[var(--muted)]">{formatDay(date)}</div>
                    {meta.nutrition_by_day?.[date]?.calories > 0 && (
                      <div className="mt-1 text-xs font-semibold text-[var(--accent)]">
                        {meta.nutrition_by_day[date].calories} kcal
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meta.slots.map((slot) => (
                <tr key={slot}>
                  <th className="pr-2 text-right align-top text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {SLOT_LABELS[slot] ?? slot}
                  </th>
                  {meta.days.map((date) => {
                    const entry = byCell[`${date}|${slot}`];
                    return (
                      <td key={`${date}-${slot}`} className="align-top">
                        {entry ? (
                          <div className="group relative h-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-strong)] p-3">
                            <Link
                              to={`/recipes/${entry.recipe.id}/cook`}
                              className="block text-sm font-semibold leading-snug text-[var(--text)] hover:text-[var(--brand)]"
                            >
                              {entry.recipe.title}
                            </Link>
                            <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                              {entry.servings} servings
                              {entry.recipe.nutrition?.calories
                                ? ` · ${entry.recipe.nutrition.calories} kcal`
                                : ""}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeEntry(entry)}
                              aria-label={`Remove ${entry.recipe.title}`}
                              className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[rgba(20,24,27,0.08)] text-xs opacity-0 transition group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPicking({ date, slot })}
                            className="h-full min-h-[76px] w-full rounded-[var(--r-sm)] border border-dashed border-[var(--border-strong)] text-sm text-[var(--muted-light)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                          >
                            + Add
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picking && (
        <RecipePickerModal
          slot={`${SLOT_LABELS[picking.slot]} · ${formatDay(picking.date)}`}
          onClose={() => setPicking(null)}
          onPick={addEntry}
        />
      )}
    </div>
  );
}

function RecipePickerModal({ slot, onClose, onPick }) {
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.recipes(search ? { search } : {});
        if (!cancelled) setRecipes(response.data);
      } catch (error) {
        if (!cancelled) showToast(error.message, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, showToast]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(28,16,8,0.45)] p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-[var(--r-lg)] bg-white p-6 shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="mb-4">
          <h2 className="m-0 text-lg font-bold text-[var(--text)]">Add a recipe</h2>
          <p className="m-0 text-sm text-[var(--muted)]">{slot}</p>
        </header>

        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search recipes…"
          className="mb-4 w-full rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
        />

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onPick(recipe.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--r-sm)] px-3 py-2.5 text-left text-sm hover:bg-[var(--brand-glow)]"
                >
                  <span className="font-semibold text-[var(--text)]">{recipe.title}</span>
                  <small className="shrink-0 text-[var(--muted-light)]">
                    {recipe.cuisine_country ?? ""}
                    {recipe.nutrition?.calories ? ` · ${recipe.nutrition.calories} kcal` : ""}
                  </small>
                </button>
              </li>
            ))}
            {recipes.length === 0 && (
              <li className="py-4 text-center text-sm text-[var(--muted)]">No recipes matched.</li>
            )}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function weekdayName(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}
