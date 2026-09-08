<?php

namespace App\Http\Services;

use App\Models\FridgeSession;
use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\Recipe;

/**
 * "I cooked this" — taking the ingredients back out of the fridge.
 *
 * The last link in the loop. Detection puts food in, freshness tracking warns
 * about it, the suggestion engine says what to cook, and this records that it
 * actually got eaten. Without it the shelf keeps claiming you own spinach you
 * finished on Tuesday, the dashboard reports a health score for food that no
 * longer exists, and the waste counter has nothing to count.
 *
 * Staples stay. `ingredients.is_staple` marks the things nobody restocks per
 * meal, so salt and oil are offered but unticked — you do not run out of salt
 * because you cooked one dish.
 */
class PantryConsumptionService
{
    public function __construct(private readonly FreshnessService $freshness = new FreshnessService())
    {
    }

    /**
     * What this recipe could take out of the fridge.
     *
     * Only required ingredients actually held: a recipe does not consume the
     * garlic you were going to buy, and an optional garnish should not quietly
     * empty your coriander.
     *
     * @return array<int, array<string, mixed>>
     */
    public function plan(FridgeSession $session, Recipe $recipe): array
    {
        $statuses = $this->freshness->statuses($session);

        $held = $session->pantryItems()
            ->with('ingredient:id,name,slug,aisle,is_staple')
            ->get()
            ->keyBy('ingredient_id');

        return $recipe->ingredientRecords
            ->reject(fn ($ingredient) => (bool) $ingredient->pivot->is_optional)
            ->map(fn ($ingredient) => $held->get($ingredient->id))
            ->filter(fn (?PantryItem $item) => $item !== null && $item->ingredient !== null)
            ->unique('id')
            ->map(function (PantryItem $item) use ($statuses) {
                $staple = (bool) $item->ingredient->is_staple;

                return [
                    'pantry_item_id' => $item->id,
                    'ingredient_id' => (int) $item->ingredient_id,
                    'name' => $item->ingredient->name,
                    'is_staple' => $staple,
                    'consume_by_default' => !$staple,
                    'freshness' => $statuses->get($item->ingredient_id),
                ];
            })
            ->sortBy([
                fn (array $a, array $b) => $a['is_staple'] <=> $b['is_staple'],
                fn (array $a, array $b) => strcmp($a['name'], $b['name']),
            ])
            ->values()
            ->all();
    }

    /**
     * Remove the ticked items and report what was saved from the bin.
     *
     * Each removed row comes back complete enough to put straight back, because
     * "and it's gone" needs an undo or it is just a way to lose your fridge to
     * a misclick.
     *
     * @param  array<int, int>  $pantryItemIds
     * @return array{removed: array<int, array<string, mixed>>, rescued: array<int, array<string, mixed>>}
     */
    public function consume(FridgeSession $session, array $pantryItemIds): array
    {
        $statuses = $this->freshness->statuses($session);

        $items = $session->pantryItems()
            ->with('ingredient:id,name,slug')
            ->whereIn('id', $pantryItemIds)
            ->get()
            ->filter(fn (PantryItem $item) => $item->ingredient !== null);

        $removed = $items->map(fn (PantryItem $item) => [
            'name' => $item->ingredient->name,
            'expires_on' => $item->expires_on?->toDateString(),
            'expiry_estimated' => (bool) $item->expiry_estimated,
            'source' => $item->source,
        ])->values();

        // Worked out before the delete — afterwards there is nothing left to
        // read the urgency off.
        $rescued = $items
            ->map(fn (PantryItem $item) => $statuses->get($item->ingredient_id))
            ->filter(fn (?array $row) => $row !== null && $row['urgency'] > 0)
            ->sortByDesc('urgency')
            ->values();

        PantryItem::whereIn('id', $items->pluck('id'))->delete();

        return ['removed' => $removed->all(), 'rescued' => $rescued->all()];
    }

    /**
     * Put back what a cook decided they had not used after all.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    public function restore(FridgeSession $session, array $items): int
    {
        $restored = 0;

        foreach ($items as $item) {
            $name = trim((string) ($item['name'] ?? ''));

            if ($name === '') {
                continue;
            }

            $ingredient = Ingredient::resolve($name);

            PantryItem::updateOrCreate(
                ['session_id' => $session->session_id, 'ingredient_id' => $ingredient->id],
                [
                    // Restored exactly as it was; an undo does not re-guess a
                    // date, because the date it had was already the answer.
                    'expires_on' => $item['expires_on'] ?? null,
                    'expiry_estimated' => (bool) ($item['expiry_estimated'] ?? false),
                    'source' => $item['source'] ?? 'manual',
                ]
            );

            $restored++;
        }

        return $restored;
    }

    /** @return array<int, int> */
    public function defaultSelection(FridgeSession $session, Recipe $recipe): array
    {
        return collect($this->plan($session, $recipe))
            ->filter(fn (array $row) => $row['consume_by_default'])
            ->pluck('pantry_item_id')
            ->all();
    }

    /** @param array<int, array<string, mixed>> $rescued */
    public function rescueMessage(array $rescued): ?string
    {
        $names = collect($rescued)->pluck('name');

        if ($names->isEmpty()) {
            return null;
        }

        if ($names->count() === 1) {
            return "You used up {$names->first()} before it went off.";
        }

        $last = $names->pop();

        return 'You used up ' . $names->implode(', ') . " and {$last} before they went off.";
    }
}
