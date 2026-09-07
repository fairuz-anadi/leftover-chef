<?php

namespace App\Http\Controllers;

use App\Models\Ingredient;
use App\Models\MealPlanEntry;
use App\Models\Recipe;
use App\Models\ShoppingListItem;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Auto Shopping List — everything a week of planned meals needs that the
 * fridge does not already have, grouped by supermarket aisle.
 */
class ShoppingListController extends Controller
{
    public function index(Request $request)
    {
        return response()->json($this->payload($request));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'quantity' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:30',
        ]);

        $ingredient = Ingredient::resolve($validated['name']);

        ShoppingListItem::create([
            'user_id' => $request->user()->id,
            'ingredient_id' => $ingredient->id,
            'name' => $ingredient->name,
            'quantity' => $validated['quantity'] ?? null,
            'unit' => $validated['unit'] ?? null,
            'aisle' => $ingredient->aisle,
            'source' => 'manual',
        ]);

        return response()->json(
            array_merge($this->payload($request), ['message' => 'Added to your shopping list.']),
            Response::HTTP_CREATED
        );
    }

    /**
     * Build the list from the planned week (default) or from an explicit set
     * of recipes. Anything already in the fridge is left off.
     */
    public function generate(Request $request)
    {
        $validated = $request->validate([
            'week_start' => 'sometimes|nullable|date',
            'recipe_ids' => 'sometimes|array',
            'recipe_ids.*' => 'integer|exists:recipes,id',
            'ignore_pantry' => 'sometimes|boolean',
            'replace' => 'sometimes|boolean',
        ]);

        $user = $request->user();

        /** @var Collection<int, array{recipe: Recipe, servings: int}> $sources */
        $sources = collect();

        if (!empty($validated['recipe_ids'])) {
            $sources = Recipe::with('ingredientRecords')
                ->whereIn('id', $validated['recipe_ids'])
                ->get()
                ->map(fn (Recipe $recipe) => [
                    'recipe' => $recipe,
                    'servings' => max(1, (int) ($user->household_size ?: $recipe->servings)),
                ]);
        } else {
            $start = Carbon::parse($validated['week_start'] ?? Carbon::today())->startOfWeek(Carbon::MONDAY);
            $end = $start->copy()->addDays(6);

            $sources = $user->mealPlanEntries()
                ->with('recipe.ingredientRecords')
                ->whereBetween('plan_date', [$start->toDateString(), $end->toDateString()])
                ->get()
                ->filter(fn (MealPlanEntry $entry) => (bool) $entry->recipe)
                ->map(fn (MealPlanEntry $entry) => [
                    'recipe' => $entry->recipe,
                    'servings' => max(1, (int) $entry->servings),
                ]);
        }

        if ($sources->isEmpty()) {
            return response()->json(array_merge($this->payload($request), [
                'message' => 'Nothing planned yet — add recipes to your meal plan first.',
            ]));
        }

        $pantryIds = ($validated['ignore_pantry'] ?? false)
            ? collect()
            : $user->pantryItems()->pluck('ingredient_id');

        $aggregated = $this->aggregate($sources, $pantryIds);

        if ($validated['replace'] ?? true) {
            $user->shoppingListItems()->where('source', 'auto')->delete();
        }

        foreach ($aggregated as $row) {
            $existing = $user->shoppingListItems()
                ->where('ingredient_id', $row['ingredient_id'])
                ->where('unit', $row['unit'])
                ->first();

            if ($existing) {
                $existing->update([
                    'quantity' => $row['quantity'] === null ? $existing->quantity : ($existing->quantity ?? 0) + $row['quantity'],
                    'recipe_titles' => collect($existing->recipe_titles ?? [])
                        ->merge($row['recipe_titles'])->unique()->values()->all(),
                ]);
                continue;
            }

            ShoppingListItem::create(array_merge($row, [
                'user_id' => $user->id,
                'source' => 'auto',
            ]));
        }

        return response()->json(array_merge($this->payload($request), [
            'message' => 'Shopping list generated from your meal plan.',
        ]));
    }

    public function update(Request $request, ShoppingListItem $shoppingListItem)
    {
        if ((string) $shoppingListItem->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own list.'], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'is_checked' => 'sometimes|boolean',
            'quantity' => 'sometimes|nullable|numeric|min:0',
            'unit' => 'sometimes|nullable|string|max:30',
        ]);

        $shoppingListItem->fill($validated)->save();

        return response()->json($this->payload($request));
    }

    public function destroy(Request $request, ShoppingListItem $shoppingListItem)
    {
        if ((string) $shoppingListItem->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own list.'], Response::HTTP_FORBIDDEN);
        }

        $shoppingListItem->delete();

        return response()->json($this->payload($request));
    }

    /** Clear the whole list, or just the ticked-off rows. */
    public function clear(Request $request)
    {
        $query = $request->user()->shoppingListItems();

        if ($request->boolean('checked_only')) {
            $query->where('is_checked', true);
        }

        $query->delete();

        return response()->json(array_merge($this->payload($request), [
            'message' => 'Shopping list cleared.',
        ]));
    }

    /**
     * @param  Collection<int, array{recipe: Recipe, servings: int}>  $sources
     * @param  Collection<int, int>  $pantryIds
     */
    private function aggregate(Collection $sources, Collection $pantryIds): array
    {
        $rows = [];

        foreach ($sources as $source) {
            /** @var Recipe $recipe */
            $recipe = $source['recipe'];
            $scale = $source['servings'] / max(1, (int) ($recipe->servings ?: 1));

            foreach ($recipe->ingredientRecords as $ingredient) {
                if ($pantryIds->contains($ingredient->id)) {
                    continue;
                }

                $unit = $ingredient->pivot->unit;
                $key = $ingredient->id . '|' . ($unit ?? '');
                $quantity = $ingredient->pivot->quantity === null
                    ? null
                    : round((float) $ingredient->pivot->quantity * $scale, 2);

                if (isset($rows[$key])) {
                    if ($quantity !== null) {
                        $rows[$key]['quantity'] = ($rows[$key]['quantity'] ?? 0) + $quantity;
                    }
                    $rows[$key]['recipe_titles'][] = $recipe->title;
                    continue;
                }

                $rows[$key] = [
                    'ingredient_id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'quantity' => $quantity,
                    'unit' => $unit,
                    'aisle' => $ingredient->aisle,
                    'recipe_titles' => [$recipe->title],
                ];
            }
        }

        return collect($rows)
            ->map(function (array $row) {
                $row['recipe_titles'] = array_values(array_unique($row['recipe_titles']));

                return $row;
            })
            ->values()
            ->all();
    }

    private function payload(Request $request): array
    {
        $items = $request->user()
            ->shoppingListItems()
            ->orderBy('aisle')
            ->orderBy('name')
            ->get();

        return [
            'data' => $items,
            'meta' => [
                'total' => $items->count(),
                'remaining' => $items->where('is_checked', false)->count(),
                'by_aisle' => $items->groupBy('aisle')->map->count(),
                'shareable_text' => $this->shareableText($items),
            ],
        ];
    }

    /** Plain-text version for the "share list" button. */
    private function shareableText(Collection $items): string
    {
        if ($items->isEmpty()) {
            return 'Shopping list is empty.';
        }

        $lines = ['Leftover Chef shopping list', ''];

        foreach ($items->groupBy('aisle') as $aisle => $group) {
            $lines[] = strtoupper((string) $aisle);
            foreach ($group as $item) {
                $amount = trim($this->formatQuantity($item->quantity) . ' ' . ($item->unit ?? ''));
                $lines[] = '  [' . ($item->is_checked ? 'x' : ' ') . '] '
                    . trim($amount . ' ' . $item->name);
            }
            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    /**
     * "600.00" prints as 600 and "266.67" stays put — only zeros *after* a
     * decimal point are dropped.
     */
    private function formatQuantity(?float $quantity): string
    {
        if ($quantity === null || $quantity <= 0) {
            return '';
        }

        if (abs($quantity - round($quantity)) < 0.005) {
            return (string) (int) round($quantity);
        }

        return rtrim(rtrim(number_format($quantity, 2, '.', ''), '0'), '.');
    }
}
