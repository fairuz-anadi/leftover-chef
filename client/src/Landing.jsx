import { useEffect, useRef, useState } from "react";
import Logo, { LogoMark } from "./components/Logo";
import InstallButton from "./components/InstallButton";

/**
 * The landing page — what is on the laptop when nobody is standing at the
 * stall, and the first thing a judge sees on their own phone.
 *
 * It exists to answer three questions before anyone touches the app: what does
 * this do, why is it built this way, and how do I try it. Then it gets out of
 * the way. Every claim here is one the demo can be made to prove on the spot,
 * because a judge who reads a number and then watches it fail has learnt
 * something worse than nothing.
 */

/** Reveal on approach, rather than all at once on load. */
function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // No observer (or a browser that has one but is being difficult) must not
    // mean an invisible page. Show everything and stop.
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
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
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
 * Whether to animate at all.
 *
 * Checked before the first render rather than corrected afterwards, so a
 * reader who has asked their OS for less motion never sees a number start at
 * zero and climb — they see the number.
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
    title: "Snap the shelf",
    body: "One photo of the open fridge. An open-vocabulary detector names what it sees — on this laptop, with the WiFi off.",
  },
  {
    n: "02",
    title: "Confirm what's there",
    body: "Every ingredient arrives as a chip you can drop. Nothing is written to your fridge until you say so. The model saves the typing; it doesn't get the last word.",
  },
  {
    n: "03",
    title: "Watch the clock",
    body: "Each item is dated from a shelf-life table, so nobody types twelve use-by dates. Green, amber, red — and a dial that scores the whole fridge.",
  },
  {
    n: "04",
    title: "Cook it before it goes",
    body: "The recipe list reorders around whatever is closest to the bin. Cook one, and those ingredients leave the shelf and land on the food-saved counter.",
  },
];

const PILLARS = [
  {
    title: "Works with the WiFi off",
    body: "The model weights, the fonts, the recipes and the artwork are all on disk. The venue has no internet by design, and neither does this — it was built that way, not patched into it afterwards.",
  },
  {
    title: "Bengali, not translated",
    body: "All 132 ingredients carry their Bangla name beside the English one: পালং শাক, ঢেঁড়স, ইলিশ. The recipe list is weighted so Bangladeshi cooking surfaces first, because that is what is actually in the fridge.",
  },
  {
    title: "It shows its working",
    body: "Priority is 0.6 × how much of the recipe you already have, plus 0.4 × how urgent those ingredients are, plus a nudge for local cuisine. Arithmetic you can check by hand — not a number a black box asserted.",
  },
];

