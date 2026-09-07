import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import NutritionPanel from "../components/NutritionPanel";
import WorldMap from "../components/WorldMap";
import { useToast } from "../components/useToast";

/**
 * Cuisine Map Explorer — browse the library country by country.
 */
export default function CuisineMap() {
  const [countries, setCountries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const response = await api.cuisines();
        setCountries(response.data);
        setMeta(response.meta);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    load();
  }, [showToast]);

  const openCountry = useCallback(
    async (country) => {
      setSelected(country);
      setLoadingRecipes(true);
      try {
        const response = await api.cuisine(country.code);
        setRecipes(response.data);
      } catch (error) {
        showToast(error.message, "error");
        setRecipes([]);
      } finally {
        setLoadingRecipes(false);
      }
    },
    [showToast]
  );

  const visible = region ? countries.filter((country) => country.region === region) : countries;
  const withRecipes = [...visible]
    .filter((country) => country.recipe_count > 0)
    .sort((a, b) => b.recipe_count - a.recipe_count);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6">
        <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--brand)]">
          Cuisine Map Explorer
        </span>
        <h1 className="mt-2 mb-2 font-[var(--font-display)] text-3xl font-black text-[var(--text)]">
          Travel the world, one recipe at a time
        </h1>
        {meta && (
          <p className="m-0 text-sm text-[var(--muted)]">
            {meta.total_recipes} recipes across {meta.countries_with_recipes} countries. Tap a pin to explore.
          </p>
        )}
      </header>

      {meta && (
        <div className="mb-5 flex flex-wrap gap-2">
          <RegionChip label="All regions" active={region === ""} onClick={() => setRegion("")} />
          {meta.regions.map((name) => (
            <RegionChip
              key={name}
              label={name}
              active={region === name}
              onClick={() => setRegion(region === name ? "" : name)}
            />
          ))}
        </div>
      )}

      <WorldMap countries={visible} selected={selected?.code} onSelect={openCountry} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <h2 className="mb-3 mt-0 text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
            Countries with recipes
          </h2>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {withRecipes.map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  onClick={() => openCountry(country)}
                  className={`flex w-full items-center justify-between rounded-[var(--r-sm)] px-3 py-2 text-left text-sm ${
                    selected?.code === country.code
                      ? "bg-[var(--brand-glow)] font-semibold text-[var(--brand-deep)]"
                      : "hover:bg-[rgba(20,24,27,0.05)]"
                  }`}
                >
                  <span>{country.name}</span>
                  <small className="text-[var(--muted-light)]">{country.recipe_count}</small>
                </button>
              </li>
            ))}
            {withRecipes.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No recipes in this region yet.</li>
            )}
          </ul>
        </aside>

        <section>
          {!selected ? (
            <div className="grid place-items-center rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] p-14 text-center">
              <div className="text-4xl">🗺️</div>
              <p className="mt-3 mb-0 max-w-sm text-sm text-[var(--muted)]">
                Pick a country on the map or in the list to see what its cooks have shared.
              </p>
            </div>
          ) : (
            <>
              <header className="mb-4">
                <h2 className="m-0 font-[var(--font-display)] text-2xl font-black text-[var(--text)]">
                  {selected.name}
                </h2>
                <p className="m-0 text-sm text-[var(--muted)]">
                  {selected.region} · {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
                </p>
              </header>

              {loadingRecipes ? (
                <p className="text-sm text-[var(--muted)]">Loading recipes…</p>
              ) : recipes.length === 0 ? (
                <p className="rounded-[var(--r-md)] border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--muted)]">
                  No recipes from {selected.name} yet — be the first to add one.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {recipes.map((recipe) => (
                    <article
                      key={recipe.id}
                      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-xs)]"
                    >
                      <div>
                        <h3 className="m-0 text-base font-bold text-[var(--text)]">{recipe.title}</h3>
                        <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                          by {recipe.user?.name} · {recipe.difficulty}
                          {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ""}
                        </p>
                      </div>
                      <p className="m-0 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">
                        {recipe.description}
                      </p>
                      <NutritionPanel nutrition={recipe.nutrition} compact />
                      <Link
                        to={`/recipes/${recipe.id}/cook`}
                        className="mt-auto w-fit rounded-[var(--r-pill)] bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white"
                      >
                        Start cooking
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function RegionChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--r-pill)] border px-4 py-1.5 text-sm ${
        active
          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
          : "border-[var(--border-strong)] hover:border-[var(--brand)]"
      }`}
    >
      {label}
    </button>
  );
}
