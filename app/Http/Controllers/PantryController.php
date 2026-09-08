<?php

namespace App\Http\Controllers;

use App\Http\Services\PantryConsumptionService;
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
        $given = $validated['expires_on'] ?? null;
        $estimate = $given === null ? $ingredient->suggestedExpiry() : null;

        PantryItem::updateOrCreate(
            ['user_id' => $request->user()->id, 'ingredient_id' => $ingredient->id],
            [
                'quantity' => $validated['quantity'] ?? null,
                'unit' => $validated['unit'] ?? null,
                'expires_on' => $given ?? $estimate,
                'expiry_estimated' => $given === null && $estimate !== null,
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
     *
     * New items get a use-by date estimated from the ingredient's typical shelf
     * life, because this is the endpoint that adds a dozen things in one tap
     * and nobody is going to date twelve chips by hand. The estimate is marked
     * as such, and an explicit date in the request always wins.
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
        $dated = 0;

        foreach ($validated['items'] as $item) {
            $ingredient = Ingredient::resolve($item['name']);

            $record = PantryItem::firstOrNew([
                'user_id' => $user->id,
                'ingredient_id' => $ingredient->id,
            ]);

            $isNew = !$record->exists;
            $added += $isNew ? 1 : 0;

            $record->source = 'scan';
            $record->detected_as = $item['detected_as'] ?? null;
            $record->confidence = $item['confidence'] ?? null;

            if (!empty($item['expires_on'])) {
                $record->expires_on = $item['expires_on'];
                $record->expiry_estimated = false;
            } elseif ($isNew && ($estimate = $ingredient->suggestedExpiry())) {
                // Only ever fills a blank. Something already on the shelf keeps
                // the date the cook gave it, even if this scan says otherwise.
                $record->expires_on = $estimate;
                $record->expiry_estimated = true;
                $dated++;
            }

            $record->save();
        }

        $total = count($validated['items']);

        return response()->json([
            'message' => $this->confirmationMessage($total, $added, $dated),
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
            $record = PantryItem::firstOrNew([
                'user_id' => $user->id,
                'ingredient_id' => $ingredientId,
            ]);

            // Food arriving without a date gets an estimated one here too, so
            // the shelf behaves the same however it was stocked.
            if (!$record->exists && ($estimate = Ingredient::find($ingredientId)?->suggestedExpiry())) {
                $record->expires_on = $estimate;
                $record->expiry_estimated = true;
            }

            $record->save();
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

        $pantryItem->fill($validated);

        // Whatever the cook types is not an estimate any more, including
        // clearing the field — that is them saying the date does not apply.
        if (array_key_exists('expires_on', $validated)) {
            $pantryItem->expiry_estimated = false;
        }

        $pantryItem->save();

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

    /**
     * Say what happened, including how many dates were guessed.
     *
     * Naming the estimate in the toast is the cheapest possible consent: the
     * cook is told a date was invented for them before they go looking at a
     * shelf that has quietly reordered itself.
     */
    private function confirmationMessage(int $total, int $added, int $dated): string
    {
        $headline = $added === $total
            ? "{$added} ingredients added to your fridge."
            : "{$total} ingredients confirmed ({$added} new).";

        if ($dated === 0) {
            return $headline;
        }

        return $headline . ' ' . ($dated === 1
            ? 'One use-by date estimated — tap it to correct.'
            : "{$dated} use-by dates estimated — tap any to correct.");
    }

    /**
     * Put back what "I cooked this" took out.
     *
     * The undo behind the cook button. Rows come back exactly as they were —
     * date, estimate flag, provenance — because a misclick should cost one tap,
     * not a re-scan.
     */
    public function restore(Request $request, PantryConsumptionService $consumption)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.name' => 'required|string|max:120',
            'items.*.quantity' => 'nullable|numeric|min:0',
            'items.*.unit' => 'nullable|string|max:30',
            'items.*.expires_on' => 'nullable|date',
            'items.*.expiry_estimated' => 'sometimes|boolean',
            'items.*.source' => 'nullable|string|max:20',
        ]);

        $restored = $consumption->restore($request->user(), $validated['items']);

        return response()->json([
            'message' => $restored === 1
                ? '1 ingredient put back.'
                : "{$restored} ingredients put back.",
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
