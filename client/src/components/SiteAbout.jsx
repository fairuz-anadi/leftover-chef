import home from "../assets/home.jpg";

const AUDIENCE = [
  {
    emoji: "🌱",
    title: "Beginner Cooks",
    desc: "Step-by-step recipes with community feedback to guide you from your very first dish to confident cooking.",
  },
  {
    emoji: "🏠",
    title: "Home Cooks",
    desc: "Share your family recipes, discover new favourites, and build a collection of dishes you love.",
  },
  {
    emoji: "🌍",
    title: "Food Enthusiasts",
    desc: "Explore authentic cuisines from every corner of the world — one recipe at a time.",
  },
];

const FEATURES = [
  { emoji: "🥕", title: "Cook What You Have", desc: "Stock your fridge once and every recipe is ranked by how much of it you can already make." },
  { emoji: "🗺️", title: "Cuisine Map Explorer", desc: "Explore recipes country by country on an interactive world map." },
  { emoji: "👩‍🍳", title: "Guided Cooking Mode", desc: "One step at a time, with a countdown timer for every step and prompts read aloud." },
  { emoji: "📅", title: "Weekly Meal Planner", desc: "Drop recipes into your week and see the calories stack up day by day." },
  { emoji: "🧺", title: "Auto Shopping List", desc: "Everything the week needs that your fridge doesn't have, grouped by aisle." },
  { emoji: "🥗", title: "Nutrition Insights", desc: "Calories and a protein, carb and fat breakdown for every serving." },
  { emoji: "📖", title: "Share Recipes", desc: "Upload your own recipes with photos, ingredients and step-by-step instructions." },
  { emoji: "⭐", title: "Rate & Review", desc: "Give honest ratings and helpful feedback to celebrate great cooking." },
];

export default function About() {
  return (
    <div style={{ display: "grid", gap: 0 }}>

      {/* ── Hero ── */}
      <section style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", padding: "72px 0 80px", overflow: "hidden" }}>
        {/* glow */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 70% at 0% 50%, var(--brand-glow) 0%, transparent 60%), radial-gradient(ellipse 40% 50% at 100% 20%, var(--accent-glow) 0%, transparent 55%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", display: "grid", gap: 20 }}>
          <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)", background: "var(--brand-glow)", padding: "5px 14px", borderRadius: "var(--r-pill)", width: "fit-content", border: "1px solid rgba(15,81,50,0.15)" }}>
            About Leftover Chef
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem, 5vw, 3.8rem)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", color: "var(--text)", margin: 0 }}>
            A Culinary Map <br />
            <span style={{ background: "linear-gradient(135deg, var(--brand-deep), var(--brand), var(--gold))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              For Every Cook
            </span>
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--muted)", fontWeight: 300, maxWidth: 480, margin: 0 }}>
            Leftover Chef is a community-driven food recipe platform where people
            from around the world share, discover, and celebrate recipes.
            We turn the ingredients you already have into guided recipes, connecting cooks through
            categories, ratings, and meaningful feedback.
          </p>
          <a href="/recipes" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: "var(--r-pill)", background: "linear-gradient(145deg, #166b43 0%, #0b4229 55%, #0a3a24 100%)", color: "white", fontWeight: 600, fontSize: "0.92rem", textDecoration: "none", boxShadow: "0 1px 0 rgba(255,255,255,0.18) inset, 0 12px 28px rgba(10,58,36,0.28)", width: "fit-content" }}>
            Explore Recipes →
          </a>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ borderRadius: "var(--r-xl)", overflow: "hidden", boxShadow: "var(--shadow-xl)", aspectRatio: "4/3" }}>
            <img
              src={home}
              alt="Cooking together"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)", background: "var(--brand-glow)", padding: "5px 14px", borderRadius: "var(--r-pill)", width: "fit-content", border: "1px solid rgba(15,81,50,0.15)" }}>
              Our Mission
            </span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "var(--text)", margin: 0 }}>
              Food Connects Us All
            </h2>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "var(--muted)", fontWeight: 300, margin: 0 }}>
              We believe every recipe carries a story — a grandmother's secret,
              a street food memory, a celebration dish passed through generations.
              Leftover Chef exists to preserve and share those stories, making the
              world's culinary heritage accessible to everyone.
            </p>
          </div>

          <div style={{ position: "relative", height: 420 }}>
            <img
              src={home}
              alt="Delicious food"
              style={{ position: "absolute", top: 0, right: 0, width: "70%", height: 300, objectFit: "cover", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)" }}
            />
            <img
              src={home}
              alt="Cooking prep"
              style={{ position: "absolute", bottom: 0, left: 0, width: "60%", height: 260, objectFit: "cover", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)", border: "4px solid var(--bg-cream)" }}
            />
          </div>
        </div>
      </section>

      {/* ── Audience ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gap: 40 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)", background: "var(--brand-glow)", padding: "5px 14px", borderRadius: "var(--r-pill)", width: "fit-content", border: "1px solid rgba(15,81,50,0.15)" }}>
              Who It's For
            </span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "var(--text)", margin: 0 }}>
              Built For Every Kind of Cook
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {AUDIENCE.map((a) => (
              <div key={a.title} style={{ background: "var(--surface-strong)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "32px 28px", display: "grid", gap: 12, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "2.2rem", lineHeight: 1 }}>{a.emoji}</div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>{a.title}</h3>
                <p style={{ fontSize: "0.92rem", lineHeight: 1.65, color: "var(--muted)", fontWeight: 300, margin: 0 }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gap: 40 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)", background: "var(--brand-glow)", padding: "5px 14px", borderRadius: "var(--r-pill)", width: "fit-content", border: "1px solid rgba(15,81,50,0.15)" }}>
              What We Offer
            </span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "var(--text)", margin: 0 }}>
              Everything You Need to Cook & Connect
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "26px 22px", display: "grid", gap: 10, boxShadow: "var(--shadow-xs)", backdropFilter: "blur(8px)" }}>
                <span style={{ fontSize: "1.9rem", lineHeight: 1 }}>{f.emoji}</span>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>{f.title}</h3>
                <p style={{ fontSize: "0.88rem", lineHeight: 1.6, color: "var(--muted)", fontWeight: 300, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ position: "relative", borderRadius: "var(--r-xl)", overflow: "hidden", minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-xl)" }}>
          <img
            src={home}
            alt="Community cooking"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(28,16,8,0.72) 0%, rgba(10,58,36,0.55) 50%, rgba(181,118,42,0.45) 100%)" }} />
          <div style={{ position: "relative", textAlign: "center", padding: "60px 40px", display: "grid", gap: 16, justifyItems: "center" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: "-0.02em", color: "white", margin: 0, textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              Ready to Start Cooking?
            </h2>
            <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.82)", fontWeight: 300, margin: 0, maxWidth: 420 }}>
              Join Leftover Chef and share your first recipe with the world today.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              <a href="/recipes/new" style={{ display: "inline-flex", alignItems: "center", padding: "13px 28px", borderRadius: "var(--r-pill)", background: "linear-gradient(145deg, #166b43 0%, #0b4229 55%, #0a3a24 100%)", color: "white", fontWeight: 600, fontSize: "0.92rem", textDecoration: "none", boxShadow: "0 1px 0 rgba(255,255,255,0.18) inset, 0 12px 28px rgba(10,58,36,0.4)" }}>
                Share a Recipe
              </a>
              <a href="/recipes" style={{ display: "inline-flex", alignItems: "center", padding: "13px 28px", borderRadius: "var(--r-pill)", background: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600, fontSize: "0.92rem", textDecoration: "none", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(8px)" }}>
                Browse Recipes
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}