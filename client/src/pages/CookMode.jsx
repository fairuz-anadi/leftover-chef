import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/api";
import NutritionPanel from "../components/NutritionPanel";
import { useToast } from "../components/useToast";

/**
 * Guided Cooking Mode — one step at a time, with a countdown timer for any
 * step that mentions a duration and spoken prompts through the browser's
 * speech synthesiser.
 */
export default function CookMode() {
  const { recipeId } = useParams();
  const [payload, setPayload] = useState(null);
  const [servings, setServings] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState(() => new Set());
  const [voiceOn, setVoiceOn] = useState(false);
  const [loading, setLoading] = useState(true);
  // The finish flow: null until they say they cooked it, then the panel, then
  // the receipt with an undo on it.
  const [finishing, setFinishing] = useState(false);
  const [consume, setConsume] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const { showToast } = useToast();

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await api.cookMode(recipeId, servings ?? undefined);
        if (!cancelled) {
          setPayload(response.data);
          setServings((current) => current ?? response.data.servings);
        }
      } catch (error) {
        if (!cancelled) showToast(error.message, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [recipeId, servings, showToast]);

  const steps = payload?.steps ?? [];
  const step = steps[stepIndex];
  const usage = payload?.pantry_usage ?? [];

  /**
   * Read the fridge at the moment they finish, not when they started.
   *
   * A recipe takes half an hour and the shelf can move underneath it — someone
   * signs in, or edits the fridge in another tab. Refetching here is one query
   * and removes a whole class of "it said I had nothing".
   */
  async function openFinish() {
    setReceipt(null);
    setFinishing(true);
    setRefreshing(true);

    try {
      const response = await api.cookMode(recipeId, servings ?? undefined);
      setPayload(response.data);

      // Pre-tick the perishables and leave the staples alone; you do not run
      // out of salt because you cooked one dish.
      const fresh = response.data.pantry_usage ?? [];
      setConsume(new Set(fresh.filter((row) => row.consume_by_default).map((row) => row.pantry_item_id)));
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmCooked(ids) {
    setSaving(true);
    try {
      const response = await api.markCooked(recipeId, ids);
      setReceipt(response);
      showToast(response.message);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function undoCooked() {
    if (!receipt?.removed?.length) return;

    setSaving(true);
    try {
      const response = await api.restorePantry(receipt.removed);
      setReceipt(null);
      setFinishing(false);
      showToast(response.message);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const speak = useCallback(
    (text) => {
      if (!voiceOn || !speechSupported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    },
    [voiceOn, speechSupported]
  );

  // Read each step aloud as it becomes active.
  useEffect(() => {
    if (step) speak(`Step ${step.number}. ${step.speech}`);
  }, [step, speak]);

  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  const goTo = useCallback(
    (index) => {
      setStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
    },
    [steps.length]
  );

  // Arrow keys move between steps — hands are busy in a kitchen.
  useEffect(() => {
    function onKey(event) {
      if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") return;
      if (event.key === "ArrowRight") goTo(stepIndex + 1);
      if (event.key === "ArrowLeft") goTo(stepIndex - 1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, stepIndex]);

  if (loading && !payload) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--muted)]">Loading cook mode…</p>;
  }

  if (!payload) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--muted)]">
        We couldn&apos;t load this recipe. <Link className="underline" to="/recipes">Back to recipes</Link>
      </p>
    );
  }

  const { recipe, ingredients, nutrition } = payload;
  const progress = steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/recipes" className="text-xs text-[var(--muted)] hover:underline">
            ← Back to recipes
          </Link>
          <h1 className="mt-2 mb-1 font-[var(--font-display)] text-3xl font-black text-[var(--text)]">
            {recipe.title}
          </h1>
          <p className="m-0 text-sm text-[var(--muted)]">
            {recipe.cuisine_country ?? "Uncategorised"} · {recipe.difficulty}
            {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Servings</span>
            <select
              value={servings ?? recipe.servings}
              onChange={(event) => setServings(Number(event.target.value))}
              className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-1.5"
            >
              {[1, 2, 3, 4, 6, 8, 10, 12].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!speechSupported}
            onClick={() => {
              const next = !voiceOn;
              setVoiceOn(next);
              if (!next && speechSupported) window.speechSynthesis.cancel();
            }}
            title={speechSupported ? "Read steps aloud" : "Your browser has no speech synthesis"}
            className={`rounded-[var(--r-pill)] border px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
              voiceOn
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--border-strong)]"
            }`}
          >
            {voiceOn ? "🔊 Voice on" : "🔈 Voice off"}
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Steps ──────────────────────────────────────────── */}
        <section>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[rgba(20,24,27,0.1)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {step && (
            <article className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-strong)] p-8 shadow-[var(--shadow-sm)]">
              <p className="m-0 font-[var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--brand)]">
                Step {step.number} of {steps.length}
              </p>
              <p className="mt-4 mb-6 text-xl leading-relaxed text-[var(--text)]">{step.text}</p>

              {step.timer_seconds ? (
                <StepTimer
                  key={step.index}
                  seconds={step.timer_seconds}
                  onDone={() => {
                    showToast(`Step ${step.number} timer finished.`);
                    speak(`Timer finished for step ${step.number}.`);
                  }}
                />
              ) : (
                <p className="m-0 text-sm text-[var(--muted-light)]">No timer for this step.</p>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goTo(stepIndex - 1)}
                  disabled={stepIndex === 0}
                  className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold disabled:opacity-35"
                >
                  Previous
                </button>

                {stepIndex === steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={openFinish}
                    className="rounded-[var(--r-pill)] bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    I cooked this 🎉
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo(stepIndex + 1)}
                    className="rounded-[var(--r-pill)] bg-[var(--brand)] px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    Next step
                  </button>
                )}
              </div>
            </article>
          )}

          <ol className="mt-6 grid list-none gap-2 p-0">
            {steps.map((item) => (
              <li key={item.index}>
                <button
                  type="button"
                  onClick={() => goTo(item.index)}
                  className={`flex w-full items-start gap-3 rounded-[var(--r-sm)] px-4 py-2.5 text-left text-sm ${
                    item.index === stepIndex
                      ? "bg-[var(--brand-glow)] text-[var(--brand-deep)]"
                      : item.index < stepIndex
                        ? "text-[var(--muted-light)] line-through"
                        : "text-[var(--muted)] hover:bg-[rgba(20,24,27,0.04)]"
                  }`}
                >
                  <span className="font-semibold">{item.number}.</span>
                  <span className="flex-1">{item.text}</span>
                  {item.timer_seconds ? (
                    <span className="shrink-0 font-[var(--font-mono)] text-xs">
                      {formatClock(item.timer_seconds)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Side panel ─────────────────────────────────────── */}
        <aside className="grid h-fit gap-6">
          <section className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-5">
            <h2 className="m-0 mb-1 text-base font-bold text-[var(--text)]">Ingredients</h2>
            <p className="mt-0 mb-4 text-xs text-[var(--muted)]">
              Scaled for {servings ?? recipe.servings} servings
            </p>
            <ul className="m-0 grid list-none gap-2 p-0">
              {ingredients.map((item) => {
                const isChecked = checked.has(item.id);
                return (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setChecked((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        className="mt-1 accent-[var(--brand)]"
                      />
                      <span className={isChecked ? "text-[var(--muted-light)] line-through" : ""}>
                        {formatAmount(item)}{" "}
                        <strong className="font-semibold">{item.name}</strong>
                        {item.is_optional && (
                          <em className="ml-1 text-xs not-italic text-[var(--muted-light)]">(optional)</em>
                        )}
                        {item.in_pantry && (
                          <span
                            title="Already in your fridge"
                            className="ml-1.5 text-xs text-[var(--accent)]"
                          >
                            ✓ in fridge
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <NutritionPanel nutrition={nutrition} servings={servings ?? recipe.servings} />
        </aside>
      </div>

      {finishing && (
        <FinishPanel
          usage={usage}
          refreshing={refreshing}
          consume={consume}
          setConsume={setConsume}
          receipt={receipt}
          saving={saving}
          onConfirm={confirmCooked}
          onUndo={undoCooked}
          onClose={() => setFinishing(false)}
        />
      )}
    </div>
  );
}

/**
 * "You cooked it — shall I take these out of your fridge?"
 *
 * Two states in one panel. Before: a tick list of what this recipe uses that
 * you actually have, perishables ticked and staples not. After: a receipt
 * naming what went, what it saved from the bin, and an undo — because a
 * feature whose whole promise is "and it's gone" needs a way back from a
 * misclick.
 */
function FinishPanel({ usage, refreshing, consume, setConsume, receipt, saving, onConfirm, onUndo, onClose }) {
  const selected = usage.filter((row) => consume.has(row.pantry_item_id));

  function toggle(id) {
    setConsume((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Finish cooking"
    >
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[var(--r-lg)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-xl)]">
        {refreshing ? (
          <p className="m-0 py-6 text-center text-sm text-[var(--muted)]">Checking your fridge…</p>
        ) : receipt ? (
          <>
            <h2 className="m-0 font-[var(--font-display)] text-2xl font-black text-[var(--text)]">
              Enjoy it 🎉
            </h2>
            <p className="mt-2 mb-0 text-sm leading-relaxed text-[var(--muted)]">{receipt.message}</p>

            {receipt.rescued?.length > 0 && (
              <div className="mt-4 rounded-[var(--r-md)] border-2 border-[var(--accent)] bg-[var(--accent-glow)] p-4">
                <p className="m-0 text-sm font-semibold text-[var(--brand-deep)]">
                  Saved from the bin
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {receipt.rescued.map((item) => (
                    <span
                      key={item.ingredient_id}
                      className="rounded-[var(--r-pill)] bg-white/80 px-3 py-1 text-sm font-semibold text-[var(--brand-deep)]"
                    >
                      {item.name}
                      <span className="ml-1.5 font-[var(--font-mono)] text-[11px] font-normal opacity-70">
                        had {item.days_left <= 0 ? "expired" : `${item.days_left}d left`}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {receipt.removed?.length > 0 && (
              <p className="mt-4 mb-0 text-xs text-[var(--muted)]">
                Taken out: {receipt.removed.map((item) => item.name).join(", ")}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/fridge"
                className="rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Back to my fridge
              </Link>
              {receipt.removed?.length > 0 && (
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={saving}
                  className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? "Putting back…" : "Undo — put them back"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="m-0 font-[var(--font-display)] text-2xl font-black text-[var(--text)]">
              Take these out of your fridge?
            </h2>

            {usage.length === 0 ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Nothing to remove — none of this recipe&apos;s ingredients are on your
                  saved shelf. Sign in and stock your fridge and this will keep it in step
                  with what you actually cook.
                </p>
                <div className="mt-6 flex gap-2">
                  <Link
                    to="/recipes"
                    className="rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Done
                  </Link>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold"
                  >
                    Keep cooking
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-[var(--muted)]">
                  Untick anything you have some left of. Cupboard staples start unticked —
                  you don&apos;t run out of salt because you cooked one dish.
                </p>

                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {usage.map((row) => (
                    <li key={row.pantry_item_id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-[var(--r-sm)] px-2 py-2 text-sm hover:bg-[rgba(20,24,27,0.04)]">
                        <input
                          type="checkbox"
                          checked={consume.has(row.pantry_item_id)}
                          onChange={() => toggle(row.pantry_item_id)}
                          className="h-4 w-4 accent-[var(--brand)]"
                        />
                        <span className="flex-1 font-semibold text-[var(--text)]">{row.name}</span>

                        {row.expiry && row.expiry.state !== "fresh" && (
                          <span className="rounded-[var(--r-pill)] bg-[var(--accent-glow)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--accent)]">
                            {row.expiry.days_left <= 0
                              ? "overdue"
                              : `${row.expiry.days_left}d left`}
                          </span>
                        )}

                        {row.is_staple && (
                          <span className="font-[var(--font-mono)] text-[10px] text-[var(--muted-light)]">
                            staple
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirm(selected.map((row) => row.pantry_item_id))}
                    disabled={saving}
                    className="rounded-[var(--r-pill)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {saving
                      ? "Updating…"
                      : selected.length === 0
                        ? "Finish without removing"
                        : `Take out ${selected.length}`}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold"
                  >
                    Keep cooking
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Countdown for a single step, with a chime when it reaches zero.
 *
 * Mounted with `key={step.index}`, so moving between steps remounts it and
 * the countdown starts fresh — no reset effect needed.
 */
function StepTimer({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!running) return undefined;

    const id = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(id);
          setRunning(false);
          if (!doneRef.current) {
            doneRef.current = true;
            chime();
            onDone?.();
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [running, onDone]);

  const pct = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 0;

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[rgba(181,118,42,0.05)] p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="font-[var(--font-mono)] text-4xl font-bold tabular-nums text-[var(--accent)]">
          {formatClock(remaining)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRunning((value) => !value)}
            disabled={remaining === 0}
            className="rounded-[var(--r-pill)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {running ? "Pause" : remaining === seconds ? "Start timer" : "Resume"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setRemaining(seconds);
              doneRef.current = false;
            }}
            className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-4 py-2 text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgba(181,118,42,0.15)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatClock(totalSeconds) {
  const value = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatAmount(item) {
  if (item.quantity === null || item.quantity === undefined) {
    return "";
  }

  const rounded = Math.round(item.quantity * 100) / 100;
  return `${rounded}${item.unit ? ` ${item.unit}` : ""}`;
}

/** Short two-tone chime built with the Web Audio API — no asset needed. */
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    [880, 1320].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02 + index * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5 + index * 0.25);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(ctx.currentTime + index * 0.25);
      oscillator.stop(ctx.currentTime + 0.8 + index * 0.25);
    });

    setTimeout(() => ctx.close(), 2000);
  } catch {
    // A missing audio device is not worth interrupting the cook for.
  }
}
