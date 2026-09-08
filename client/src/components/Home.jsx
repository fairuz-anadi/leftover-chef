import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Home.css";
import home from "../assets/home.jpg";

const CATEGORIES = [
  { emoji: "🍝", name: "Italian",     count: "4,820" },
  { emoji: "🍱", name: "Japanese",    count: "3,241" },
  { emoji: "🍛", name: "Indian",      count: "5,130" },
  { emoji: "🌮", name: "Mexican",     count: "2,987" },
  { emoji: "🥘", name: "Middle East", count: "2,102" },
  { emoji: "🫕", name: "African",     count: "1,890" },
  { emoji: "🥗", name: "American",    count: "3,560" },
  { emoji: "🥐", name: "French",      count: "1,750" },
  { emoji: "🍜", name: "Thai",        count: "2,340" },
  { emoji: "🥟", name: "Chinese",     count: "4,210" },
  { emoji: "🌿", name: "Vegan",       count: "3,918" },
  { emoji: "🍰", name: "Desserts",    count: "2,670" },
];

const RECIPES = [
  {
    featured: true,
    img: home,
    cuisine: "Moroccan",
    title: "Slow-Cooked Lamb & Apricot Tagine",
    desc: "A warming Moroccan classic packed with fragrant spices, tender lamb, sweet apricots, and toasted almonds. Perfect for gatherings.",
  },
  {
    img: home,
    cuisine: "Vietnamese",
    title: "Hanoi-Style Beef Pho",
    desc: "Silky broth, rice noodles and fresh herbs.",
  },
  {
    img: home,
    cuisine: "Turkish",
    title: "Crispy Adana Chicken Wraps",
    desc: "Smoky minced chicken with pomegranate drizzle.",
  },
  {
    img: home,
    cuisine: "Indian",
    title: "Creamy Butter Chicken",
    desc: "Tender chicken simmered in a rich, velvety tomato and butter sauce with warming aromatic spices.",
  },
  {
    img: home,
    cuisine: "Mediterranean",
    title: "Chickpea & Roasted Pepper Wraps",
    desc: "Quick, vibrant, plant-based perfection.",
  },
];

const HOW_IT_WORKS = [
  { num: "01", icon: "🔍", title: "Explore & Discover", desc: "Browse thousands of recipes by cuisine, ingredient, cooking time, or dietary preference." },
  { num: "02", icon: "✍️", title: "Share Your Recipe",  desc: "Upload your recipe with photos and step-by-step instructions for the global community." },
  { num: "03", icon: "⭐", title: "Rate & Review",       desc: "Leave honest ratings and helpful comments. Your feedback helps every cook improve." },
  { num: "04", icon: "🌐", title: "Connect Globally",   desc: "Follow cooks worldwide, exchange culinary traditions, and build your recipe collection." },
];

function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return ref;
}

function RevealSection({ children, className }) {
  const ref = useReveal();
  return <div ref={ref} className={`hm-reveal ${className || ""}`}>{children}</div>;
}

export default function Home() {
  return (
    <div className="hm-page">
      <section className="hm-hero">
        <div className="hm-hero-glow" />
        <div className="hm-hero-glow2" />

        <div className="hm-hero-inner">
          <h1 className="hm-hero-title">
            What's In Your Fridge,
            <br />
            <em>On Your Fork.</em>
          </h1>

          <p className="hm-hero-desc">
            Discover, share, and celebrate food from every corner of the earth.
            Leftover Chef connects cooks through flavors, stories, and the
            universal language of good food.
          </p>

          <div className="hm-hero-actions">
            <Link to="/recipes" className="hm-btn-primary">Explore Recipes</Link>
          </div>
        </div>

        <div className="hm-hero-visual">
          <div className="hm-hero-frame">
             <img src={home} alt="Leftover Chef home" />
            
          </div>
        </div>
      </section>

      <section className="hm-categories">
        <div className="hm-cat-header">
          <div className="hm-cat-header-left">
            <span className="hm-eyebrow">Browse by Cuisine</span>
            <h2 className="hm-section-title">Every Culinary Corner Covered</h2>
          </div>
          <Link to="/recipes" className="hm-btn-ghost">View all -&gt;</Link>
        </div>

        <RevealSection>
          <div className="hm-cat-grid">
            {CATEGORIES.map((c) => (
              <Link className="hm-cat-card" to="/recipes" key={c.name}>
                <span className="hm-cat-icon">{c.emoji}</span>
                <span className="hm-cat-name">{c.name}</span>
                <span className="hm-cat-count">{c.count} recipes</span>
              </Link>
            ))}
          </div>
        </RevealSection>
      </section>

      <section className="hm-recipes">
        <div className="hm-recipes-header">
          <div>
            <span className="hm-eyebrow">This Week's Favourites</span>
            <h2 className="hm-section-title">Trending Recipes Across the Globe</h2>
          </div>
          <Link to="/recipes" className="hm-btn-ghost">Browse all -&gt;</Link>
        </div>

        <RevealSection>
          <div className="hm-recipes-grid">
            {RECIPES.map((r, i) => (
              <Link
                key={i}
                to="/recipes"
                className={`hm-recipe-card${r.featured ? " featured" : ""}`}
              >
                <div className="hm-rc-img">
                  <img src={r.img} alt={r.title} />
                </div>
                <div className="hm-rc-body">
                  <div className="hm-rc-meta">
                    <span className="hm-rc-cuisine">{r.cuisine}</span>
                  </div>
                  <div className="hm-rc-title">{r.title}</div>
                  <div className="hm-rc-desc">{r.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </RevealSection>
      </section>

      <section className="hm-how">
        <span className="hm-eyebrow">The Process</span>
        <h2 className="hm-section-title">Your Culinary Journey Starts Here</h2>
        <p className="hm-section-desc">
          From your first recipe to becoming a community favourite, Leftover Chef
          guides you every step of the way.
        </p>

        <RevealSection>
          <div className="hm-how-grid">
            {HOW_IT_WORKS.map((s) => (
              <div className="hm-how-card" key={s.num}>
                <div className="hm-how-num">{s.num}</div>
                <div className="hm-how-icon">{s.icon}</div>
                <h3 className="hm-how-title">{s.title}</h3>
                <p className="hm-how-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </RevealSection>
      </section>

      <section className="hm-cta">
        <div className="hm-cta-inner">
          <img
            src={home}
            alt="Community cooking"
            className="hm-cta-bg"
          />
          <div className="hm-cta-overlay" />
          <div className="hm-cta-content">
            <h2 className="hm-cta-title">Ready to Start Cooking?</h2>
            <p className="hm-cta-desc">
              Join 310,000 cooks across the globe. Share your first recipe
              with the world today.
            </p>
            <div className="hm-cta-btns">
              <Link to="/recipes/new" className="hm-cta-btn-primary">Share a Recipe</Link>
              <Link to="/recipes" className="hm-cta-btn-secondary">Browse Recipes</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}