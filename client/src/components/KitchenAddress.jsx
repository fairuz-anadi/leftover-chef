import { useState } from "react";
import { kitchenHost, pingKitchen, setKitchenHost } from "../api";
import { LogoMark } from "./Logo";

/**
 * "Where is the kitchen?" — the Android app's first screen, and the only
 * configuration this project has anywhere.
 *
 * The detector, the recipes and the fridge all live on the laptop. The phone
 * is a screen and a camera. That is not a limitation to hide behind a loading
 * spinner; it is the architecture, and a judge who asks "where does the AI
 * run?" deserves a screen that already answered them.
 *
 * The address is checked before it is saved. "Saved" and "works" being
 * different things is how somebody ends up staring at a spinner with a judge
 * waiting.
 */
export default function KitchenAddress({ onConnected, onCancel = null }) {
  const [value, setValue] = useState(() => kitchenHost().replace(/^https?:\/\//, ""));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function connect(event) {
    event.preventDefault();
    setChecking(true);
    setError(null);

    try {
      const host = await pingKitchen(value);
      setKitchenHost(host);
      onConnected(host);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <form onSubmit={connect} className="w-full max-w-sm">
        <div className="grid justify-items-center text-center">
          <LogoMark size={72} cut="var(--bg)" />
          <h1 className="m-0 mt-5 text-2xl font-bold tracking-tight text-[var(--text)]">
            Find the kitchen
          </h1>
          <p className="m-0 mt-3 text-sm leading-relaxed text-[var(--dim)]">
            FridgeMama does its thinking on the laptop. Put this phone on the same
            WiFi, then type the address the laptop is showing.
          </p>
        </div>

        <label
          htmlFor="kitchen"
          className="mt-8 block text-[10px] font-semibold uppercase tracking-widest text-[var(--faint)]"
        >
          Laptop address
        </label>

        <input
          id="kitchen"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="192.168.0.203"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          inputMode="url"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 font-mono text-base text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        <p className="m-0 mt-2 text-xs text-[var(--faint)]">
          Just the numbers is enough — port 8000 is assumed.
        </p>

        {error && (
          <p
            role="alert"
            className="lc-rise m-0 mt-4 rounded-xl border border-[var(--today-line)] bg-[var(--today-soft)] px-3 py-2.5 text-xs text-[var(--today)]"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={checking}
          className="mt-6 w-full rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 disabled:opacity-50"
        >
          {checking ? "Knocking…" : "Connect"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 w-full rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold text-[var(--dim)]"
          >
            Cancel
          </button>
        )}

        <p className="m-0 mt-7 text-center text-xs leading-relaxed text-[var(--faint)]">
          Run <code className="font-mono">start-demo.ps1</code> on the laptop. It prints
          the address on the line that starts <em>On your phone</em>.
        </p>
      </form>
    </div>
  );
}
