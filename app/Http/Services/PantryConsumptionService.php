<?php

namespace App\Http\Services;

use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * "I cooked this" — taking the ingredients back out of the fridge.
 *
 * Without this the two halves of the app never meet: the scanner puts food in,
 * the ranking tells you to use it, and then the fridge still claims you own
 * spinach you ate on Tuesday. A stale shelf makes the expiry ranking wrong in
 * the most annoying possible way — it keeps recommending a rescue that already
 * happened.
 *
 * Two rules do most of the work:
 *
 * - **Staples stay.** You do not run out of salt because you cooked one dish.
 *   `ingredients.is_staple` already marks the 26 things nobody restocks per
 *   meal, so they are unticked by default rather than removed.
 * - **Nothing is removed that the cook did not tick.** The plan is a
 *   suggestion; the request says what actually goes.
 */
class PantryConsumptionService
{
    public function __construct(private readonly UseItUpService $useItUp = new UseItUpService())
    {
    }

    /**
     * What this recipe could take out of the cook's fridge.
     *
     * Only required ingredients they actually hold — a recipe does not consume
     * the garlic you were going to buy, and an optional garnish should not
     * quietly empty your parsley.
     *
     * @return array<int, array<string, mixed>>
     */
    public function plan(?User $user, Recipe $recipe): array
    {
        if (!$user) {
            return [];
        }

        $urgency = $this->useItUp->urgencyFor($user);

        $held = $user->pantryItems()
            ->with('ingredient:id,name,slug,aisle,is_staple')
            ->get()
            ->keyBy('ingredient_id');

        return $recipe->ingredientRecords
            ->reject(fn ($ingredient) => (bool) $ingredient->pivot->is_optional)
            ->map(fn ($ingredient) => $held->get($ingredient->id))
            ->filter(fn (?PantryItem $item) => $item !== null && $item->ingredient !== null)
            ->unique('id')
            ->map(function (PantryItem $item) use ($urgency) {
                $staple = (bool) $item->ingredient->is_staple;

                return [
                    'pantry_item_id' => $item->id,
                    'ingredient_id' => (int) $item->ingredient_id,
                    'name' => $item->ingredient->name,
                    'aisle' => $item->ingredient->aisle,
                    'is_staple' => $staple,
                    // Staples are offered but not ticked. Everything else is
                    // the food you just cooked, so it goes.
                    'consume_by_default' => !$staple,
                    'expiry' => $urgency->get($item->ingredient_id),
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
     * Remove the ticked items, and report what was saved from the bin.
     *
     * Returns enough of each removed row to put it back exactly as it was —
     * date, estimate flag and all — because "and it's gone" needs an undo or
     * it is just a way to lose your fridge to a misclick.
     *
     * @param  array<int, int>  $pantryItemIds
     * @return array{removed: array<int, array<string, mixed>>, rescued: array<int, array<string, mixed>>}
     */
    public function consume(User $user, array $pantryItemIds): array
    {
        $urgency = $this->useItUp->urgencyFor($user);

        $items = $user->pantryItems()
            ->with('ingredient:id,name,slug')
            ->whereIn('id', $pantryItemIds)
            ->get()
            ->filter(fn (PantryItem $item) => $item->ingredient !== null);

        $removed = $items->map(fn (PantryItem $item) => [
            'name' => $item->ingredient->name,
            'quantity' => $item->quantity,
            'unit' => $item->unit,
            'expires_on' => $item->expires_on?->toDateString(),
            'expiry_estimated' => (bool) $item->expiry_estimated,
            'source' => $item->source,
        ])->values();

        // Worked out before the delete, because afterwards there is nothing to
        // read the urgency off.
        $rescued = $items
            ->map(fn (PantryItem $item) => $urgency->get($item->ingredient_id))
            ->filter(fn (?array $row) => $row !== null && $row['urgency'] > 0)
            ->sortByDesc('urgency')
            ->values();

        PantryItem::whereIn('id', $items->pluck('id'))->delete();

        return ['removed' => $removed->all(), 'rescued' => $rescued->all()];
    }

    /**
     * Put back what a cook decided they had not actually used.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    public function restore(User $user, array $items): int
    {
        $restored = 0;

        foreach ($items as $item) {
            $name = trim((string) ($item['name'] ?? ''));

            if ($name === '') {
                continue;
            }

            $ingredient = Ingredient::resolve($name);

            $record = PantryItem::firstOrNew([
                'user_id' => $user->id,
                'ingredient_id' => $ingredient->id,
            ]);

            // An undo restores the row as it was; it does not re-estimate a
            // date, because the date it had was already the right answer.
            $record->quantity = $item['quantity'] ?? null;
            $record->unit = $item['unit'] ?? null;
            $record->expires_on = $item['expires_on'] ?? null;
            $record->expiry_estimated = (bool) ($item['expiry_estimated'] ?? false);
            $record->source = $item['source'] ?? 'manual';
            $record->save();

            $restored++;
        }

        return $restored;
    }

    /**
     * The ids to remove when the caller did not name any — the default plan.
     *
     * @return array<int, int>
     */
    public function defaultSelection(?User $user, Recipe $recipe): array
    {
        return collect($this->plan($user, $recipe))
            ->filter(fn (array $row) => $row['consume_by_default'])
            ->pluck('pantry_item_id')
            ->all();
    }

    /** @param Collection<int, array<string, mixed>>|array<int, array<string, mixed>> $rescued */
    public function rescueMessage($rescued): ?string
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
