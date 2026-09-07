import "./About.css";

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
  { emoji: "📖", title: "Share Recipes", desc: "Upload your own recipes with photos, ingredients and step-by-step instructions." },
  { emoji: "⭐", title: "Rate & Review", desc: "Give honest ratings and helpful feedback to celebrate great cooking." },
  { emoji: "🗂️", title: "Browse Categories", desc: "Filter by cuisine, difficulty, diet type and more to find exactly what you need." },
  { emoji: "🗺️", title: "Culinary Map", desc: "Explore recipes country by country on an interactive world map." },
];

export default function About() {
  return (
    <div className="ab-page">

      <section className="ab-hero">
        <div className="ab-hero-glow" />
        <div className="ab-hero-inner">
          <span className="ab-hero-eyebrow">About Leftover Chef</span>
          <h1 className="ab-hero-title">
            A Culinary Map <br />
            <span className="ab-hero-accent">For Every Cook</span>
          </h1>
          <p className="ab-hero-desc">
            Leftover Chef is a community-driven food recipe platform where people
            from around the world share, discover, and celebrate recipes.
            We turn the ingredients you already have into guided recipes, connecting cooks through
            categories, ratings, and meaningful feedback.
          </p>
          <a href="/recipes" className="ab-hero-btn">Explore Recipes →</a>
        </div>
        <div className="ab-hero-img-wrap">
          <div className="ab-hero-img-frame">
            <img
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=700&q=80"
              alt="Cooking together"
              className="ab-hero-img"
            />
            
          </div>
        </div>
      </section>

      <section className="ab-mission">
        <div className="ab-mission-inner">
          <div className="ab-mission-text">
            <span className="ab-section-eyebrow">Our Mission</span>
            <h2 className="ab-section-title">Food Connects Us All</h2>
            <p className="ab-mission-desc">
              We believe every recipe carries a story — a grandmother's secret,
              a street food memory, a celebration dish passed through generations.
              Leftover Chef exists to preserve and share those stories, making the
              world's culinary heritage accessible to everyone.
            </p>
            
          </div>
          <div className="ab-mission-imgs">
            <img
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80"
              alt="Delicious food"
              className="ab-mission-img ab-mission-img-1"
            />
            <img
              src="https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=400&q=80"
              alt="Cooking prep"
              className="ab-mission-img ab-mission-img-2"
            />
          </div>
        </div>
      </section>

      <section className="ab-audience">
        <div className="ab-audience-inner">
          <span className="ab-section-eyebrow">Who It's For</span>
          <h2 className="ab-section-title">Built For Every Kind of Cook</h2>
          <div className="ab-audience-grid">
            {AUDIENCE.map((a) => (
              <div className="ab-audience-card" key={a.title}>
                <div className="ab-audience-emoji">{a.emoji}</div>
                <h3 className="ab-audience-title">{a.title}</h3>
                <p className="ab-audience-desc">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-features">
        <div className="ab-features-inner">
          <span className="ab-section-eyebrow">What We Offer</span>
          <h2 className="ab-section-title">Everything You Need to Cook & Connect</h2>
          <div className="ab-features-grid">
            {FEATURES.map((f) => (
              <div className="ab-feature-card" key={f.title}>
                <span className="ab-feature-emoji">{f.emoji}</span>
                <h3 className="ab-feature-title">{f.title}</h3>
                <p className="ab-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-cta">
        <div className="ab-cta-inner">
          <img
            src="https://images.unsplash.com/photo-1543353071-873f17a7a088?w=1200&q=80"
            alt="Community cooking"
            className="ab-cta-bg"
          />
          <div className="ab-cta-overlay" />
          <div className="ab-cta-content">
            <h2 className="ab-cta-title">Ready to Start Cooking?</h2>
            <p className="ab-cta-desc">Join Leftover Chef and share your first recipe with the world today.</p>
            <div className="ab-cta-btns">
              <a href="/recipes/new" className="ab-cta-btn-primary">Share a Recipe</a>
              <a href="/recipes" className="ab-cta-btn-secondary">Browse Recipes</a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
