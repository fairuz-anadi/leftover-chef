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
                  <Link
                    to="/recipes"
                    className="rounded-[var(--r-pill)] bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    Finish 🎉
                  </Link>
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
