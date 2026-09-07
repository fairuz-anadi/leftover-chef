import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/api";

/**
 * Type-ahead ingredient input backed by /api/ingredients, with a free-text
 * fallback so an ingredient we have never seen can still be added.
 */
export default function IngredientPicker({ onAdd, placeholder = "Add an ingredient…", exclude = [] }) {
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const boxRef = useRef(null);

  const excluded = useMemo(
    () => new Set(exclude.map((name) => String(name).toLowerCase())),
    [exclude]
  );

  useEffect(() => {
    const query = term.trim();
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (query.length < 2) {
        if (!cancelled) setSuggestions([]);
        return;
      }

      try {
        const response = await api.ingredients({ search: query, limit: 8 });
        if (!cancelled) {
          setSuggestions(response.data.filter((item) => !excluded.has(item.name.toLowerCase())));
          setHighlighted(0);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, excluded]);

  useEffect(() => {
    function onClickAway(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  function commit(name) {
    const value = String(name || "").trim();
    if (!value) return;

    onAdd(value);
    setTerm("");
    setSuggestions([]);
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(suggestions[highlighted]?.name ?? term);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, suggestions.length - 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full rounded-[var(--r-pill)] border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
        />
        <button
          type="button"
          onClick={() => commit(term)}
          disabled={!term.trim()}
          className="shrink-0 rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-60 w-full list-none overflow-auto rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white p-1 shadow-[var(--shadow-md)]">
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => commit(item.name)}
                className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm ${
                  index === highlighted ? "bg-[var(--brand-glow)]" : ""
                }`}
              >
                <span>{item.name}</span>
                <small className="text-[var(--muted-light)]">{item.aisle}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
