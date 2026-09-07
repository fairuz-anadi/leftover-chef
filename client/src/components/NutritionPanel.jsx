/**
 * Nutrition Insights — calories and macro split for one serving.
 */
export default function NutritionPanel({ nutrition, servings, compact = false }) {
  if (!nutrition || nutrition.calories === undefined) {
    return null;
  }

  const macros = [
    { key: "protein_g", label: "Protein", value: nutrition.protein_g, colour: "#b5762a" },
    { key: "carbs_g", label: "Carbs", value: nutrition.carbs_g, colour: "#c79a3e" },
    { key: "fat_g", label: "Fat", value: nutrition.fat_g, colour: "#0f5132" },
  ];

  // Macro calories, so the bar reflects energy share rather than raw grams.
  const energy = macros.map((macro) => ({
    ...macro,
    kcal: macro.key === "fat_g" ? macro.value * 9 : macro.value * 4,
  }));
  const totalEnergy = energy.reduce((sum, macro) => sum + macro.kcal, 0) || 1;

  if (compact) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <strong className="text-sm text-[var(--text)]">{nutrition.calories} kcal</strong>
        {macros.map((macro) => (
          <span key={macro.key}>
            {macro.label} {macro.value}g
          </span>
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-base font-bold text-[var(--text)]">Nutrition Insights</h3>
        <span className="text-xs text-[var(--muted)]">
          per serving{servings ? ` · ${servings} servings` : ""}
        </span>
      </header>

      <div className="mb-4 flex items-end gap-2">
        <span className="font-[var(--font-display)] text-4xl font-black leading-none text-[var(--brand-deep)]">
          {nutrition.calories}
        </span>
        <span className="pb-1 text-sm text-[var(--muted)]">kcal</span>
      </div>

      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-[rgba(20,24,27,0.08)]">
        {energy.map((macro) => (
          <div
            key={macro.key}
            title={`${macro.label} ${macro.value}g`}
            style={{ width: `${(macro.kcal / totalEnergy) * 100}%`, background: macro.colour }}
          />
        ))}
      </div>

      <dl className="m-0 grid grid-cols-3 gap-3">
        {macros.map((macro) => (
          <div key={macro.key}>
            <dt className="text-[0.7rem] uppercase tracking-wider text-[var(--muted)]">{macro.label}</dt>
            <dd className="m-0 text-lg font-semibold text-[var(--text)]">{macro.value}g</dd>
          </div>
        ))}
      </dl>

      {nutrition.coverage !== undefined && nutrition.coverage < 1 && (
        <p className="mt-4 mb-0 text-xs text-[var(--muted-light)]">
          Estimated from {Math.round(nutrition.coverage * 100)}% of the ingredient list.
        </p>
      )}
    </section>
  );
}
