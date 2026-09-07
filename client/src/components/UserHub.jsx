import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { useToast } from "./useToast";

function sameUserId(left, right) {
  return String(left) === String(right);
}

function IconStar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 8.9H23l-7.5 5.4 2.9 8.9L12 20l-8.4 5.2 2.9-8.9L1 10.9h8.1z" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IconHeart() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <polyline points="8 21 12 17 16 21" /><line x1="12" y1="17" x2="12" y2="11" />
      <path d="M7 4H4a2 2 0 000 4c0 2.21 1.79 4 4 4" /><path d="M17 4h3a2 2 0 010 4c0 2.21-1.79 4-4 4" />
      <rect x="7" y="2" width="10" height="9" rx="2" />
    </svg>
  );
}
function IconCoffee() {
  return <span style={{ fontSize: "0.9rem" }}>☕</span>;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return toNumber(value).toFixed(2);
}

export default function UserHub() {
  const [dashboard, setDashboard] = useState(null);
  const [tips, setTips] = useState([]);
  const [tipStats, setTipStats] = useState(null);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const dashboardData = await api.dashboard();

        if (!dashboardData || !dashboardData.user) {
          throw new Error("Invalid dashboard response — missing user data");
        }

        if (!active) return;
        setDashboard(dashboardData);

        const userId = dashboardData.user.id;
        if (userId != null) {
          try {
            const tipsData = await api.getUserTips(userId);
            if (!active) return;
            setTips(Array.isArray(tipsData?.data) ? tipsData.data : []);
            setTipStats(tipsData?.stats || null);
          } catch {
            if (!active) return;
            setTips([]);
            setTipStats(null);
            showToast("Your dashboard loaded, but tip activity could not be fetched right now.", "error");
          }
        }
      } catch (err) {
        if (!active) return;
        console.error("Dashboard error:", err);
        const msg = err.message || "Failed to load dashboard";
        setError(msg);
        showToast(msg, "error");
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [showToast]);

  if (error) {
    return (
      <div className="feedback feedback--error">{error}</div>
    );
  }

  if (!dashboard || !dashboard.user) {
    return <div className="shell-loader">Loading dashboard…</div>;
  }

  const { user, stats } = dashboard;
  if (!user || !stats) {
    return <div className="shell-loader">Loading dashboard…</div>;
  }

  const initials = (user.name || "?")
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";

  const userRecipes = user.recipes || [];
  const userFavorites = user.favorites || [];

  return (
    <div className="simple-page" style={{ gap: 36 }}>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className="admin-hero" style={{ borderRadius: "var(--r-xl)", minHeight: 220 }}>
        <div className="admin-hero__copy" style={{ gap: 18 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Your Dashboard</p>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{
              width: 70, height: 70, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(145deg,#c79a3e 0%,#0f5132 55%,#b5762a 100%)",
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontSize: "1.75rem", color: "#ffffff",
              boxShadow: "0 8px 28px rgba(10,58,36,.45), inset 0 1px 0 rgba(255,255,255,.22)",
            }}>
              {initials}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "clamp(1.8rem,4vw,3rem)", lineHeight: 1 }}>
                {user.name}
              </h1>
              <p style={{ margin: "6px 0 0", color: "rgba(250,250,249,.6)", fontWeight: 300, fontSize: "0.92rem" }}>
                Recipe creator &amp; food enthusiast
              </p>
            </div>
          </div>

          <div className="admin-badges">
            <span className="chip">👨‍🍳 Chef</span>
            <span className="chip">{stats.recipes_count} Recipes</span>
            <span className="chip"><IconStar /> {stats.average_recipe_rating || 0} avg</span>
          </div>
        </div>

        <div className="admin-hero__panel">
          <div className="admin-highlight">
            <span className="admin-highlight__label" style={{ color: "rgba(250,250,249,.5)" }}>
              Quick Actions
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              <Link className="button" to="/recipes/new" style={{ justifyContent: "center" }}>
                <IconUpload /> Upload New Recipe
              </Link>
              <Link className="button button--ghost" to="/recipes" style={{ justifyContent: "center" }}>
                Browse Library
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="admin-stat">
          <span className="admin-stat__label" style={{ color: "var(--brand)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconTrophy /> Points
          </span>
          <strong className="admin-stat__value">{stats.points}</strong>
          <span className="admin-stat__hint">Total earned</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconUpload /> Uploads
          </span>
          <strong className="admin-stat__value">{stats.recipes_count}</strong>
          <span className="admin-stat__hint">Recipes shared</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label" style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconStar /> Avg Rating
          </span>
          <strong className="admin-stat__value">{stats.average_recipe_rating || 0}</strong>
          <span className="admin-stat__hint">Out of 5.0</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label" style={{ color: "var(--brand)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconHeart /> Favourites
          </span>
          <strong className="admin-stat__value">{stats.favorites_count}</strong>
          <span className="admin-stat__hint">Saved recipes</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label" style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoffee /> Tips
          </span>
          <strong className="admin-stat__value">${formatCurrency(tipStats?.total_received)}</strong>
          <span className="admin-stat__hint">Coffees bought</span>
        </div>
      </div>

      {/* ── Your Recipes ───────────────────────────────────────────── */}
      <section>
        <div className="section-row" style={{ marginBottom: 20 }}>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 4px" }}>Your Creations</p>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.85rem", letterSpacing: "-0.02em" }}>
              Your Recipes
            </h2>
          </div>
          <Link className="button button--secondary" to="/recipes/new">
            <IconUpload /> Add Recipe
          </Link>
        </div>

        {userRecipes.length === 0 ? (
          <div className="feedback" style={{ textAlign: "center", padding: "52px 24px" }}>
            <div style={{ fontSize: "2.8rem", marginBottom: 12, opacity: 0.35 }}>🍳</div>
            <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "1.1rem", marginBottom: 6 }}>
              No recipes yet
            </strong>
            <span style={{ color: "var(--muted)", fontWeight: 300 }}>
              Share your first dish with the community.
            </span>
          </div>
        ) : (
          <div className="recipe-shelf">
            <div className="recipe-shelf__track">
              {userRecipes.map((recipe) => (
                <article className="recipe-shelf__card" key={recipe.id}>
                  <div className="recipe-shelf__media">
                    <span className="recipe-shelf__badge">#{recipe.id}</span>
                    <span className="recipe-shelf__rating">
                      <IconStar /> {recipe.average_rating || "New"}
                    </span>
                  </div>
                  <div className="recipe-shelf__body">
                    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.1rem", lineHeight: 1.15 }}>
                      {recipe.title}
                    </h3>
                    <p style={{
                      margin: 0, color: "var(--muted)", fontWeight: 300, lineHeight: 1.58,
                      display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {recipe.description}
                    </p>
                    <div className="chip-row" style={{ marginTop: 4 }}>
                      {/* FIX: categories may be null/undefined */}
                      {(recipe.categories || []).map((cat) => (
                        <span className="chip" key={cat.id}>{cat.name}</span>
                      ))}
                    </div>
                    <div className="recipe-shelf__meta">
                      <span>Your recipe</span>
                      <Link className="button button--ghost" to={`/recipes/${recipe.id}/edit`}
                        style={{ padding: "7px 16px", fontSize: "0.82rem" }}>
                        Edit
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Tips Received ──────────────────────────────────────────── */}
      <section>
        <div className="section-row" style={{ marginBottom: 20 }}>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 4px" }}>Community Love</p>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.85rem", letterSpacing: "-0.02em" }}>
              ☕ Tips Received
            </h2>
          </div>
        </div>

        {tipStats && (
          <div className="tip-stats" style={{ marginBottom: 24 }}>
            <div className="tip-stat">
              <span className="tip-stat-value">${formatCurrency(tipStats?.total_received)}</span>
              <span className="tip-stat-label">Total Raised</span>
            </div>
            <div className="tip-stat">
              <span className="tip-stat-value">{toNumber(tipStats?.tips_count)}</span>
              <span className="tip-stat-label">Supporters</span>
            </div>
          </div>
        )}

        {tips.length === 0 ? (
          <div className="feedback" style={{ textAlign: "center", padding: "52px 24px" }}>
            <div style={{ fontSize: "2.8rem", marginBottom: 12, opacity: 0.35 }}>☕</div>
            <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "1.1rem", marginBottom: 6 }}>
              No tips yet
            </strong>
            <span style={{ color: "var(--muted)", fontWeight: 300 }}>
              Share amazing recipes and supporters will buy you coffee!
            </span>
          </div>
        ) : (
          <div className="tips-section">
            <ul className="tip-list">
              {tips.map((tip) => (
                <li key={tip.id} className="tip-item">
                  <div className="tip-item-from">
                    <strong>{tip.sender?.name || "Anonymous Supporter"}</strong>
                    {tip.message && (
                      <em style={{ color: "var(--muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
                        "{tip.message}"
                      </em>
                    )}
                    <span style={{ fontSize: "0.8rem", color: "var(--muted-light)" }}>
                      {tip.created_at ? new Date(tip.created_at).toLocaleDateString() : "Unknown"}
                    </span>
                  </div>
                  <span className="tip-item-amount">${formatCurrency(tip.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Favourites ─────────────────────────────────────────────── */}
      <section>
        <div className="section-row" style={{ marginBottom: 20 }}>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 4px" }}>Saved by You</p>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.85rem", letterSpacing: "-0.02em" }}>
              Your Favourites
            </h2>
          </div>
          <Link className="button button--ghost" to="/recipes">Browse Recipes</Link>
        </div>

        {userFavorites.length === 0 ? (
          <div className="feedback" style={{ textAlign: "center", padding: "52px 24px" }}>
            <div style={{ fontSize: "2.8rem", marginBottom: 12, opacity: 0.35 }}>🤍</div>
            <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "1.1rem", marginBottom: 6 }}>
              Nothing saved yet
            </strong>
            <span style={{ color: "var(--muted)", fontWeight: 300 }}>
              Explore the library and save recipes you love.
            </span>
          </div>
        ) : (
          <div className="recipe-list" style={{ gap: 16 }}>
            {userFavorites.map((recipe) => (
              <article className="recipe-card" key={`favorite-${recipe.id}`}>
                <div className="recipe-card__header" style={{
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start",
                }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <h3 style={{ margin: 0 }}>{recipe.title}</h3>
                    <p style={{ margin: 0 }}>{recipe.description}</p>
                    <div className="meta-row" style={{ gap: 16, marginTop: 2 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg,var(--brand),var(--accent))",
                          display: "inline-grid", placeItems: "center",
                          fontSize: "0.6rem", color: "white", fontWeight: 700,
                        }}>
                          {/* FIX: safe access on recipe.user */}
                          {(recipe.user?.name || "?")[0].toUpperCase()}
                        </span>
                        By {recipe.user?.name || "Unknown"}
                      </span>
                      <span className="rating-pill" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <IconStar /> {recipe.average_rating || 0} / 5
                      </span>
                    </div>
                  </div>

                  {sameUserId(recipe.user_id, user.id) ? (
                    <Link className="button button--ghost" to={`/recipes/${recipe.id}/edit`}
                      style={{ padding: "9px 18px", fontSize: "0.86rem" }}>Edit</Link>
                  ) : (
                    <Link className="button button--ghost" to="/recipes"
                      style={{ padding: "9px 18px", fontSize: "0.86rem" }}>View</Link>
                  )}
                </div>

                <div className="chip-row" style={{ marginTop: 14 }}>
                  {/* FIX: categories may be null/undefined */}
                  {(recipe.categories || []).map((cat) => (
                    <span className="chip" key={`fav-cat-${recipe.id}-${cat.id}`}>{cat.name}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
