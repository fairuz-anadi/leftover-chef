import { useEffect, useState } from "react";
import { api } from "../api/api";
import IngredientPicker from "../components/IngredientPicker";
import { useToast } from "../components/useToast";

const SKILL_COPY = {
  beginner: "Show me straightforward recipes with short ingredient lists.",
  intermediate: "I'm comfortable in the kitchen — mix it up.",
  advanced: "Bring on the long braises and laminated dough.",
};

/**
 * Account & Profiles — dietary preferences and skill level, which every
 * search and recommendation reads from.
 */
export default function ProfilePreferences({ user, onUserChange }) {
  const [form, setForm] = useState(null);
  const [options, setOptions] = useState({ diet_options: [], skill_levels: [] });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const response = await api.profile();
        setForm({
          name: response.data.name ?? "",
          skill_level: response.data.skill_level ?? "beginner",
          household_size: response.data.household_size ?? 2,
          dietary_preferences: response.data.dietary_preferences ?? [],
          allergies: response.data.allergies ?? [],
        });
        setOptions(response.meta);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    if (user) load();
  }, [user, showToast]);

  if (!user) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--muted)]">
        Sign in to set your preferences.
      </p>
    );
  }

  if (!form) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--muted)]">Loading…</p>;
  }

  function toggleDiet(diet) {
    setForm((current) => ({
      ...current,
      dietary_preferences: current.dietary_preferences.includes(diet)
        ? current.dietary_preferences.filter((value) => value !== diet)
        : [...current.dietary_preferences, diet],
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.updateProfile(form);
      onUserChange?.(response.data);
      showToast(response.message ?? "Preferences saved.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8">
        <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--brand)]">
          Your profile
        </span>
        <h1 className="mt-2 mb-1 font-[var(--font-display)] text-3xl font-black text-[var(--text)]">
          Cooking preferences
        </h1>
        <p className="m-0 text-sm text-[var(--muted)]">
          These shape what the fridge search and the recipe library show you.
        </p>
      </header>

      <section className="mb-8 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text)]">Display name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>

        <label className="mt-5 grid gap-2">
          <span className="text-sm font-semibold text-[var(--text)]">
            People you usually cook for: {form.household_size}
          </span>
          <input
            type="range"
            min="1"
            max="10"
            value={form.household_size}
            onChange={(event) => setForm({ ...form, household_size: Number(event.target.value) })}
            className="accent-[var(--brand)]"
          />
          <span className="text-xs text-[var(--muted)]">
            Used to scale meal-plan servings and the shopping list.
          </span>
        </label>
      </section>

      <section className="mb-8 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <h2 className="m-0 mb-4 text-base font-bold text-[var(--text)]">Skill level</h2>
        <div className="grid gap-2">
          {options.skill_levels.map((level) => (
            <label
              key={level}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--r-sm)] border p-4 ${
                form.skill_level === level
                  ? "border-[var(--brand)] bg-[var(--brand-glow)]"
                  : "border-[var(--border-strong)]"
              }`}
            >
              <input
                type="radio"
                name="skill_level"
                value={level}
                checked={form.skill_level === level}
                onChange={() => setForm({ ...form, skill_level: level })}
                className="mt-1 accent-[var(--brand)]"
              />
              <span>
                <span className="block text-sm font-semibold capitalize text-[var(--text)]">{level}</span>
                <span className="text-xs text-[var(--muted)]">{SKILL_COPY[level]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <h2 className="m-0 mb-1 text-base font-bold text-[var(--text)]">Dietary preferences</h2>
        <p className="mt-0 mb-4 text-xs text-[var(--muted)]">
          Recipes must carry every tag you pick to show up in your results.
        </p>
        <div className="flex flex-wrap gap-2">
          {options.diet_options.map((diet) => (
            <button
              key={diet}
              type="button"
              onClick={() => toggleDiet(diet)}
              className={`rounded-[var(--r-pill)] border px-4 py-1.5 text-sm capitalize ${
                form.dietary_preferences.includes(diet)
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-strong)] hover:border-[var(--accent)]"
              }`}
            >
              {diet.replace("-", " ")}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-6">
        <h2 className="m-0 mb-1 text-base font-bold text-[var(--text)]">Allergies</h2>
        <p className="mt-0 mb-4 text-xs text-[var(--muted)]">
          Any recipe containing these ingredients is hidden from your searches.
        </p>

        <IngredientPicker
          placeholder="Peanuts, shellfish…"
          exclude={form.allergies}
          onAdd={(name) =>
            setForm((current) =>
              current.allergies.some((value) => value.toLowerCase() === name.toLowerCase())
                ? current
                : { ...current, allergies: [...current.allergies, name] }
            )
          }
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {form.allergies.map((allergy) => (
            <span
              key={allergy}
              className="inline-flex items-center gap-2 rounded-[var(--r-pill)] bg-[rgba(15,81,50,0.12)] py-1.5 pl-3 pr-2 text-sm text-[var(--brand-deep)]"
            >
              {allergy}
              <button
                type="button"
                aria-label={`Remove ${allergy}`}
                onClick={() =>
                  setForm({
                    ...form,
                    allergies: form.allergies.filter((value) => value !== allergy),
                  })
                }
                className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(10,58,36,0.15)] text-xs leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-[var(--r-pill)] bg-[var(--brand)] px-7 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
