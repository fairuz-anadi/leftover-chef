import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, recipeImage } from "./api";
import { FreshnessBadge } from "./components/Freshness";
import HealthDial from "./components/HealthDial";
import RecipeReveal from "./components/RecipeReveal";
import ScanPanel from "./components/ScanPanel";
import Shelf from "./components/Shelf";
import VoiceAsk from "./components/VoiceAsk";
import WastePanel from "./components/WastePanel";

/**
 * Leftover Chef — the whole app, one screen.
 *
 * The loop the proposal describes, in the order it happens:
 * detect → track → warn → cook → measure. There is nothing else to navigate
 * to, no account to make and no menu, because every extra click is a second
 * of a ninety-second demo spent on something that is not the point.
 */
export default function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [fridgePhoto, setFridgePhoto] = useState(null);
  const [adding, setAdding] = useState("");

  const toastTimer = useRef(null);

  const showToast = useCallback((message, kind = "ok") => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const load = useCallback(async () => {
    try {
      setState(await api.fridge());
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Ingredients that just crossed into red, so the shelf can pulse them.
  const alertIds = useMemo(
    () => new Set((alert?.items ?? []).map((row) => row.ingredient_id)),
    [alert]
  );

  async function act(work, { quiet = false } = {}) {
    setBusy(true);
    try {
      const response = await work();
      if (response) {
        setState((current) => ({ ...current, ...response }));
        if (!quiet && response.message) showToast(response.message);
      }
      return response;
    } catch (error) {
      showToast(error.message, "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /**
   * The time-skip. A day passes, every bar moves, and anything that turned red
   * arrives as the simulated push notification.
   */
  async function fastForward() {
    const response = await act(() => api.fastForward(1), { quiet: true });

    if (response?.alerts?.length) {
      setAlert({ items: response.alerts });
      window.setTimeout(() => setAlert(null), 9000);
    } else {
      showToast("A day passes. Nothing new is at risk.");
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[#61706f]">
        Opening the fridge…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center gap-3 text-center text-sm text-[#93a3a6]">
        <p>Couldn&apos;t reach the app.</p>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-[#2a3438] px-4 py-2 font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  const { items, health, waste, leaderboard, suggestions, missing_links: missing, at_risk: atRisk } = state;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 pb-20 pt-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1c2427] text-xl">
            🧊
          </span>
          <div>
            <h1 className="m-0 text-xl font-bold tracking-tight text-[#eef3f3]">Leftover Chef</h1>
            <p className="m-0 text-xs text-[#61706f]">
              Point your phone — it tells you what to eat before it&apos;s too late.
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#2a3438] px-3 py-1.5 font-mono text-xs text-[#93a3a6]">
            Day {state.session.day_offset + 1}
          </span>
          <button
            type="button"
            onClick={fastForward}
            disabled={busy}
            className="rounded-full bg-[#1c2427] px-4 py-1.5 text-sm font-semibold text-[#56d9c8] transition hover:bg-[#242e31] disabled:opacity-40"
          >
            Fast-forward a day →
          </button>
          <button
            type="button"
            onClick={() => act(() => api.reset())}
            disabled={busy}
            className="rounded-full border border-[#2a3438] px-3 py-1.5 text-xs text-[#61706f] transition hover:text-[#eef3f3] disabled:opacity-40"
          >
            Reset demo
          </button>
        </div>
      </header>

      {/* ── Notification simulation ─────────────────────────── */}
      {alert && (
        <div
          className="lc-rise mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#ff5d5d]/50 bg-[rgba(255,93,93,0.1)] px-5 py-4"
          role="status"
        >
          <span className="text-2xl">🔔</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-semibold text-[#ff5d5d]">
              {alert.items.length === 1
                ? `Your ${alert.items[0].name} expires today`
                : `${alert.items.length} things expire today`}
            </p>
            <p className="m-0 text-xs text-[#93a3a6]">
              {alert.items.map((row) => row.name).join(", ")} — cook something with{" "}
              {alert.items.length === 1 ? "it" : "them"} tonight.
            </p>
          </div>
          {suggestions[0] && (
            <button
              type="button"
              onClick={() => setOpenRecipe(suggestions[0].recipe.id)}
              className="rounded-full bg-[#ff5d5d] px-4 py-2 text-sm font-semibold text-white"
            >
              Try {suggestions[0].recipe.title}
            </button>
          )}
        </div>
      )}

      <main className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left: scan, shelf, suggestions ─────────────────── */}
        <div className="grid gap-5">
          <ScanPanel onConfirmed={load} onPhoto={setFridgePhoto} showToast={showToast} />

          <section className="rounded-2xl border border-[#2a3438] bg-[#141a1c] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg font-bold tracking-tight text-[#eef3f3]">In the fridge</h2>
              <span className="font-mono text-xs text-[#61706f]">
                {items.length} items · {health.at_risk} need using
              </span>
            </div>

            <AddItem
              value={adding}
              onChange={setAdding}
              onAdd={async (name) => {
                await act(() => api.addItem(name));
                setAdding("");
                await load();
              }}
              busy={busy}
            />

            <div className="mt-4">
              <Shelf
                items={items}
                alertIds={alertIds}
                onSetDate={async (item, date) => {
                  await act(() => api.setExpiry(item.id, date), { quiet: true });
                  await load();
                }}
                onRemove={async (item) => {
                  await act(() => api.removeItem(item.id), { quiet: true });
                  await load();
                }}
                onBin={async (item) => {
                  await act(() => api.removeItem(item.id, true));
                  await load();
                }}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#2a3438] bg-[#141a1c] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg font-bold tracking-tight text-[#eef3f3]">Cook this</h2>
              <span className="text-xs text-[#61706f]">
                Ranked by what you have and what&apos;s about to go
              </span>
            </div>

            {suggestions.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[#2a3438] p-8 text-center text-sm text-[#61706f]">
                Add a few ingredients and suggestions appear here.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.recipe.id}
                    suggestion={suggestion}
                    onOpen={() => setOpenRecipe(suggestion.recipe.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right: the measurements ────────────────────────── */}
        <aside className="grid gap-5 lg:sticky lg:top-6">
          <section className="rounded-2xl border border-[#2a3438] bg-[#141a1c] p-5">
            <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-widest text-[#61706f]">
              Fridge health
            </h2>
            <HealthDial health={health} />
          </section>

          <section className="rounded-2xl border border-[#2a3438] bg-[#141a1c] p-5">
            <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-widest text-[#61706f]">
              Food waste saved
            </h2>
            <WastePanel waste={waste} leaderboard={leaderboard} />
          </section>

          <VoiceAsk suggestions={suggestions} atRisk={atRisk} showToast={showToast} />

          {missing.length > 0 && (
            <section className="rounded-2xl border border-[#2a3438] bg-[#141a1c] p-5">
              <h2 className="m-0 mb-1 text-sm font-semibold uppercase tracking-widest text-[#61706f]">
                What am I missing?
              </h2>
              <p className="m-0 mb-3 text-xs text-[#61706f]">
                One thing on the way home unlocks these.
              </p>
              <ul className="m-0 grid list-none gap-2 p-0">
                {missing.map((row) => (
                  <li key={row.ingredient_id} className="text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-[#eef3f3]">{row.name}</span>
                      <span className="font-mono text-[10px] text-[#56d9c8]">
                        +{row.unlocks} recipe{row.unlocks === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="m-0 truncate text-xs text-[#61706f]">{row.recipes.join(", ")}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </main>

      {openRecipe && (
        <RecipeReveal
          recipeId={openRecipe}
          fridgePhoto={fridgePhoto}
          onClose={() => setOpenRecipe(null)}
          onCooked={() => load()}
          showToast={showToast}
        />
      )}

      {toast && (
        <div
          className={`lc-rise fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg ${
            toast.kind === "error"
              ? "bg-[#ff5d5d] text-white"
              : toast.kind === "warn"
                ? "bg-[#ffc043] text-[#221700]"
                : "bg-[#3ddc84] text-[#06210f]"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/** Manual correction — the model missed the eggs, so you type "egg". */
function AddItem({ value, onChange, onAdd, busy }) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;

    // Everything, including clearing the list, happens on the debounce rather
    // than in the effect body — a synchronous setState here would render twice
    // on every keystroke.
    const timer = window.setTimeout(() => {
      const term = value.trim();

      if (term.length < 2) {
        if (!cancelled) setOptions([]);
        return;
      }

      api
        .ingredients(term)
        .then((response) => !cancelled && setOptions(response.data ?? []))
        .catch(() => !cancelled && setOptions([]));
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="relative mt-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onAdd(value.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add something by hand…"
          className="min-w-0 flex-1 rounded-full border border-[#2a3438] bg-[#0a0e0f] px-4 py-2 text-sm placeholder:text-[#4a595c] focus:border-[#56d9c8] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-full bg-[#1c2427] px-4 py-2 text-sm font-semibold text-[#56d9c8] disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 grid w-full list-none gap-0.5 rounded-xl border border-[#2a3438] bg-[#1c2427] p-1.5 shadow-xl">
          {options.slice(0, 6).map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onAdd(option.name)}
                className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-[#93a3a6] transition hover:bg-[#242e31] hover:text-[#eef3f3]"
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One recipe on the "cook this" shelf, with the reason it is there. */
function SuggestionCard({ suggestion, onOpen }) {
  const { recipe, rescues } = suggestion;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border border-[#2a3438] bg-[#1c2427] text-left transition hover:border-[#56d9c8]/60"
    >
      <div className="relative">
        <img
          src={recipeImage(recipe.image_path)}
          alt=""
          className="h-28 w-full object-cover transition group-hover:scale-[1.03]"
        />
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold text-[#eef3f3]">
          {suggestion.match_percent}%
        </span>
        {suggestion.local_bonus > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-[#56d9c8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#06201d]">
            local
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="m-0 truncate text-sm font-bold text-[#eef3f3]">{recipe.title}</p>
        <p className="m-0 mt-0.5 truncate text-[11px] text-[#61706f]">
          {recipe.cuisine_country}
          {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ""}
          {suggestion.missing.length > 0 ? ` · need ${suggestion.missing.length}` : " · ready now"}
        </p>

        {rescues.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {rescues.slice(0, 2).map((rescue) => (
              <FreshnessBadge key={rescue.ingredient_id} freshness={rescue} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
