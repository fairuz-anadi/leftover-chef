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
      <div className="lc-reveal max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#2a3438] bg-[#141a1c] p-6">
        {!recipe ? (
          <p className="py-16 text-center text-sm text-[#61706f]">Plating up…</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-bold tracking-tight text-[#eef3f3]">
                  {recipe.title}
                </h2>
                <p className="m-0 mt-1 text-sm text-[#93a3a6]">
                  {recipe.cuisine_country} · {recipe.difficulty}
                  {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#61706f] transition hover:bg-[#242e31] hover:text-[#eef3f3]"
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
                    className="h-48 w-full rounded-xl border border-[#2a3438] object-cover"
                  />
                ) : (
                  <div className="grid h-48 w-full place-items-center rounded-xl border border-dashed border-[#2a3438] px-6 text-center text-xs leading-relaxed text-[#61706f]">
                    Scan your fridge and your photo appears here, next to the dish
                    it turns into.
                  </div>
                )}
                <figcaption className="mt-1.5 text-[10px] uppercase tracking-widest text-[#61706f]">
                  {fridgePhoto ? "What you had" : "Your fridge"}
                </figcaption>
              </figure>
              <figure className="m-0">
                <img
                  src={recipeImage(recipe.image_path)}
                  alt={recipe.title}
                  className="h-48 w-full rounded-xl border border-[#56d9c8]/40 object-cover"
                />
                <figcaption className="mt-1.5 text-[10px] uppercase tracking-widest text-[#56d9c8]">
                  What you get
                </figcaption>
              </figure>
            </div>

            {receipt ? (
              <div className="mt-6">
                <h3 className="m-0 text-base font-bold text-[#3ddc84]">Enjoy it 🎉</h3>
                <p className="mt-1.5 mb-0 text-sm text-[#93a3a6]">{receipt.message}</p>

                {receipt.rescued?.length > 0 && (
                  <div className="mt-4 rounded-xl border border-[#3ddc84]/40 bg-[rgba(61,220,132,0.08)] p-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-widest text-[#3ddc84]">
                      Saved from the bin
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {receipt.rescued.map((item) => (
                        <span
                          key={item.ingredient_id}
                          className="rounded-full bg-[#1c2427] px-3 py-1 text-sm text-[#eef3f3]"
                        >
                          {item.name}
                          <span className="ml-1.5 font-mono text-[10px] text-[#93a3a6]">
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
                    className="rounded-full bg-[#56d9c8] px-5 py-2.5 text-sm font-semibold text-[#06201d]"
                  >
                    Back to my fridge
                  </button>
                  <button
                    type="button"
                    onClick={undo}
                    disabled={busy}
                    className="rounded-full border border-[#2a3438] px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    {busy ? "Putting back…" : "Undo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-widest text-[#61706f]">
                    Method
                  </h3>
                  <ol className="m-0 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-[#93a3a6]">
                    {recipe.steps.map((step) => (
                      <li key={step.index}>
                        {step.text}
                        {step.timer_seconds ? (
                          <span className="ml-1.5 font-mono text-[10px] text-[#56d9c8]">
                            {Math.round(step.timer_seconds / 60)} min
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-widest text-[#61706f]">
                    Ingredients
                  </h3>
                  <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
                    {recipe.ingredients.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <span className={item.in_fridge ? "text-[#eef3f3]" : "text-[#61706f]"}>
                          {item.raw_text}
                        </span>
                        {item.in_fridge ? (
                          <FreshnessBadge freshness={item.freshness} />
                        ) : (
                          <span className="font-mono text-[10px] text-[#ff8fb1]">need</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {recipe.consumes.length > 0 && (
                    <div className="mt-5 rounded-xl border border-[#2a3438] p-3.5">
                      <p className="m-0 mb-2 text-xs text-[#93a3a6]">
                        Cooking this takes these out. Staples stay — you don&apos;t run out of salt
                        because you cooked one dish.
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
                              className="h-3.5 w-3.5 accent-[#3ddc84]"
                            />
                            <span className="flex-1 text-[#eef3f3]">{row.name}</span>
                            {row.is_staple && (
                              <span className="font-mono text-[10px] text-[#61706f]">staple</span>
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
                    className="mt-4 w-full rounded-full bg-[#3ddc84] px-5 py-2.5 text-sm font-semibold text-[#06210f] disabled:opacity-40"
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
