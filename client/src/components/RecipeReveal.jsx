import { useEffect, useState } from "react";
import { api, recipeImage } from "../api";
import { FreshnessBadge } from "./Freshness";

/**
 * The Recipe Reveal.
 *
 * Your fridge photo on the left, the plated dish on the right. That side-by-side
 * is the whole "wow" beat: it closes the gap between a shelf of raw ingredients
 * and a finished meal in one image, which is the promise the app is making.
 *
 * The dish pictures are generated deterministically per recipe by
 * App\Support\DishArtwork — no stock photography, no image model, nothing that
 * needs a network. Same title, same picture, every time.
 */
export default function RecipeReveal({ recipeId, fridgePhoto, onClose, onCooked, showToast }) {
  const [recipe, setRecipe] = useState(null);
  const [consume, setConsume] = useState(() => new Set());
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecipe(null);

    api
      .recipe(recipeId)
      .then((response) => {
        if (cancelled) return;
        setRecipe(response.data);
        setConsume(
          new Set(
            response.data.consumes
              .filter((row) => row.consume_by_default)
              .map((row) => row.pantry_item_id)
          )
        );
      })
      .catch((error) => !cancelled && showToast(error.message, "error"));

    return () => {
      cancelled = true;
    };
  }, [recipeId, showToast]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function cook() {
    setBusy(true);
    try {
      const response = await api.cooked(recipeId, [...consume]);
      setReceipt(response);
      showToast(response.message);
      onCooked?.(response);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!receipt?.removed?.length) return;
    setBusy(true);
    try {
      const response = await api.restore(receipt.removed);
      showToast(response.message);
      setReceipt(null);
      onCooked?.(response);
      onClose();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="lc-reveal max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        {!recipe ? (
          <p className="py-16 text-center text-sm text-[var(--faint)]">Plating up…</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--text)]">
                  {recipe.title}
                </h2>
                <p className="m-0 mt-1 text-sm text-[var(--dim)]">
                  {recipe.cuisine_country} · {recipe.difficulty}
                  {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ""}
                </p>
                {recipe.generated && (
                  <p className="m-0 mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--raised)] px-3 py-1 text-[11px] font-semibold text-[var(--dim)]">
                    ✦ Written by FridgeMama from what is on your shelf
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--faint)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                ×
              </button>
            </div>

            {/* ── The reveal ─────────────────────────────────── */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <figure className="m-0">
                {/* Only ever the cook's own photo. Falling back to some other
                    dish's artwork here would caption a picture of food they
                    never had as "what you had", which is a lie the reveal
                    cannot afford — the whole beat depends on the left image
                    being theirs. */}
                {fridgePhoto ? (
                  <img
                    src={fridgePhoto}
                    alt="Your fridge"
                    className="h-48 w-full rounded-xl border border-[var(--line)] object-cover"
                  />
                ) : (
                  <div className="grid h-48 w-full place-items-center rounded-xl border border-dashed border-[var(--line)] px-6 text-center text-xs leading-relaxed text-[var(--faint)]">
                    Scan your fridge and your photo appears here, next to the dish
                    it turns into.
                  </div>
                )}
                <figcaption className="mt-1.5 text-[10px] uppercase tracking-widest text-[var(--faint)]">
                  {fridgePhoto ? "What you had" : "Your fridge"}
                </figcaption>
              </figure>
              <figure className="m-0">
                <img
                  src={recipeImage(recipe.image_path)}
                  alt={recipe.title}
                  className="h-48 w-full rounded-xl border border-[var(--accent)]/40 object-cover"
                />
                <figcaption className="mt-1.5 text-[10px] uppercase tracking-widest text-[var(--accent)]">
                  What you get
                </figcaption>
              </figure>
            </div>

            {receipt ? (
              <div className="mt-6">
                <h3 className="m-0 text-base font-bold text-[var(--fresh)]">Enjoy it 🎉</h3>
                <p className="mt-1.5 mb-0 text-sm text-[var(--dim)]">{receipt.message}</p>

                {receipt.rescued?.length > 0 && (
                  <div className="mt-4 rounded-xl border border-[var(--fresh)]/40 bg-[var(--fresh-soft)] p-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-widest text-[var(--fresh)]">
                      Saved from the bin
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {receipt.rescued.map((item) => (
                        <span
                          key={item.ingredient_id}
                          className="rounded-full bg-[var(--raised)] px-3 py-1 text-sm text-[var(--text)]"
                        >
                          {item.name}
                          <span className="ml-1.5 font-mono text-[10px] text-[var(--dim)]">
                            {item.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)]"
                  >
                    Back to my fridge
                  </button>
                  <button
                    type="button"
                    onClick={undo}
                    disabled={busy}
                    className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    {busy ? "Putting back…" : "Undo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--faint)]">
                    Method
                  </h3>
                  <ol className="m-0 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-[var(--dim)]">
                    {recipe.steps.map((step) => (
                      <li key={step.index}>
                        {step.text}
                        {step.timer_seconds ? (
                          <span className="ml-1.5 font-mono text-[10px] text-[var(--accent)]">
                            {Math.round(step.timer_seconds / 60)} min
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--faint)]">
                    Ingredients
                  </h3>
                  <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
                    {recipe.ingredients.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <span className={item.in_fridge ? "text-[var(--text)]" : "text-[var(--faint)]"}>
                          {item.raw_text}
                          {item.name_bn && (
                            <span className="ml-1.5 text-xs text-[var(--faint)]">{item.name_bn}</span>
                          )}
                        </span>
                        {item.in_fridge ? (
                          <FreshnessBadge freshness={item.freshness} />
                        ) : (
                          <span className="font-mono text-[10px] text-[var(--need)]">need</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {recipe.consumes.length > 0 && (
                    <div className="mt-5 rounded-xl border border-[var(--line)] p-3.5">
                      <p className="m-0 mb-2 text-xs text-[var(--dim)]">
                        Cooking this takes these out. Untick anything you have some left of.
                        Cupboard items start unticked — you don&apos;t run out of salt because
                        you cooked one dish.
                      </p>
                      <div className="grid gap-1">
                        {recipe.consumes.map((row) => (
                          <label
                            key={row.pantry_item_id}
                            className="flex cursor-pointer items-center gap-2.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={consume.has(row.pantry_item_id)}
                              onChange={() =>
                                setConsume((current) => {
                                  const next = new Set(current);
                                  next.has(row.pantry_item_id)
                                    ? next.delete(row.pantry_item_id)
                                    : next.add(row.pantry_item_id);
                                  return next;
                                })
                              }
                              className="h-3.5 w-3.5 accent-[var(--fresh)]"
                            />
                            <span className="flex-1 text-[var(--text)]">
                              {row.name}
                              {row.name_bn && (
                                <span className="ml-1.5 text-xs text-[var(--faint)]">{row.name_bn}</span>
                              )}
                            </span>
                            {row.is_cupboard && (
                              <span className="font-mono text-[10px] text-[var(--faint)]">cupboard</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={cook}
                    disabled={busy}
                    className="mt-4 w-full rounded-full bg-[var(--fresh)] px-5 py-2.5 text-sm font-semibold text-[var(--on-fresh)] disabled:opacity-40"
                  >
                    {busy ? "Updating…" : `I cooked this${consume.size ? ` · ${consume.size} used` : ""}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
