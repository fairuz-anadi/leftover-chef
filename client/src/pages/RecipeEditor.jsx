import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/api";
import { useToast } from "../components/useToast";

// Mirrors ProfileController::DIETS on the API side.
const DIET_TAGS = [
  "vegetarian", "vegan", "pescatarian", "halal", "kosher",
  "gluten-free", "dairy-free", "nut-free", "low-carb", "high-protein",
];

function linesToArray(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sameUserId(left, right) {
  return String(left) === String(right);
}

export default function RecipeEditor({ user }) {
  const navigate = useNavigate();
  const { recipeId } = useParams();
  const isEditing = Boolean(recipeId);
  const { showToast } = useToast();
  const [form, setForm] = useState({
    title: "",
    description: "",
    ingredients: "",
    instructions: "",
    categories: [],
    cuisine_code: "",
    difficulty: "beginner",
    prep_minutes: 10,
    cook_minutes: 20,
    servings: 2,
    diet_tags: [],
    image: null,
    image_url: "",
    remove_image: false,
  });
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(isEditing);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    api.categories().then((response) => setCategories(response.data)).catch(() => {});
    api.cuisines().then((response) => setCountries(response.data)).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isEditing) return;

    setLoadingRecipe(true);
    api
      .recipe(recipeId)
      .then((response) => {
        const recipe = response.data;
        if (!sameUserId(recipe.user_id, user.id)) {
          navigate("/recipes");
          return;
        }

        setForm({
          title: recipe.title,
          description: recipe.description,
          ingredients: (recipe.ingredients || []).join("\n"),
          instructions: (recipe.instructions || []).join("\n"),
          categories: (recipe.categories || []).map((item) => item.name),
          cuisine_code: recipe.cuisine_code || "",
          difficulty: recipe.difficulty || "beginner",
          prep_minutes: recipe.prep_minutes ?? 10,
          cook_minutes: recipe.cook_minutes ?? 20,
          servings: recipe.servings ?? 2,
          diet_tags: recipe.diet_tags || [],
          image: null,
          image_url: recipe.image_url || "",
          remove_image: false,
        });
        setPreviewUrl(recipe.image_url || "");
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoadingRecipe(false));
  }, [isEditing, recipeId, user.id, navigate]);

  function toggleCategory(name) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(name)
        ? current.categories.filter((item) => item !== name)
        : [...current.categories, name],
    }));
  }

  function toggleDiet(tag) {
    setForm((current) => ({
      ...current,
      diet_tags: current.diet_tags.includes(tag)
        ? current.diet_tags.filter((item) => item !== tag)
        : [...current.diet_tags, tag],
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null;
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setForm((current) => ({
      ...current,
      image: file,
      remove_image: false,
    }));

    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setPreviewUrl(form.image_url || "");
  }

  function handleRemoveImage() {
    setForm((current) => ({
      ...current,
      image: null,
      image_url: "",
      remove_image: true,
    }));
    setPreviewUrl("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api.saveRecipe(
        {
          title: form.title,
          description: form.description,
          ingredients: linesToArray(form.ingredients),
          instructions: linesToArray(form.instructions),
          categories: form.categories,
          cuisine_code: form.cuisine_code,
          difficulty: form.difficulty,
          prep_minutes: Number(form.prep_minutes),
          cook_minutes: Number(form.cook_minutes),
          servings: Number(form.servings),
          diet_tags: form.diet_tags,
          image: form.image,
          remove_image: form.remove_image,
        },
        recipeId
      );
      showToast(isEditing ? "Recipe updated successfully." : "Uploaded recipe successfully.");
      navigate(isEditing ? "/profile" : "/recipes");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingRecipe) {
    return <div className="feedback">Loading selected recipe...</div>;
  }

  return (
    <div className="simple-page">
      <p className="eyebrow">{isEditing ? "Update Recipe" : "Share Recipe"}</p>
      <h1>{isEditing ? "Edit your recipe" : "Publish a new community recipe"}</h1>
      {isEditing && (
        <div className="section-row">
          <p className="muted">You are editing only the recipe you selected.</p>
          <Link className="button button--ghost" to="/profile">
            Back to Dashboard
          </Link>
        </div>
      )}
      <form className="stack-form recipe-form" onSubmit={handleSubmit}>
        <input
          placeholder="Recipe title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          required
        />
        <textarea
          placeholder="Short description"
          rows="4"
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          required
        />
        <textarea
          placeholder="Ingredients, one per line"
          rows="6"
          value={form.ingredients}
          onChange={(event) =>
            setForm((current) => ({ ...current, ingredients: event.target.value }))
          }
          required
        />
        <textarea
          placeholder="Instructions, one step per line"
          rows="6"
          value={form.instructions}
          onChange={(event) =>
            setForm((current) => ({ ...current, instructions: event.target.value }))
          }
          required
        />
        <div>
          <p className="field-label">Categories</p>
          <div className="chip-row">
            {categories.map((category) => (
              <button
                className={`chip chip--button ${
                  form.categories.includes(category.name) ? "chip--active" : ""
                }`}
                key={category.id}
                onClick={() => toggleCategory(category.name)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Cuisine &amp; timing</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-[var(--muted)]">Country of origin</span>
              <select
                value={form.cuisine_code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cuisine_code: event.target.value }))
                }
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              >
                <option value="">Not specified</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-[var(--muted)]">Difficulty</span>
              <select
                value={form.difficulty}
                onChange={(event) =>
                  setForm((current) => ({ ...current, difficulty: event.target.value }))
                }
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-[var(--muted)]">Prep minutes</span>
              <input
                type="number"
                min="0"
                max="1440"
                value={form.prep_minutes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, prep_minutes: event.target.value }))
                }
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-[var(--muted)]">Cook minutes</span>
              <input
                type="number"
                min="0"
                max="1440"
                value={form.cook_minutes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cook_minutes: event.target.value }))
                }
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-[var(--muted)]">Servings</span>
              <input
                type="number"
                min="1"
                max="50"
                value={form.servings}
                onChange={(event) =>
                  setForm((current) => ({ ...current, servings: event.target.value }))
                }
                className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--muted-light)]">
            Nutrition per serving is calculated from your ingredient list once you save.
          </p>
        </div>

        <div>
          <p className="field-label">Dietary tags</p>
          <div className="chip-row">
            {DIET_TAGS.map((tag) => (
              <button
                className={`chip chip--button ${form.diet_tags.includes(tag) ? "chip--active" : ""}`}
                key={tag}
                onClick={() => toggleDiet(tag)}
                type="button"
              >
                {tag.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="stack-form stack-form--tight">
          <div>
            <p className="field-label">Recipe Image</p>
            <input accept="image/*" onChange={handleImageChange} type="file" />
          </div>
          {previewUrl && (
            <div className="recipe-upload-preview">
              <img alt="Recipe preview" className="recipe-upload-preview__image" src={previewUrl} />
              <button className="button button--ghost" onClick={handleRemoveImage} type="button">
                Remove Image
              </button>
            </div>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="button" disabled={saving} type="submit">
          {saving ? "Saving..." : isEditing ? "Update Recipe" : "Upload Recipe"}
        </button>
      </form>
    </div>
  );
}
