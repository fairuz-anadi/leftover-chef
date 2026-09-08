import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  Leaf,
  Refrigerator,
  ScanLine,
  Sparkles,
  Sprout,
  Timer,
  Utensils,
} from "lucide-react";
import Logo, { LogoMark } from "./components/Logo";
import InstallButton from "./components/InstallButton";
import samplePhoto from "./assets/demo-photos/1-kitchen-counter.jpg";

/**
 * The landing page — what is on the laptop when nobody is standing at the
 * stall, and the first thing a judge sees on their own phone.
 *
 * It answers three questions before anyone touches the app: what does this do,
 * why is it built this way, and how do I try it. Then it gets out of the way.
 * Every number on this page is one the demo can be made to prove on the spot,
 * because a judge who reads a figure and then watches it fail has learnt
 * something worse than nothing.
 */

/** Reveal on approach, rather than all at once on load. */
function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // No observer must not mean an invisible page. Show everything and stop.
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-in");
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          // One-way: scrolling back up should not re-run the whole page.
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function Reveal({ className = "", children, ...rest }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`lc-inview ${className}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * Whether to animate at all — checked before the first render rather than
 * corrected afterwards, so a reader who has asked their OS for less motion
 * never sees a number start at zero and climb.
 */
function skipMotion() {
  return (
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    typeof IntersectionObserver === "undefined"
  );
}

/** A number that counts up the first time you see it. */
function CountUp({ to, suffix = "", duration = 1100 }) {
  const [value, setValue] = useState(() => (skipMotion() ? to : 0));
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || skipMotion()) return undefined;

    let frame = null;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        // Ease out, so it lands rather than stops.
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

const STEPS = [
  {
    n: "01",
    tone: "teal",
    icon: <ScanLine size={19} />,
    title: "Scan once",
    body: "Point the camera at the shelf. An open-vocabulary detector names what it sees — on this laptop, with the WiFi off.",
  },
  {
    n: "02",
    tone: "yellow",
    icon: <Timer size={19} />,
    title: "See what matters",
    body: "Every item is dated from a shelf-life table, so nobody types twelve use-by dates. Green, amber, red, and a dial for the whole fridge.",
  },
  {
    n: "03",
    tone: "coral",
    icon: <ChefHat size={19} />,
    title: "Cook with confidence",
    body: "The recipe list reorders around whatever is closest to the bin. Cook one, and those ingredients leave the shelf.",
  },
];

const POINTS = [
  {
    icon: <Leaf size={17} />,
    title: "Local-first intelligence",
    body: "Model weights, fonts, recipes and artwork all on disk. The venue has no internet by design, and neither does this.",
  },
  {
    icon: <Utensils size={17} />,
    title: "Cuisine that feels like home",
    body: "All 132 ingredients carry their Bangla name, and Bangladeshi cooking is weighted up the list.",
  },
  {
    icon: <Refrigerator size={17} />,
    title: "No sensors. No fuss.",
    body: "A camera is all a smart fridge needs. No hardware, no account, no sign-in.",
  },
];

export default function Landing({ onOpen }) {
  return (
    <div className="landing">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="landing-header">
        <a className="no-underline" href="#top">
          <Logo size={34} />
        </a>

        <nav className="landing-nav">
          <a href="#how">How it works</a>
          <a href="#why">Why it&rsquo;s built this way</a>
          <a href="#install">Install</a>
        </nav>

        <div className="flex items-center gap-2">
          <InstallButton />
          <button type="button" onClick={onOpen} className="pill-solid">
            Open the app <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="landing-hero" id="top">
        <div className="hero-orb orb-a" aria-hidden="true" />
        <div className="hero-orb orb-b" aria-hidden="true" />

        <div className="hero-copy lc-rise">
          <p className="kicker">
            <span className="kicker-pulse" /> AUST CSE Carnival 8.0 · Software &amp; AI
          </p>

          <h1>
            Good food
            <br />
            <em>shouldn&rsquo;t</em> get forgotten.
          </h1>

          <p className="hero-lede">
            FridgeMama turns one fridge photo into a living freshness list, a dinner plan,
            and fewer ingredients in the bin. It names everything in Bangla and English,
            and it all runs on the laptop in front of you.
          </p>

          <div className="hero-buttons">
            <button type="button" onClick={onOpen} className="pill-hero">
              Open your kitchen <ArrowRight size={17} />
            </button>
            <a href="#how" className="pill-ghost">
              <Sparkles size={17} /> See how it works
            </a>
          </div>

          <p className="hero-footnote">
            <b>Made for real kitchens.</b>
            <br />
            On-device · offline-first · no account, no sign-in
          </p>
        </div>

        {/* The idea, in motion, before anyone has read a word about it. */}
        <div className="hero-stage lc-rise">
          <div className="hero-sticker">
            <ScanLine size={14} />
            <span>Scanning</span>
            <b>6 items found</b>
          </div>

          <figure className="hero-photo">
            <img src={samplePhoto} alt="Ingredients laid out on a kitchen counter" />
            <figcaption>
              <span>
                <i className="live-dot" /> FridgeMama vision
              </span>
              <span className="font-mono">494 ms</span>
            </figcaption>
          </figure>

          <div className="hero-peek">
            <div>
              <small>Best match tonight</small>
              <b>Dim Bhuna</b>
              <span>100% of it already on your shelf</span>
            </div>
            <span className="peek-arrow">↗</span>
          </div>

          <div className="hero-badge">
            <Sprout size={16} />
            <span>
              <small>Spinach · পালং শাক</small>
              <b>1 day left</b>
            </span>
            <span className="badge-bar">
              <i className="lc-drain" />
            </span>
          </div>
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────────────────── */}
      <section className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="marquee-run">
              <span>SCAN WHAT YOU OWN</span> <i>✦</i> <span>COOK BEFORE IT SPOILS</span> <i>✦</i>{" "}
              <span>MAKE EVERY INGREDIENT COUNT</span> <i>✦</i>{" "}
            </span>
          ))}
        </div>
      </section>

      {/* ── The numbers ─────────────────────────────────────── */}
      <Reveal className="landing-section stat-band">
        {[
          { value: 132, suffix: "", label: "ingredients, each with a Bangla name" },
          { value: 40, suffix: "", label: "recipes on disk, 10 of them Bangladeshi" },
          { value: 494, suffix: "ms", label: "to name a shelf, on a laptop CPU" },
          { value: 0, suffix: "", label: "internet connections required" },
        ].map((stat) => (
          <div key={stat.label} className="lc-step stat">
            <strong>
              <CountUp to={stat.value} suffix={stat.suffix} />
            </strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </Reveal>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="landing-section" id="how">
        <Reveal className="section-head">
          <div>
            <p className="eyebrow">
              <span /> The smarter kitchen loop
            </p>
            <h2>
              From <em>fridge photo</em>
              <br />
              to fresh idea.
            </h2>
          </div>
          <p className="section-lede">
            No manual inventory, no endless searching, and nothing to navigate to. Just a
            better path from what you already have to what you can make tonight.
          </p>
        </Reveal>

        <Reveal className="how-grid">
          {STEPS.map((step) => (
            <article key={step.n} className="lc-step step-tile">
              <div className="step-top">
                <span className="step-number">{step.n}</span>
                <span className={`step-icon ${step.tone}`}>{step.icon}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </Reveal>
      </section>

      {/* ── Why it's built this way ─────────────────────────── */}
      <section className="landing-section feature-showcase" id="why">
        <Reveal className="feature-visual">
          <div className="feature-ring ring-outer" aria-hidden="true" />
          <div className="feature-ring ring-inner" aria-hidden="true" />
          <LogoMark size={128} className="lc-beat" />
          <span className="feature-tag tag-top">0.6 × match + 0.4 × urgency</span>
          <span className="feature-tag tag-bottom">SDG 12 · responsible consumption</span>
        </Reveal>

        <Reveal className="feature-copy">
          <p className="eyebrow">
            <span /> More than a recipe app
          </p>
          <h2>
            Your fridge has a <em>next best action.</em>
          </h2>
          <p className="section-lede">
            FridgeMama closes the loop between detection, freshness, action and impact. It
            does not ask you to buy more — it helps you use what you already bought.
          </p>

          <div className="feature-points">
            {POINTS.map((point) => (
              <div key={point.title} className="feature-point">
                <span>{point.icon}</span>
                <div>
                  <b>{point.title}</b>
                  <small>{point.body}</small>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={onOpen} className="pill-outline">
            Explore the workspace <ArrowUpRight size={16} />
          </button>
        </Reveal>
      </section>

      {/* ── Install ─────────────────────────────────────────── */}
      <Reveal className="landing-section install-panel" id="install">
        <div className="install-copy">
          <p className="eyebrow">
            <span /> Ready when your fridge is
          </p>
          <h2>Put it on your phone.</h2>
          <p className="section-lede">
            FridgeMama installs to a home screen and opens full-screen, with no address bar
            and no tabs. Same app either way — installing just means the camera is one tap
            from the lock screen, which is where a fridge app belongs.
          </p>

          <ol className="install-steps">
            <li>Join the same WiFi as this laptop — or its hotspot.</li>
            <li>
              Open the address the laptop is showing, the one starting{" "}
              <code>http://192.168.</code>
            </li>
            <li>
              <b>Android:</b> tap <em>Install</em>, or Chrome&rsquo;s menu →{" "}
              <em>Add to Home screen</em>.
              <br />
              <b>iPhone:</b> tap <em>Share</em> → <em>Add to Home Screen</em>.
            </li>
          </ol>

          <InstallButton />
        </div>

        <div className="install-visual">
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen">
              <LogoMark size={56} />
              <b>FridgeMama</b>
              <small>Detect. Track. Cook. Waste less.</small>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <Reveal className="landing-cta">
        <div className="cta-glow" aria-hidden="true" />
        <p className="eyebrow light">
          <span /> 90 seconds, start to finish
        </p>
        <h2>
          Tonight&rsquo;s dinner is
          <br />
          <em>already in there.</em>
        </h2>
        <button type="button" onClick={onOpen} className="pill-hero cta-button">
          Open the interactive app <ArrowRight size={17} />
        </button>
      </Reveal>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="landing-footer">
        <Logo size={30} />
        <p>Detect. Track. Cook. Waste less.</p>
        <span>AUST CSE Carnival 8.0 · Software &amp; AI · runs entirely on-device</span>
      </footer>
    </div>
  );
}
