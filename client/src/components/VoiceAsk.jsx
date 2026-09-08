import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "What can I make for dinner?"
 *
 * Speech recognition in, spoken answer out, both through the browser's own
 * APIs. Web Speech recognition is Chrome-backed and may reach out to the
 * network, which the venue does not have — so the button doubles as a plain
 * "ask" that speaks the answer without listening. The reply itself is built
 * from state we already hold, so the useful half never depends on a network.
 */
export default function VoiceAsk({ suggestions, atRisk, showToast }) {
  const [listening, setListening] = useState(false);
  const [said, setSaid] = useState(null);
  const recognition = useRef(null);

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const listenSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const answer = useCallback(() => {
    const top = suggestions[0];

    if (!top) {
      return "Your fridge is empty, so I can't suggest anything yet. Try scanning a photo.";
    }

    const urgent = atRisk[0];
    const rescue = top.rescues?.[0];

    const opening = urgent
      ? `Your ${urgent.name} needs using — ${urgent.label.toLowerCase()}.`
      : "Nothing is about to spoil.";

    const dish = `I'd cook ${top.recipe.title}. You already have ${top.match_percent} percent of it`;
    const because = rescue ? `, and it uses up your ${rescue.name}.` : ".";

    return `${opening} ${dish}${because}`;
  }, [suggestions, atRisk]);

  const speak = useCallback(
    (text) => {
      setSaid(text);

      if (!speechSupported) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    },
    [speechSupported]
  );

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function ask() {
    speak(answer());
  }

  function listen() {
    if (!listenSupported) {
      ask();
      return;
    }

    const Recogniser = window.SpeechRecognition || window.webkitSpeechRecognition;
    const engine = new Recogniser();
    recognition.current = engine;

    engine.lang = "en-US";
    engine.interimResults = false;
    engine.maxAlternatives = 1;

    engine.onresult = () => speak(answer());
    engine.onerror = () => {
      // Offline is the expected case at the venue, not a failure worth a
      // scary message — answer anyway.
      showToast?.("Couldn't hear that — answering anyway.", "warn");
      speak(answer());
    };
    engine.onend = () => setListening(false);

    try {
      engine.start();
      setListening(true);
    } catch {
      ask();
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={listening ? () => recognition.current?.stop() : listen}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition ${
            listening
              ? "lc-listen bg-[var(--today)] text-white"
              : "bg-[var(--raised)] text-[var(--accent)] hover:bg-[var(--hover)]"
          }`}
          aria-label="Ask what to cook"
        >
          🎙
        </button>
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold text-[var(--text)]">
            {listening ? "Listening…" : "Ask what to cook"}
          </p>
          <p className="m-0 text-xs text-[var(--faint)]">
            {listenSupported ? '"What can I make for dinner?"' : "Tap to hear the answer"}
          </p>
        </div>
        <button
          type="button"
          onClick={ask}
          className="ml-auto shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Answer
        </button>
      </div>

      {said && <p className="mt-3 mb-0 text-sm leading-relaxed text-[var(--dim)]">“{said}”</p>}
    </div>
  );
}
