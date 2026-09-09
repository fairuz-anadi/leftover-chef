import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  CircleHelp,
  LayoutDashboard,
  Menu,
  Refrigerator,
  RotateCcw,
  ScanLine,
  Sparkles,
  Sprout,
  X,
} from "lucide-react";
import { api, isNativeApp, IS_PREVIEW, recipeImage } from "./api";
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
 * FridgeMama — the workspace.
 *
 * The loop the proposal describes, in the order it happens: detect → track →
 * warn → cook → measure.
 *
 * The sidebar is a set of lenses, not a set of places. **Kitchen** holds the
 * entire loop on one screen — scan, shelf, recipes, health, waste, the voice
 * question and the missing-ingredient list — because a ninety-second demo
 * cannot afford a click that only moves you somewhere else. The other three
 * views are that same data given room to breathe, for somebody who wants to
 * look properly rather than be shown. Nothing lives in one of them alone.
 */

const VIEWS = [
  { id: "kitchen", label: "Kitchen", icon: LayoutDashboard },
  { id: "fridge", label: "My Fridge", icon: Refrigerator },
  { id: "recipes", label: "Recipe ideas", icon: ChefHat },
  { id: "impact", label: "Impact", icon: Sprout },
];

export default function App({ onHome = null, onChangeKitchen = null }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [fridgePhoto, setFridgePhoto] = useState(null);
  const [adding, setAdding] = useState("");
  const [view, setView] = useState("kitchen");
  const [navOpen, setNavOpen] = useState(false);
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
    setView("kitchen");
    setScanKey((n) => n + 1);
    await act(() => api.reset());
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center gap-4 text-sm text-[var(--faint)]">
        <Logo size={38} />
        <span>Opening the fridge…</span>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center gap-3 px-6 text-center text-sm text-[var(--dim)]">
        <Logo size={38} />
        <p className="m-0 max-w-xs">
          {isNativeApp
            ? "Couldn't reach the kitchen. Check the laptop is running and both devices are on the same WiFi."
            : "Couldn't reach the app."}
        </p>
        <button type="button" onClick={load} className="pill-outline">
          Try again
        </button>
        {onChangeKitchen && (
          <button
            type="button"
            onClick={onChangeKitchen}
            className="rounded-full px-4 py-2 text-xs font-semibold text-[var(--accent)]"
          >
            Change the kitchen address
          </button>
        )}
      </div>
    );
  }

  const {
    items,
    health,
    waste,
    leaderboard,
    suggestions,
    missing_links: missing,
    at_risk: atRisk,
  } = state;

  // Built once and placed in whichever views need them, so "every option stays
  // visible" is enforced by there being one of each rather than by discipline.
  const scanPanel = (
    <ScanPanel key={scanKey} onConfirmed={load} onPhoto={setFridgePhoto} showToast={showToast} />
  );

  const shelfBlock = (
    <Card title="In the fridge" meta={`${items.length} items · ${health.at_risk} need using`}>
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
    </Card>
  );

  const suggestionsBlock = (columns) => (
    <Card title="Cook this" meta="Ranked by what you have and what's about to go">
      {suggestions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--faint)]">
          Add a few ingredients and suggestions appear here.
        </p>
      ) : (
        <div className={`lc-stagger mt-4 grid gap-3 sm:grid-cols-2 ${columns}`}>
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.recipe.id}
              suggestion={suggestion}
              onOpen={() => setOpenRecipe(suggestion.recipe.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );

  const healthBlock = (
    <Card label="Fridge health">
      <HealthDial health={health} />
    </Card>
  );

  const wasteBlock = (
    <Card label="Food waste saved">
      <WastePanel waste={waste} leaderboard={leaderboard} />
    </Card>
  );

  const missingBlock = missing.length > 0 && (
    <Card label="What am I missing?">
      <p className="m-0 mb-3 text-xs text-[var(--faint)]">
        One thing on the way home unlocks these.
      </p>
      <ul className="lc-stagger m-0 grid list-none gap-2 p-0">
        {missing.map((row) => (
          <li key={row.ingredient_id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-[var(--text)]">{row.name}</span>
              {row.name_bn && <span className="text-xs text-[var(--faint)]">{row.name_bn}</span>}
              <span className="font-mono text-[10px] text-[var(--accent)]">
                +{row.unlocks} recipe{row.unlocks === 1 ? "" : "s"}
              </span>
            </div>
            <p className="m-0 truncate text-xs text-[var(--faint)]">{row.recipes.join(", ")}</p>
          </li>
        ))}
      </ul>
    </Card>
  );

  const voiceBlock = <VoiceAsk suggestions={suggestions} atRisk={atRisk} showToast={showToast} />;

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          {onHome ? (
            <button
              type="button"
              onClick={onHome}
              title="Back to the front page"
              className="border-0 bg-transparent p-0"
            >
              <Logo size={32} compact />
            </button>
          ) : (
            <Logo size={32} compact />
          )}
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-chip">
          <span className="workspace-avatar">
            <Refrigerator size={16} />
          </span>
          <span>
            <b>This kitchen</b>
            <small>Day {state.session.day_offset + 1} · offline</small>
          </span>
        </div>

        <nav className="side-nav">
          <p className="nav-label">Workspace</p>
          {VIEWS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                className={`nav-item ${view === entry.id ? "active" : ""}`}
                onClick={() => {
                  setView(entry.id);
                  setNavOpen(false);
                }}
              >
                <Icon size={17} />
                <span>{entry.label}</span>
                {entry.id === "fridge" && <em>{items.length}</em>}
                {entry.id === "recipes" && <em>{suggestions.length}</em>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="offline-card">
            <span className="live-dot" />
            <div>
              <b>Running locally</b>
              <small>No internet required</small>
            </div>
            <CircleHelp size={15} />
          </div>
          {onChangeKitchen && (
            <button type="button" onClick={onChangeKitchen} className="nav-item">
              <ScanLine size={17} />
              <span>Kitchen address</span>
            </button>
          )}
        </div>
      </aside>

      {navOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="icon-button mobile-menu"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="topbar-context">
            <span className="live-dot" />
            <span>Live kitchen view</span>
            <span className="context-separator">/</span>
            <b>{VIEWS.find((entry) => entry.id === view)?.label}</b>
          </div>

          <div className="topbar-actions">
            <InstallButton />
            <span className="day-chip">Day {state.session.day_offset + 1}</span>
            <button type="button" onClick={fastForward} disabled={busy} className="pill-solid">
              Fast-forward a day →
            </button>
            <button
              type="button"
              onClick={resetDemo}
              disabled={busy}
              className="icon-button"
              title="Reset the demo for the next judge"
              aria-label="Reset demo"
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </header>

        <div className="app-content">
          {/* ── What this deployment is ───────────────────── */}
          {IS_PREVIEW && (
            <div className="preview-banner" role="note">
              <b>Online preview.</b> Everything here runs in your browser against the real
              seeded data. The detector&rsquo;s answer for the sample photo is a recording of
              a real run — the live model runs on the laptop, offline, which is the whole
              point of the project.
            </div>
          )}

          {/* ── Notification simulation ───────────────────── */}
          {alert && (
            <div className="lc-rise alert-banner" role="status">
              <span className="alert-bell">🔔</span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-bold text-[var(--today)]">
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
                  className="alert-action"
                >
                  Try {suggestions[0].recipe.title}
                </button>
              )}
            </div>
          )}

          {/* ── Kitchen: the whole loop, nothing hidden ───── */}
          {view === "kitchen" && (
            <div className="view kitchen-grid">
              <div className="grid gap-5">
                {scanPanel}
                {shelfBlock}
                {suggestionsBlock("xl:grid-cols-3")}
              </div>
              <aside className="grid gap-5 lg:sticky lg:top-4 lg:self-start">
                {healthBlock}
                {wasteBlock}
                {voiceBlock}
                {missingBlock}
              </aside>
            </div>
          )}

          {/* ── The same data, given room ─────────────────── */}
          {view === "fridge" && (
            <div className="view grid gap-5">
              <PageHeading
                eyebrow="Everything on the shelf"
                title="My Fridge"
                lede="Every item, its Bangla name, and how long it has left. Tap a date to correct it — the model saves the typing, it does not get the last word."
              />
              {scanPanel}
              {shelfBlock}
              {missingBlock}
            </div>
          )}

          {view === "recipes" && (
            <div className="view grid gap-5">
              <PageHeading
                eyebrow="Ranked around what is dying"
                title="Recipe ideas"
                lede="Priority is 0.6 × how much of the recipe you already have, plus 0.4 × how urgent those ingredients are, plus a nudge for Bangladeshi cooking. Arithmetic you can check by hand."
              />
              {voiceBlock}
              {suggestionsBlock("xl:grid-cols-4")}
            </div>
          )}

          {view === "impact" && (
            <div className="view grid gap-5">
              <PageHeading
                eyebrow="Small actions, visible impact"
                title="Impact"
                lede="Food waste is easier to prevent when the next best action is visible at the right time. SDG 12 — responsible consumption and production."
              />
              <div className="impact-grid">
                {healthBlock}
                {wasteBlock}
              </div>
            </div>
          )}
        </div>
      </div>

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
          className={`lc-rise toast ${
            toast.kind === "error"
              ? "toast-error"
              : toast.kind === "warn"
                ? "toast-warn"
                : "toast-ok"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/** A panel. Either a titled section, or a quieter labelled one for the rail. */
function Card({ title, label, meta, children }) {
  return (
    <section className="panel">
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-lg font-bold text-[var(--text)]">{title}</h2>
          {meta && <span className="text-xs text-[var(--faint)]">{meta}</span>}
        </div>
      )}
      {label && (
        <h2 className="m-0 mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
          {label}
        </h2>
      )}
      {children}
    </section>
  );
}

function PageHeading({ eyebrow, title, lede }) {
  return (
    <div className="page-heading">
      <p className="eyebrow">
        <span /> {eyebrow}
      </p>
      <h1>{title}</h1>
      <p>{lede}</p>
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
          className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm placeholder:text-[var(--placeholder)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-full bg-[var(--raised)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 grid w-full list-none gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
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
    <button type="button" onClick={onOpen} className="lc-card lc-lift recipe-card group">
      <div className="relative">
        <img
          src={recipeImage(recipe.image_path)}
          alt=""
          className="h-28 w-full object-cover transition group-hover:scale-[1.03]"
        />
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
          {suggestion.match_percent}%
        </span>
        <span className="absolute left-2 top-2 flex gap-1">
          {recipe.generated && (
            <span
              title="Written by FridgeMama for what is on your shelf"
              className="flex items-center gap-1 rounded-full bg-[var(--text)] px-2 py-0.5 font-mono text-[10px] font-bold text-white"
            >
              <Sparkles size={9} /> for you
            </span>
          )}
          {suggestion.local_bonus > 0 && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--on-accent)]">
              local
            </span>
          )}
        </span>
      </div>

      <div className="p-3.5">
        <p className="m-0 truncate text-sm font-bold text-[var(--text)]">{recipe.title}</p>
        <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--faint)]">
          {recipe.generated ? "Written for your shelf · " : ""}
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
