<?php

namespace App\Http\Controllers;

use App\Http\Services\UseItUpService;
use App\Models\Ingredient;
use App\Models\PantryItem;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * "What's in my fridge" — the cook's own ingredient shelf.
 */
class PantryController extends Controller
{
    public function __construct(private UseItUpService $useItUp)
    {
    }

    public function index(Request $request)
    {
        return response()->json([
            'data' => $this->itemsFor($request),
            'meta' => $this->expiryMeta($request),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'quantity' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:30',
            'expires_on' => 'nullable|date',
        ]);

        $ingredient = Ingredient::resolve($validated['name']);

        PantryItem::updateOrCreate(
            ['user_id' => $request->user()->id, 'ingredient_id' => $ingredient->id],
            [
                'quantity' => $validated['quantity'] ?? null,
                'unit' => $validated['unit'] ?? null,
                'expires_on' => $validated['expires_on'] ?? null,
                'source' => 'manual',
            ]
        );

        return response()->json([
            'message' => $ingredient->name . ' added to your fridge.',
            'data' => $this->itemsFor($request),
            'meta' => $this->expiryMeta($request),
        ], Response::HTTP_CREATED);
    }

    /**
     * Commit the chips a cook confirmed after a scan.
     *
     * Additive on purpose — a photo of the top shelf should not delete the rice
     * in the cupboard. Items already on the shelf keep whatever expiry date the
     * cook set; only the provenance is refreshed.
     */
    public function confirmScan(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.name' => 'required|string|max:120',
            'items.*.confidence' => 'nullable|numeric|min:0|max:1',
            'items.*.detected_as' => 'nullable|string|max:120',
            'items.*.expires_on' => 'nullable|date',
        ]);

        $user = $request->user();
        $added = 0;

        foreach ($validated['items'] as $item) {
            $ingredient = Ingredient::resolve($item['name']);

            $record = PantryItem::firstOrNew([
                'user_id' => $user->id,
                'ingredient_id' => $ingredient->id,
            ]);

            $added += $record->exists ? 0 : 1;

            $record->source = 'scan';
            $record->detected_as = $item['detected_as'] ?? null;
            $record->confidence = $item['confidence'] ?? null;

            if (!empty($item['expires_on'])) {
                $record->expires_on = $item['expires_on'];
            }

            $record->save();
        }

        $total = count($validated['items']);

        return response()->json([
            'message' => $added === $total
                ? "{$added} ingredients added to your fridge."
                : "{$total} ingredients confirmed ({$added} new).",
            'data' => $this->itemsFor($request),
            'meta' => $this->expiryMeta($request),
        ], Response::HTTP_CREATED);
    }

    /** Replace the whole shelf in one call — used by the "quick add" chips. */
    public function sync(Request $request)
    {
        $validated = $request->validate([
            'names' => 'present|array',
            'names.*' => 'required|string|max:120',
        ]);

        $user = $request->user();
        $ids = collect($validated['names'])
            ->map(fn ($name) => Ingredient::resolve($name)->id)
            ->unique();

        $user->pantryItems()->whereNotIn('ingredient_id', $ids)->delete();

        foreach ($ids as $ingredientId) {
            PantryItem::firstOrCreate([
                'user_id' => $user->id,
                'ingredient_id' => $ingredientId,
            ]);
        }

        return response()->json([
            'message' => 'Fridge updated.',
            'data' => $this->itemsFor($request),
            'meta' => $this->expiryMeta($request),
        ]);
    }

    /** Set or clear the use-by date on one shelf item. */
    public function update(Request $request, PantryItem $pantryItem)
    {
        if ((string) $pantryItem->user_id !== (string) $request->user()->id) {
            return response()->json([
                'message' => 'You can only edit your own fridge.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'expires_on' => 'present|nullable|date',
            'quantity' => 'sometimes|nullable|numeric|min:0',
            'unit' => 'sometimes|nullable|string|max:30',
        ]);

        $pantryItem->fill($validated)->save();

        return response()->json([
            'message' => 'Fridge updated.',
            'data' => $this->itemsFor($request),
            'meta' => $this->expiryMeta($request),
        ]);
    }

    public function destroy(Request $request, PantryItem $pantryItem)
    {
        if ((string) $pantryItem->user_id !== (string) $request->user()->id) {
            return response()->json([
                'message' => 'You can only edit your own fridge.',
            ], Response::HTTP_FORBIDDEN);
        }

        $pantryItem->delete();

        return response()->json([
            'message' => 'Item removed from your fridge.',
            'data' => $this->itemsFor($request),
            'meta' => $this->expiryMeta($request),
        ]);
    }

    /** GET /api/pantry/expiring — the "cook this tonight" shelf. */
    public function expiring(Request $request)
    {
        $within = (int) $request->integer('within', UseItUpService::SHELF_DAYS);

        return response()->json([
            'data' => $this->useItUp->expiringSoon($request->user(), max(0, min($within, 30))),
            'meta' => ['within_days' => $within],
        ]);
    }

    private function itemsFor(Request $request)
    {
        $urgency = $this->useItUp->urgencyFor($request->user());

        return $request->user()
            ->pantryItems()
            ->with('ingredient:id,name,slug,aisle')
            ->get()
            ->sortBy(fn (PantryItem $item) => $item->ingredient?->name)
            ->values()
            ->map(function (PantryItem $item) use ($urgency) {
                // days_left / state travel with the item so a chip can colour
                // itself without every caller re-deriving the same arithmetic.
                $item->setAttribute('expiry', $urgency->get($item->ingredient_id));

                return $item;
            });
    }

    /** @return array<string, mixed> */
    private function expiryMeta(Request $request): array
    {
        $soon = $this->useItUp->expiringSoon($request->user());

        return [
            'expiring_soon_count' => $soon->count(),
            'soonest_days_left' => $soon->first()['days_left'] ?? null,
        ];
    }
}
