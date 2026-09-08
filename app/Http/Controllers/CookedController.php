<?php

namespace App\Http\Controllers;

use App\Http\Services\FreshnessService;
use App\Http\Services\PantryConsumptionService;
use App\Http\Services\RecipeSuggestionService;
use App\Http\Services\WasteLedger;
use App\Models\FridgeSession;
use App\Models\Recipe;
use Illuminate\Http\Request;

/**
 * POST /api/recipes/{recipe}/cooked — the moment the counter moves.
 *
 * Everything else in the app is a prediction: this is the only place it finds
 * out whether the food was actually eaten in time. Each ingredient removed
 * while it still had life left is logged as rescued, which is what the
 * waste-saved number counts.
 */
class CookedController extends Controller
{
    public function __construct(
        private PantryConsumptionService $consumption,
        private WasteLedger $ledger,
        private FreshnessService $freshness,
        private RecipeSuggestionService $suggestions,
    ) {
    }

    public function store(Request $request, Recipe $recipe)
    {
        $validated = $request->validate([
            // Omit it and we take the default plan: everything the recipe needs
            // that is in the fridge and is not a cupboard staple.
            'pantry_item_ids' => 'sometimes|array',
            'pantry_item_ids.*' => 'integer',
        ]);

        $session = $this->fridge($request);

        $ids = array_key_exists('pantry_item_ids', $validated)
            ? $validated['pantry_item_ids']
            : $this->consumption->defaultSelection($session, $recipe);

        if ($ids === []) {
            return response()->json([
                'message' => 'Nice one. Nothing to take out of your fridge.',
                'removed' => [],
                'rescued' => [],
            ] + $this->state($session));
        }

        $result = $this->consumption->consume($session, $ids, $recipe);
        $this->ledger->recordRescues($session, $result['rescued']);

        return response()->json([
            'message' => $this->message(count($result['removed']), $this->consumption->rescueMessage($result['rescued'])),
            'removed' => $result['removed'],
            'rescued' => $result['rescued'],
        ] + $this->state($session));
    }

    /** Undo — put back what they had not actually used. */
    public function restore(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.name' => 'required|string|max:120',
            'items.*.expires_on' => 'nullable|date',
            'items.*.expiry_estimated' => 'sometimes|boolean',
            'items.*.source' => 'nullable|string|max:20',
            'items.*.detected_as' => 'nullable|string|max:120',
            'items.*.confidence' => 'nullable|numeric|min:0|max:1',
        ]);

        $session = $this->fridge($request);
        $restored = $this->consumption->restore($session, $validated['items']);

        // The rescues those items earned are withdrawn too. A counter that
        // only ever goes up is not a measurement.
        $session->wasteEvents()
            ->rescued()
            ->whereIn('ingredient_name', collect($validated['items'])->pluck('name'))
            ->latest('id')
            ->take($restored)
            ->get()
            ->each->delete();

        return response()->json([
            'message' => $restored === 1 ? '1 ingredient put back.' : "{$restored} ingredients put back.",
        ] + $this->state($session));
    }

    private function message(int $count, ?string $rescue): string
    {
        $headline = $count === 1
            ? '1 ingredient taken out of your fridge.'
            : "{$count} ingredients taken out of your fridge.";

        return $rescue ? "{$headline} {$rescue}" : $headline;
    }

    /** @return array<string, mixed> */
    private function state(FridgeSession $session): array
    {
        return [
            'health' => $this->freshness->health($session),
            'waste' => $this->ledger->summary($session),
            'leaderboard' => $this->ledger->leaderboard($session),
            'at_risk' => $this->freshness->atRisk($session)->all(),
            'suggestions' => $this->suggestions->suggest($session)->all(),
        ];
    }
}