export default function Landing({ onOpen }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 pb-16 pt-6">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4">
        <Logo size={38} />
        <div className="flex items-center gap-2">
          <InstallButton />
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110"
          >
            Open the app
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="lc-rise mt-14 grid items-center gap-12 md:mt-20 md:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            AUST CSE Carnival 8.0 · Software &amp; AI
          </p>

          <h1 className="m-0 mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-[var(--text)] sm:text-5xl">
            Your fridge knows
            <br />
            what&rsquo;s dying.
            <br />
            <span className="text-[var(--accent)]">Now so do you.</span>
          </h1>

          <p className="m-0 mt-5 max-w-xl text-base leading-relaxed text-[var(--dim)]">
            Point your phone at the shelf. FridgeMama names every ingredient in Bangla and
            English, works out how many days each one has left, and tells you what to cook
            tonight so none of it reaches the bin.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-[var(--on-accent)] shadow-sm transition hover:brightness-110"
            >
              Open FridgeMama →
            </button>
            <a
              href="#install"
              className="rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold text-[var(--text)] no-underline transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Put it on your phone
            </a>
          </div>

          <p className="m-0 mt-5 text-xs text-[var(--faint)]">
            No account. No sign-in. Nothing leaves this laptop.
          </p>
        </div>

        {/* The idea, in motion, before anyone has read a word about it. */}
        <div className="relative grid place-items-center py-6">
          <div
            className="lc-halo absolute h-56 w-56 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(13,148,136,0.22), transparent 68%)" }}
            aria-hidden="true"
          />
          <div className="lc-beat relative">
            <LogoMark size={148} cut="var(--bg)" />
          </div>

          <div className="relative mt-9 w-full max-w-xs rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[var(--text)]">Spinach</span>
              <span className="text-xs text-[var(--faint)]">পালং শাক</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--raised)]">
              <div className="lc-drain h-full rounded-full" />
            </div>
            <p className="m-0 mt-2.5 text-[11px] text-[var(--faint)]">
              Bought Tuesday · 4 days of shelf life
            </p>
          </div>
        </div>
      </section>

      {/* ── The numbers ─────────────────────────────────────── */}
      <Reveal className="mt-24 grid grid-cols-2 gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:grid-cols-4">
        {[
          { value: 132, suffix: "", label: "ingredients, each with a Bangla name" },
          { value: 40, suffix: "", label: "recipes on disk, 10 of them Bangladeshi" },
          { value: 450, suffix: "ms", label: "to name a shelf, on a laptop CPU" },
          { value: 0, suffix: "", label: "internet connections required" },
        ].map((stat) => (
          <div key={stat.label} className="lc-step">
            <p className="m-0 text-3xl font-bold tracking-tight text-[var(--accent)]">
              <CountUp to={stat.value} suffix={stat.suffix} />
            </p>
            <p className="m-0 mt-1.5 text-xs leading-snug text-[var(--dim)]">{stat.label}</p>
          </div>
        ))}
      </Reveal>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="mt-24">
        <Reveal>
          <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Four steps, one screen
          </h2>
          <p className="m-0 mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
            There is nothing to navigate to and no menu to learn. The whole loop happens in
            one place, because every extra click is a second of a ninety-second demo spent on
            something that is not the point.
          </p>
        </Reveal>

        <Reveal className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="lc-step lc-lift rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <span className="font-mono text-xs font-semibold text-[var(--accent)]">{step.n}</span>
              <h3 className="m-0 mt-3 text-base font-bold tracking-tight text-[var(--text)]">
                {step.title}
              </h3>
              <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--dim)]">{step.body}</p>
            </article>
          ))}
        </Reveal>
      </section>

      {/* ── Why it is built this way ────────────────────────── */}
      <section className="mt-24">
        <Reveal>
          <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Three decisions worth defending
          </h2>
        </Reveal>

        <Reveal className="mt-9 grid gap-4 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className="lc-step rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"
            >
              <h3 className="m-0 text-base font-bold tracking-tight text-[var(--text)]">
                {pillar.title}
              </h3>
              <p className="m-0 mt-3 text-sm leading-relaxed text-[var(--dim)]">{pillar.body}</p>
            </article>
          ))}
        </Reveal>
      </section>

      {/* ── Install ─────────────────────────────────────────── */}
      <Reveal
        id="install"
        className="mt-24 scroll-mt-6 rounded-2xl border border-[var(--accent)]/35 bg-[var(--surface)] p-7 sm:p-9"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-xl">
            <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--text)]">
              Put it on your phone
            </h2>
            <p className="m-0 mt-3 text-sm leading-relaxed text-[var(--dim)]">
              FridgeMama installs to a home screen and opens full-screen, with no address bar
              and no browser tabs. It is the same app either way — installing just means the
              camera is one tap from the lock screen, which is where a fridge app belongs.
            </p>

            <ol className="m-0 mt-5 grid list-decimal gap-2.5 pl-5 text-sm text-[var(--dim)] marker:font-semibold marker:text-[var(--accent)]">
              <li>Join the same WiFi as this laptop — or its hotspot.</li>
              <li>
                Open the address on the laptop&rsquo;s screen, the one starting{" "}
                <code className="rounded bg-[var(--raised)] px-1.5 py-0.5 font-mono text-xs text-[var(--text)]">
                  http://192.168.
                </code>
              </li>
              <li>
                <strong className="text-[var(--text)]">Android:</strong> tap{" "}
                <em>Install</em>, or Chrome&rsquo;s menu → <em>Add to Home screen</em>.
                <br />
                <strong className="text-[var(--text)]">iPhone:</strong> tap{" "}
                <em>Share</em> → <em>Add to Home Screen</em>.
              </li>
            </ol>
          </div>

          <div className="grid gap-3">
            <div className="grid place-items-center rounded-2xl border border-[var(--line)] bg-[var(--raised)] p-6">
              <LogoMark size={72} cut="var(--raised)" />
              <p className="m-0 mt-3 text-xs font-semibold text-[var(--text)]">FridgeMama</p>
            </div>
            <InstallButton />
          </div>
        </div>
      </Reveal>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-7">
        <Logo size={30} />
        <p className="m-0 text-xs text-[var(--faint)]">
          AUST CSE Carnival 8.0 · Software &amp; AI · runs entirely on-device
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Open the app →
        </button>
      </footer>
    </div>
  );
}
