import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, recipeImage } from "./api";
import { FreshnessBadge } from "./components/Freshness";
import HealthDial from "./components/HealthDial";
import InstallButton from "./components/InstallButton";
import Logo from "./components/Logo";
import RecipeReveal from "./components/RecipeReveal";
import ScanPanel from "./components/ScanPanel";
import Shelf from "./components/Shelf";
import VoiceAsk from "./components/VoiceAsk";
import WastePanel from "./components/WastePanel";

/**
 * FridgeMama — the whole app, one screen.
 *
 * The loop the proposal describes, in the order it happens:
 * detect → track → warn → cook → measure. There is nothing else to navigate
 * to, no account to make and no menu, because every extra click is a second
 * of a ninety-second demo spent on something that is not the point.
 */
export default function App({ onHome }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [fridgePhoto, setFridgePhoto] = useState(null);
  const [adding, setAdding] = useState("");
  // Bumped by "Reset demo" so the scan panel remounts and forgets the last
  // judge's photo along with everything else.
  const [scanKey, setScanKey] = useState(0);

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

  /**
   * Put the screen back for the next judge, not just the database.
   *
   * Resetting the fridge while their predecessor's photo is still sitting in
   * the scan panel is the kind of thing nobody notices in rehearsal and
   * everybody notices at a stall.
   */
  async function resetDemo() {
    setAlert(null);
    setOpenRecipe(null);
    setFridgePhoto(null);
    setAdding("");
    setScanKey((n) => n + 1);
    await act(() => api.reset());
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[var(--faint)]">
        Opening the fridge…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center gap-3 text-center text-sm text-[var(--dim)]">
        <p>Couldn&apos;t reach the app.</p>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-[var(--line)] px-4 py-2 font-semibold"
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
        <button
          type="button"
          onClick={onHome}
          title="Back to the front page"
          className="flex items-center gap-3 rounded-xl border-0 bg-transparent p-0 text-left"
        >
          <Logo
            size={38}
            tagline="Point your phone — it tells you what to eat before it's too late."
          />
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <InstallButton />
          <span className="rounded-full border border-[var(--line)] px-3 py-1.5 font-mono text-xs text-[var(--dim)]">
            Day {state.session.day_offset + 1}
          </span>
          <button
            type="button"
            onClick={fastForward}
            disabled={busy}
            className="rounded-full bg-[var(--raised)] px-4 py-1.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Fast-forward a day →
          </button>
          <button
            type="button"
            onClick={resetDemo}
            disabled={busy}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--faint)] transition hover:text-[var(--text)] disabled:opacity-40"
          >
            Reset demo
          </button>
        </div>
      </header>

      {/* ── Notification simulation ─────────────────────────── */}
      {alert && (
        <div
          className="lc-rise mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--today)]/50 bg-[rgba(255,93,93,0.1)] px-5 py-4"
          role="status"
        >
          <span className="text-2xl">🔔</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-semibold text-[var(--today)]">
              {alert.items.length === 1
                ? `Your ${alert.items[0].name} expires today`
                : `${alert.items.length} things expire today`}
            </p>
            <p className="m-0 text-xs text-[var(--dim)]">
              {alert.items.map((row) => row.name).join(", ")} — cook something with{" "}
              {alert.items.length === 1 ? "it" : "them"} tonight.
            </p>
          </div>
          {suggestions[0] && (
            <button
              type="button"
              onClick={() => setOpenRecipe(suggestions[0].recipe.id)}
              className="rounded-full bg-[var(--today)] px-4 py-2 text-sm font-semibold text-white"
            >
              Try {suggestions[0].recipe.title}
            </button>
          )}
        </div>
      )}

      <main className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left: scan, shelf, suggestions ─────────────────── */}
        <div className="grid gap-5">
          <ScanPanel key={scanKey} onConfirmed={load} onPhoto={setFridgePhoto} showToast={showToast} />

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg font-bold tracking-tight text-[var(--text)]">In the fridge</h2>
              <span className="font-mono text-xs text-[var(--faint)]">
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

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg font-bold tracking-tight text-[var(--text)]">Cook this</h2>
              <span className="text-xs text-[var(--faint)]">
                Ranked by what you have and what&apos;s about to go
              </span>
            </div>

            {suggestions.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--faint)]">
                Add a few ingredients and suggestions appear here.
              </p>
            ) : (
              <div className="lc-stagger mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--faint)]">
              Fridge health
            </h2>
            <HealthDial health={health} />
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--faint)]">
              Food waste saved
            </h2>
            <WastePanel waste={waste} leaderboard={leaderboard} />
          </section>

          <VoiceAsk suggestions={suggestions} atRisk={atRisk} showToast={showToast} />

          {missing.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h2 className="m-0 mb-1 text-sm font-semibold uppercase tracking-widest text-[var(--faint)]">
                What am I missing?
              </h2>
              <p className="m-0 mb-3 text-xs text-[var(--faint)]">
                One thing on the way home unlocks these.
              </p>
              <ul className="lc-stagger m-0 grid list-none gap-2 p-0">
                {missing.map((row) => (
                  <li key={row.ingredient_id} className="text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-[var(--text)]">{row.name}</span>
                      {row.name_bn && (
                        <span className="text-xs text-[var(--faint)]">{row.name_bn}</span>
                      )}
                      <span className="font-mono text-[10px] text-[var(--accent)]">
                        +{row.unlocks} recipe{row.unlocks === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="m-0 truncate text-xs text-[var(--faint)]">{row.recipes.join(", ")}</p>
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
              ? "bg-[var(--today)] text-white"
              : toast.kind === "warn"
                ? "bg-[var(--soon)] text-[var(--on-soon)]"
                : "bg-[var(--fresh)] text-[var(--on-fresh)]"
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
          className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm placeholder:text-[var(--placeholder)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-full bg-[var(--raised)] px-4 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 grid w-full list-none gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-1.5 shadow-xl">
          {options.slice(0, 6).map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onAdd(option.name)}
                className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-[var(--dim)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
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
      className="lc-card lc-lift group overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-left transition hover:border-[var(--accent)]"
    >
      <div className="relative">
        <img
          src={recipeImage(recipe.image_path)}
          alt=""
          className="h-28 w-full object-cover transition group-hover:scale-[1.03]"
        />
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--text)]">
          {suggestion.match_percent}%
        </span>
        {suggestion.local_bonus > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--on-accent)]">
            local
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="m-0 truncate text-sm font-bold text-[var(--text)]">{recipe.title}</p>
        <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--faint)]">
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
