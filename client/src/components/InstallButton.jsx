import { useEffect, useState } from "react";

/**
 * "Install" — the one piece of UI that only exists because this is an app.
 *
 * Chrome fires beforeinstallprompt when a page is installable and lets you
 * hold onto the event and fire it later, which is the only way to put the
 * install behind a button of our own instead of a banner the browser decides
 * to show. Safari fires nothing at all and has no API, so iOS gets told where
 * the button is in its own UI rather than being shown a control that cannot
 * work.
 *
 * Once installed, this disappears: an install button inside an installed app
 * is noise, and at a stall every pixel is either explaining the project or
 * getting in its way.
 */

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    // Safari's own, older flag.
    window.navigator.standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [hint, setHint] = useState(false);

  useEffect(() => {
    function onBeforeInstall(event) {
      // Without this the browser shows its own banner and the event is spent.
      event.preventDefault();
      setPrompt(event);
    }

    function onInstalled() {
      setPrompt(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  // iOS: no event will ever arrive, so offer the instruction instead.
  if (!prompt) {
    if (!isIos()) return null;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setHint((open) => !open)}
          className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--raised)]"
        >
          Install
        </button>

        {hint && (
          <p className="lc-rise absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs leading-relaxed text-[var(--dim)] shadow-lg">
            Tap <span className="font-semibold text-[var(--text)]">Share</span>, then{" "}
            <span className="font-semibold text-[var(--text)]">Add to Home Screen</span>.
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        // The event is single-use whichever way it goes. Chrome will fire a
        // fresh one on a later visit if they dismissed it.
        setPrompt(null);
        if (outcome === "accepted") setInstalled(true);
      }}
      className="rounded-full border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--raised)]"
    >
      Install
    </button>
  );
}
