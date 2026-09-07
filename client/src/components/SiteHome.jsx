import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import kitchenBoard from "../assets/home.jpg";

function getRecipeCountLabel(count) {
  return `${count} ${count === 1 ? "recipe" : "recipes"}`;
}

function getLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function RecipeImage({ recipe, className, alt }) {
  if (!recipe?.image_url) {
    return null;
  }

  return <img alt={alt || recipe.title} className={className} src={recipe.image_url} />;
}

function RecipeShelf({ title, description, recipes = [], variant = "default", user, onOpenAuth }) {
  const isTopRail = variant === "top10";
  const emptyCopy = isTopRail
    ? {
        eyebrow: "Ranking room",
        title: "Top recipes will appear here.",
        body: "Once the community starts rating dishes, the highest-rated recipes will take the spotlight.",
        action: "Share the first recipe",
      }
    : {
        eyebrow: "Fresh from the kitchen",
        title: "The next great recipe starts with you.",
        body: "Share a dish with the community and it will appear in this fresh-recipe collection.",
        action: "Share a recipe",
      };

  return (
    <section className={`recipe-shelf ${isTopRail ? "recipe-shelf--top10" : ""}`}>
      <div className="section-row">
        <div>
          <p className="eyebrow">{isTopRail ? "Top 10 Now Cooking" : title}</p>
          <h2>{title}</h2>
          <p className="section-copy">{description}</p>
        </div>
        <Link className="link-button" to="/recipes">
          View all recipes
        </Link>
      </div>

      {recipes.length ? <div
        className={`recipe-shelf__track ${isTopRail ? "recipe-shelf__track--top10" : ""}`}
        aria-label={title}
      >
          {recipes.map((recipe, index) => (
            <article
              className={`recipe-shelf__card ${isTopRail ? "recipe-shelf__card--top10" : ""}`}
              key={`${title}-${recipe.id}`}
            >
              {isTopRail ? (
                <div className="recipe-shelf__rank-wrap">
                  <span className="recipe-shelf__rank" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="recipe-shelf__poster">
                    <RecipeImage
                      recipe={recipe}
                      className="recipe-shelf__poster-image"
                      alt={recipe.title}
                    />
                    <div className="recipe-shelf__media recipe-shelf__media--top10">
                      <div className="recipe-shelf__topline">
                        <span className="recipe-shelf__badge">
                          {recipe.categories?.[0]?.name || "Chef's Pick"}
                        </span>
                        <div className="recipe-shelf__rating">
                          <span>&#9733;</span>
                          <strong>{Number(recipe.average_rating || 0).toFixed(1)}</strong>
                        </div>
                      </div>

                      <div className="recipe-shelf__headline">
                        <p className="recipe-shelf__kicker">Top recipe #{index + 1}</p>
                        <h3 className="recipe-shelf__title">{recipe.title}</h3>
                        <p className="recipe-shelf__description">{recipe.description}</p>
                      </div>

                      <div className="recipe-shelf__footer">
                        <span className="recipe-shelf__author">
                          By {recipe.user?.name || "Unknown chef"}
                        </span>
                        <span className="recipe-shelf__reviews">
                          {recipe.reviews_count ?? recipe.reviews?.length ?? 0} reviews
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="recipe-shelf__media">
                    <RecipeImage
                      recipe={recipe}
                      className="recipe-shelf__media-image"
                      alt={recipe.title}
                    />
                    <span className="recipe-shelf__badge">
                      {recipe.categories?.[0]?.name || "Chef's Pick"}
                    </span>
                    <div className="recipe-shelf__rating">
                      <span>&#9733;</span>
                      <strong>{Number(recipe.average_rating || 0).toFixed(1)}</strong>
                    </div>
                  </div>

                  <div className="recipe-shelf__body">
                    <h3>{recipe.title}</h3>
                    <p>{recipe.description}</p>

                    <div className="chip-row">
                      {(recipe.categories || []).slice(0, 3).map((category) => (
                        <span className="chip" key={category.id ?? category.name}>
                          {category.name}
                        </span>
                      ))}
                    </div>

                    <div className="recipe-shelf__meta">
                      <span>By {recipe.user?.name || "Unknown chef"}</span>
                      <span>{recipe.reviews_count ?? recipe.reviews?.length ?? 0} reviews</span>
                    </div>
                  </div>
                </>
              )}

              {isTopRail && (
                <div className="recipe-shelf__top10-tags">
                  {(recipe.categories || []).slice(0, 3).map((category) => (
                    <span className="chip" key={category.id ?? category.name}>
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
      </div> : (
        <div className="recipe-shelf__empty">
          <div className="recipe-shelf__empty-art" aria-hidden="true">
            <span>1</span><span>2</span><span>3</span>
            <svg viewBox="0 0 86 70" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 42c5-15 14-22 25-22s20 7 25 22"/><path d="M13 42h60l-5 14H18l-5-14Z" strokeLinejoin="round"/><path d="M30 32c-4-6-2-13 4-17 3 6 2 13-4 17ZM43 26c-2-7 2-13 8-15 1 7-2 13-8 15ZM54 34c-2-6 2-11 8-13 0 6-3 11-8 13Z" fill="currentColor"/></svg>
          </div>
          <div>
            <p className="eyebrow">{emptyCopy.eyebrow}</p>
            <h3>{emptyCopy.title}</h3>
            <p>{emptyCopy.body}</p>
          </div>
          {user ? (
            <Link className="button button--ghost" to="/recipes/new">{emptyCopy.action}</Link>
          ) : (
            <button className="button button--ghost" onClick={() => onOpenAuth?.("signup")} type="button">
              {emptyCopy.action}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function SiteHome({ user, onOpenAuth }) {
  const [leaderboards, setLeaderboards] = useState({
    top_users: [],
    top_recipes: [],
    trending_categories: [],
    rising_chef: null,
    platform_stats: { recipes: 0, reviews: 0, categories: 0, chefs: 0 },
  });
  const [recentRecipes, setRecentRecipes] = useState([]);

  useEffect(() => {
    let active = true;

    api.leaderboards()
      .then((leaderboardData) => {
        if (active) {
          setLeaderboards(leaderboardData);
        }
      })
      .catch(() => {});

    api.recipes()
      .then((recipeData) => {
        if (active) {
          setRecentRecipes((recipeData?.data || []).slice(0, 10));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const featuredRecipe = leaderboards.top_recipes[0] || recentRecipes[0] || null;
  const topUsers = leaderboards.top_users.slice(0, 5);
  const trendingCategories = leaderboards.trending_categories || [];
  const risingChef = leaderboards.rising_chef;
  const platformStats = leaderboards.platform_stats || {
    recipes: 0,
    reviews: 0,
    categories: 0,
    chefs: 0,
  };
  const hasCommunityActivity = topUsers.length || trendingCategories.length || risingChef || recentRecipes.length;
  const topRecipes = leaderboards.top_recipes.length
    ? leaderboards.top_recipes
    : [...recentRecipes].sort((left, right) => {
        const ratingDifference = Number(right.average_rating || 0) - Number(left.average_rating || 0);
        return ratingDifference || (right.reviews_count || 0) - (left.reviews_count || 0);
      });

  return (
    <div className="page-grid home-page">
      <section className="hero-panel home-hero">
        <div className="home-hero__content">
          <p className="eyebrow">Cook. Share. Waste less.</p>
          <h1>Tell us what&apos;s in your fridge. We&apos;ll tell you what to cook.</h1>
          <p className="section-copy">
            Add the ingredients you already have and Leftover Chef ranks every recipe by
            how much of it you can make right now — then walks you through it step by
            step, timers and all.
          </p>

          <div className="hero-actions">
            <Link className="button" to="/fridge">
              Search My Fridge
            </Link>
            <Link className="button button--ghost" to="/cuisines">
              Explore the Cuisine Map
            </Link>
            {user ? (
              <Link className="button button--secondary" to="/recipes/new">
                Share a Recipe
              </Link>
            ) : (
              <button
                className="button button--secondary"
                onClick={() => onOpenAuth("signup")}
                type="button"
              >
                Join Free
              </button>
            )}
          </div>

          <div className="home-hero__stats">
            <div className="home-stat-pill">
              <span className="home-stat-pill__icon" aria-hidden="true">⌁</span>
              <div>
                <strong>{getRecipeCountLabel(platformStats.recipes)}</strong>
                <span>Total recipes</span>
              </div>
            </div>
            <div className="home-stat-pill">
              <span className="home-stat-pill__icon" aria-hidden="true">◇</span>
              <div>
                <strong>{getLabel(platformStats.categories, "category", "categories")}</strong>
                <span>Collections</span>
              </div>
            </div>
            <div className="home-stat-pill">
              <span className="home-stat-pill__icon" aria-hidden="true">✦</span>
              <div>
                <strong>{getLabel(platformStats.reviews, "review", "reviews")}</strong>
                <span>Community reviews</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-card home-hero__feature">
          <p className="eyebrow">Featured Recipe</p>
          {featuredRecipe ? (
            <>
              <RecipeImage
                recipe={featuredRecipe}
                className="home-feature__image"
                alt={featuredRecipe.title}
              />
              <h2>{featuredRecipe.title}</h2>
              <p className="section-copy">{featuredRecipe.description}</p>

              <div className="chip-row">
                {(featuredRecipe.categories || []).slice(0, 3).map((category) => (
                  <span className="chip" key={category.id ?? category.name}>
                    {category.name}
                  </span>
                ))}
              </div>

              <div className="home-feature__footer">
                <span>By {featuredRecipe.user?.name || "Unknown chef"}</span>
                <strong>{Number(featuredRecipe.average_rating || 0).toFixed(1)} / 5</strong>
              </div>
            </>
          ) : (
            <div className="home-feature__empty">
              <div className="home-feature__art" aria-hidden="true">
                <svg viewBox="0 0 240 190" fill="none">
                  <path d="M49 121c15-39 41-59 71-59s56 20 71 59" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M39 121h162l-13 36H52l-13-36Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M78 87c-10-13-6-31 7-39 8 14 5 30-7 39ZM119 70c-5-16 4-31 19-36 3 16-5 30-19 36ZM157 89c-4-16 6-29 21-32 1 16-7 28-21 32Z" fill="currentColor" opacity=".85" />
                  <circle cx="83" cy="114" r="8" fill="currentColor" opacity=".8" />
                  <circle cx="121" cy="101" r="7" fill="currentColor" opacity=".7" />
                  <circle cx="157" cy="114" r="9" fill="currentColor" opacity=".8" />
                </svg>
              </div>
              <span className="home-feature__status">Your next meal</span>
              <h2>A better dinner plan starts with your fridge.</h2>
              <p className="section-copy">Add a few ingredients and we&apos;ll surface recipes that are ready to make right now.</p>
              <Link className="home-feature__cta" to="/fridge">Build my fridge <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </div>
      </section>

      <section className="home-discover" aria-labelledby="discover-heading">
        <article className="home-discover__image-card">
          <img alt="Fresh ingredients and a prepared vegetable dish" loading="lazy" src={kitchenBoard} />
          <div className="home-discover__image-copy">
            <span>Use what you have</span>
            <strong>Less waste.<br />More flavor.</strong>
          </div>
        </article>
        <div className="home-discover__content">
          <p className="eyebrow">The Leftover Chef method</p>
          <h2 id="discover-heading">A calm, practical way to decide what&apos;s for dinner.</h2>
          <p className="section-copy">Skip endless searching. Start with the ingredients in your kitchen and turn them into a plan you can actually make.</p>
          <div className="home-discover__points">
            <div><span>01</span><p><strong>Start in your fridge</strong> — add what&apos;s already on hand.</p></div>
            <div><span>02</span><p><strong>Choose your match</strong> — filter by time, diet or cuisine.</p></div>
            <div><span>03</span><p><strong>Cook with a plan</strong> — use guided steps and smart lists.</p></div>
          </div>
          <Link className="home-discover__link" to="/fridge">Try ingredient matching <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="home-workflow" aria-labelledby="workflow-heading">
        <div className="home-workflow__intro">
          <p className="eyebrow">Cook with confidence</p>
          <h2 id="workflow-heading">From fridge to plate in three clear steps.</h2>
          <p className="section-copy">A focused cooking flow that helps you use what you already have before buying more.</p>
        </div>
        <div className="home-workflow__steps">
          <article className="home-workflow__step" data-step="01">
            <span className="home-workflow__number">01</span>
            <span className="home-workflow__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 8h14v11H5z" /><path d="M7 8V5.5a5 5 0 0 1 10 0V8M8 13h8M12 10v6" /></svg>
            </span>
            <h3>Add what you have</h3>
            <p>Build your saved fridge in seconds, or make a one-time list as a guest.</p>
          </article>
          <article className="home-workflow__step" data-step="02">
            <span className="home-workflow__number">02</span>
            <span className="home-workflow__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M8 11h6M11 8v6" /></svg>
            </span>
            <h3>Find your best match</h3>
            <p>See recipes ranked by the ingredients you already have and the time you have.</p>
          </article>
          <article className="home-workflow__step" data-step="03">
            <span className="home-workflow__number">03</span>
            <span className="home-workflow__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 4h12v16H6z" /><path d="m9 12 2 2 4-5" /></svg>
            </span>
            <h3>Cook without guesswork</h3>
            <p>Follow guided steps, timers, servings, nutrition and a smart shopping list.</p>
          </article>
        </div>
      </section>

      {hasCommunityActivity ? <>
      <section className="home-highlights">
        <div className="leaderboard-card">
          <p className="eyebrow">Top Users</p>
          <h2>Community leaderboard</h2>
          <ol>
            {topUsers.map((userItem) => (
              <li key={userItem.id}>
                <span>{userItem.name}</span>
                <strong>{userItem.points} pts</strong>
              </li>
            ))}
          </ol>
        </div>

        <article className="info-card home-note-card">
          <p className="eyebrow">Trending Categories</p>
          <h2>What people are cooking most.</h2>
          {trendingCategories.length ? (
            <>
              <div className="home-trending-list">
                {trendingCategories.map((category) => (
                  <div className="home-trending-item" key={category.id}>
                    <strong>{category.name}</strong>
                    <span>{getLabel(category.recipes_count, "recipe", "recipes")}</span>
                  </div>
                ))}
              </div>
              <p className="section-copy">
                These categories are pulled from live recipe counts in your backend, so the home
                page updates as the library grows.
              </p>
            </>
          ) : (
            <p className="section-copy">
              Category trends will appear here as soon as recipes are grouped into categories.
            </p>
          )}
        </article>
      </section>

      <section className="home-pulse">
        <article className="leaderboard-card home-pulse__card">
          <p className="eyebrow">Rising Chef</p>
          <h2>Creator spotlight</h2>
          {risingChef ? (
            <div className="home-spotlight">
              <strong>{risingChef.name}</strong>
              <p className="section-copy">
                Currently leading the momentum with {getRecipeCountLabel(risingChef.recipes_count)}{" "}
                and {risingChef.points} points.
              </p>
              <div className="chip-row">
                <span className="chip">{risingChef.points} pts</span>
                <span className="chip">{getRecipeCountLabel(risingChef.recipes_count)}</span>
              </div>
            </div>
          ) : (
            <p className="section-copy">
              Your next active contributor will appear here once members start publishing recipes.
            </p>
          )}
        </article>

        <article className="info-card home-pulse__card">
          <p className="eyebrow">Backend Pulse</p>
          <h2>Live platform snapshot</h2>
          <div className="home-pulse__stats">
            <div className="home-pulse__stat">
              <strong>{platformStats.chefs}</strong>
              <span>Community chefs</span>
            </div>
            <div className="home-pulse__stat">
              <strong>{recentRecipes.length}</strong>
              <span>Fresh uploads shown</span>
            </div>
          </div>
        </article>
      </section>
      </> : (
        <section className="home-launchpad">
          <div className="home-launchpad__art" aria-hidden="true">
            <span>✦</span><span>✦</span><span>✦</span>
            <svg viewBox="0 0 240 180" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M58 119c12-35 35-53 62-53s50 18 62 53" />
              <path d="M47 119h146l-12 33H59l-12-33Z" strokeLinejoin="round" />
              <path d="M80 93c-8-12-5-26 7-33 6 12 4 25-7 33ZM119 78c-4-13 3-25 16-29 2 13-5 24-16 29ZM153 95c-4-12 4-23 16-26 1 12-5 22-16 26Z" fill="currentColor" />
            </svg>
          </div>
          <div className="home-launchpad__content">
            <p className="eyebrow">Your kitchen is ready</p>
            <h2>Make the first move.</h2>
            <p className="section-copy">Your home feed will become more useful as you add ingredients, save dishes, and share recipes with the community.</p>
            <div className="home-launchpad__actions">
              <Link className="button" to="/fridge">Add my ingredients</Link>
              {user ? <Link className="button button--ghost" to="/recipes/new">Share a recipe</Link> : <button className="button button--ghost" onClick={() => onOpenAuth("signup")} type="button">Create a free account</button>}
            </div>
          </div>
          <div className="home-launchpad__steps">
            <span><b>01</b> Add your pantry</span>
            <span><b>02</b> Get recipe matches</span>
            <span><b>03</b> Start cooking</span>
          </div>
        </section>
      )}

      <RecipeShelf
        title="Recent Uploads"
        description="Fresh additions from the Leftover Chef community, arranged in a smooth, binge-browse row."
        recipes={recentRecipes}
        user={user}
        onOpenAuth={onOpenAuth}
      />

      <RecipeShelf
        title="Top Recipes"
        description={leaderboards.top_recipes.length
          ? "Highest-rated dishes on the platform, ready for a scroll through the community favourites."
          : "Fresh community recipes, ready to take the top spots as cooks start rating them."}
        recipes={topRecipes}
        variant="top10"
        user={user}
        onOpenAuth={onOpenAuth}
      />
    </div>
  );
}
