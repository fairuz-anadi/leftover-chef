import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import RecipePanel from "../components/RecipePanel";
import { useToast } from "../components/useToast";

const DIET_TAGS = [
  "vegetarian", "vegan", "pescatarian", "halal", "kosher",
  "gluten-free", "dairy-free", "nut-free", "low-carb", "high-protein",
];

export default function RecipeLibrary({ user, onRequireAuth }) {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    categories: [],
    diets: [],
    cuisine: "",
    difficulty: "",
    max_minutes: "",
    page: 1,
  });
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .cuisines()
      .then((response) => setCountries(response.data.filter((item) => item.recipe_count > 0)))
      .catch(() => {});
  }, []);

  const loadRecipes = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const [recipeResponse, categoryResponse] = await Promise.all([
        api.recipes(nextFilters),
        categories.length ? Promise.resolve({ data: categories }) : api.categories(),
      ]);
      setRecipes(recipeResponse.data);
      setMeta(recipeResponse.meta);
      if (!categories.length) setCategories(categoryResponse.data);
    } catch (loadError) {
      setError(loadError.message);
      showToast(loadError.message, "error");
    } finally {
      setLoading(false);
    }
  }, [categories, filters, showToast]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  function toggleCategory(name) {
    const nextFilters = {
      ...filters,
      page: 1,
      categories: filters.categories.includes(name)
        ? filters.categories.filter((item) => item !== name)
        : [...filters.categories, name],
    };
    setFilters(nextFilters);
    loadRecipes(nextFilters);
  }

  function toggleDiet(tag) {
    const nextFilters = {
      ...filters,
      page: 1,
      diets: filters.diets.includes(tag)
        ? filters.diets.filter((item) => item !== tag)
        : [...filters.diets, tag],
    };
    setFilters(nextFilters);
    loadRecipes(nextFilters);
  }

  function setFilter(key, value) {
    const nextFilters = { ...filters, page: 1, [key]: value };
    setFilters(nextFilters);
    loadRecipes(nextFilters);
  }

  function handleSearch(event) {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    loadRecipes(nextFilters);
  }

  function handlePageChange(page) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    loadRecipes(nextFilters);
  }

  return (
    <div className="simple-page">
      <div className="section-row">
        <div>
          <p className="eyebrow">Recipe Library</p>
          <h1>Find, rate, and review community recipes.</h1>
        </div>
        <Link className="button button--secondary" to="/fridge">
          Search by ingredients
        </Link>
      </div>

      <form className="filter-panel" onSubmit={handleSearch}>
        <input
          placeholder="Search by recipe name"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <button className="button" type="submit">
          Search
        </button>
      </form>

      <div className="chip-row">
        {categories.map((category) => (
          <button
            className={`chip chip--button ${
              filters.categories.includes(category.name) ? "chip--active" : ""
            }`}
            key={category.id}
            onClick={() => toggleCategory(category.name)}
            type="button"
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="my-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--muted)]">Cuisine</span>
          <select
            value={filters.cuisine}
            onChange={(event) => setFilter("cuisine", event.target.value)}
            className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
          >
            <option value="">Every country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.recipe_count})
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--muted)]">Difficulty</span>
          <select
            value={filters.difficulty}
            onChange={(event) => setFilter("difficulty", event.target.value)}
            className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
          >
            <option value="">Any</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="text-[var(--muted)]">Ready within</span>
          <select
            value={filters.max_minutes}
            onChange={(event) => setFilter("max_minutes", event.target.value)}
            className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-3 py-2"
          >
            <option value="">Any time</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="90">90 minutes</option>
          </select>
        </label>
      </div>

      <div className="chip-row">
        {DIET_TAGS.map((tag) => (
          <button
            className={`chip chip--button ${filters.diets.includes(tag) ? "chip--active" : ""}`}
            key={tag}
            onClick={() => toggleDiet(tag)}
            type="button"
          >
            {tag.replace("-", " ")}
          </button>
        ))}
      </div>

      {error && <div className="feedback feedback--error">{error}</div>}
      {loading ? (
        <div className="feedback">Loading recipes...</div>
      ) : recipes.length === 0 ? (
        <div className="feedback">No recipes matched your search.</div>
      ) : (
        <>
          <div className="recipe-list">
            {recipes.map((recipe) => (
              <RecipePanel
                key={recipe.id}
                recipe={recipe}
                user={user}
                onDeleted={() => loadRecipes()}
                onChanged={() => loadRecipes()}
                onRequireAuth={onRequireAuth}
              />
            ))}
          </div>

          {meta?.last_page > 1 && (
            <div className="pagination-bar">
              <button
                className="button button--ghost"
                disabled={meta.current_page <= 1}
                onClick={() => handlePageChange(meta.current_page - 1)}
                type="button"
              >
                Previous
              </button>
              <span className="pagination-bar__status">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <button
                className="button button--ghost"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => handlePageChange(meta.current_page + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
