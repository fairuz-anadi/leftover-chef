import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import ConfirmModal from "./ConfirmModal";
import NutritionPanel from "./NutritionPanel";
import StarRating from "./StarRating";
import TipModal from "./TipModal";
import { useToast } from "./useToast";

function sameUserId(left, right) {
  return String(left) === String(right);
}

function ReviewForm({ recipe, onSaved }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!rating) {
      setError("Please choose a star rating before submitting.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.submitReview(recipe.id, { rating, comment });
      setRating(0);
      setComment("");
      showToast("Submitted review successfully.");
      onSaved?.();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack-form stack-form--tight review-form" onSubmit={handleSubmit}>
      <div className="review-form__top">
        <div>
          <p className="field-label">Your Rating</p>
          <StarRating interactive label="Choose a rating" onChange={setRating} value={rating} />
        </div>
        <button className="button button--secondary" disabled={saving} type="submit">
          {saving ? "Saving..." : "Submit Review"}
        </button>
      </div>
      <textarea
        placeholder="Add a review comment"
        rows="3"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

export default function RecipePanel({
  recipe,
  user,
  onDeleted,
  onChanged,
  onRequireAuth,
  showAdminActions = false,
}) {
  const [busy, setBusy] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const canEdit = user && sameUserId(user.id, recipe.user_id);
  const canReview = user && !sameUserId(user.id, recipe.user_id);
  const isFavorited = Boolean(recipe.favorited_by_auth_user);
  const reviewCount = recipe.reviews_count || recipe.reviews?.length || 0;
  const averageRating = Number(recipe.average_rating || 0);
  const { showToast } = useToast();

  async function runDelete() {
    setBusy(true);
    try {
      await api.deleteRecipe(recipe.id);
      showToast("Deleted recipe successfully.");
      onDeleted?.();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
      setConfirmState(null);
    }
  }

  async function runAdminDeleteRecipe() {
    setBusy(true);
    try {
      await api.adminDeleteRecipe(recipe.id);
      showToast("Deleted recipe successfully.");
      onDeleted?.();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
      setConfirmState(null);
    }
  }

  async function runAdminDeleteUser() {
    setBusy(true);
    try {
      await api.adminDeleteUser(recipe.user_id);
      showToast("Deleted user successfully.");
      onDeleted?.();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
      setConfirmState(null);
    }
  }

  async function handleFavoriteToggle() {
    if (!user) {
      onRequireAuth?.();
      return;
    }

    setFavoriteBusy(true);
    try {
      if (isFavorited) {
        await api.unfavoriteRecipe(recipe.id);
        showToast("Removed recipe from favorites.");
      } else {
        await api.favoriteRecipe(recipe.id);
        showToast("Added recipe to favorites.");
      }
      onChanged?.();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setFavoriteBusy(false);
    }
  }

  return (
    <article className="recipe-card">
      {showTipModal && (
        <TipModal
          user={recipe.user}
          onClose={() => setShowTipModal(false)}
          onSuccess={() => setShowTipModal(false)}
        />
      )}
      <ConfirmModal
        busy={busy}
        cancelLabel="No"
        confirmLabel="Yes"
        danger
        message={confirmState?.message || ""}
        title={confirmState?.title || "Confirm Action"}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmState?.action}
        open={Boolean(confirmState)}
      />

      <div className="recipe-card__hero">
        <div className="recipe-card__image-wrap">
          {recipe.image_url ? (
            <img alt={recipe.title} className="recipe-card__image" src={recipe.image_url} />
          ) : (
            <div className="recipe-card__image recipe-card__image--placeholder">
              <span>Fresh from the community kitchen</span>
            </div>
          )}
        </div>

        <div className="recipe-card__body">
          <div className="recipe-card__topbar">
            <div className="chip-row">
              {recipe.categories?.map((category) => (
                <span className="chip" key={category.id || category.name}>
                  {category.name}
                </span>
              ))}
            </div>

            {!canEdit && (
              <div className="recipe-card__actions">
                <button
                  className={`button recipe-card__favorite ${isFavorited ? "button--ghost" : "button--secondary"}`}
                  disabled={favoriteBusy}
                  onClick={handleFavoriteToggle}
                  type="button"
                >
                  {favoriteBusy ? "Saving..." : isFavorited ? "Favorited" : "Add Favorite"}
                </button>
                {user && (
                  <button
                    className="button button--tip"
                    onClick={() => setShowTipModal(true)}
                    type="button"
                  >
                    ☕ Coffee
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="recipe-card__header">
            <div>
              <div className="recipe-card__title-row">
                <h2>{recipe.title}</h2>
                <div className="recipe-card__rating-inline">
                  <StarRating label={`${averageRating} out of 5 stars`} size="sm" value={averageRating} />
                  <span>{averageRating.toFixed(1)}</span>
                </div>
              </div>
              <p>{recipe.description}</p>
              <div className="meta-row">
                <span>By {recipe.user?.name || "Unknown"}</span>
                <span>{reviewCount} reviews</span>
                {recipe.cuisine_country && <span>{recipe.cuisine_country}</span>}
                {recipe.difficulty && <span className="capitalize">{recipe.difficulty}</span>}
                {recipe.total_minutes ? <span>{recipe.total_minutes} min</span> : null}
                {recipe.servings ? <span>Serves {recipe.servings}</span> : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  className="rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white"
                  to={`/recipes/${recipe.id}/cook`}
                >
                  Start cook mode
                </Link>
                <NutritionPanel nutrition={recipe.nutrition} compact />
              </div>
            </div>

            {canEdit && (
              <div className="section-row section-row--tight recipe-card__owner-actions">
                <Link className="button button--ghost" to={`/recipes/${recipe.id}/edit`}>
                  Edit
                </Link>
                <button
                  className="button button--ghost"
                  disabled={busy}
                  onClick={() =>
                    setConfirmState({
                      title: "Delete Recipe",
                      message: "Delete recipe?",
                      action: runDelete,
                    })
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="detail-grid">
            <div>
              <h3>Ingredients</h3>
              <ul className="detail-list">
                {(recipe.ingredients || []).map((ingredient, index) => (
                  <li key={`${recipe.id}-ingredient-${index}`}>{ingredient}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Instructions</h3>
              <ol className="detail-list">
                {(recipe.instructions || []).map((instruction, index) => (
                  <li key={`${recipe.id}-instruction-${index}`}>{instruction}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <section className="review-block">
        <div className="section-row">
          <div>
            <h3>Reviews</h3>
            {/* <p className="muted">Rate this recipe using the 5-star system.</p> */}
          </div>
          {!user && (
            <button className="button button--ghost" onClick={onRequireAuth} type="button">
              Log in to review
            </button>
          )}
        </div>

        <div className="review-list">
          {recipe.reviews?.length ? (
            recipe.reviews.map((review) => (
              <div className="review-item" key={review.id}>
                <div className="section-row section-row--tight">
                  <strong>{review.user?.name || "User"}</strong>
                  <div className="recipe-card__rating-inline">
                    <StarRating label={`${review.rating} out of 5 stars`} size="sm" value={review.rating} />
                    <span>{Number(review.rating).toFixed(1)}</span>
                  </div>
                </div>
                <p>{review.comment || "No written review."}</p>
              </div>
            ))
          ) : (
            <p className="muted">No reviews yet.</p>
          )}
        </div>

        {canReview && <ReviewForm recipe={recipe} onSaved={onChanged} />}
      </section>

      {showAdminActions && (
        <div className="section-row">
          <button
            className="button button--ghost"
            disabled={busy}
            onClick={() =>
              setConfirmState({
                title: "Delete Recipe",
                message: "Delete recipe?",
                action: runAdminDeleteRecipe,
              })
            }
            type="button"
          >
            Admin Delete Recipe
          </button>
          <button
            className="button button--ghost"
            disabled={busy}
            onClick={() =>
              setConfirmState({
                title: "Delete User",
                message: `Delete user ${recipe.user?.name || ""}?`,
                action: runAdminDeleteUser,
              })
            }
            type="button"
          >
            Admin Delete User
          </button>
        </div>
      )}
    </article>
  );
}
