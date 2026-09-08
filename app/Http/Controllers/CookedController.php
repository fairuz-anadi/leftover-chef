<?php

namespace App\Http\Controllers;

use App\Http\Services\PantryConsumptionService;
use App\Http\Services\UseItUpService;
use App\Models\Recipe;
use Illuminate\Http\Request;

/**
 * POST /api/recipes/{recipe}/cooked — "I cooked this, take it out of my fridge."
 *
 * The step that closes the loop. Scan puts food in, the ranking says what to
 * cook, and this takes the food back out — otherwise the shelf keeps insisting
 * you own spinach you ate on Tuesday, and the expiry ranking spends the rest of
 * the week recommending a rescue that already happened.
 */
class CookedController extends Controller
{
    public function __construct(
        private PantryConsumptionService $consumption,
        private UseItUpService $useItUp,
    ) {
    }

    public function store(Request $request, Recipe $recipe)
    {
        $validated = $request->validate([
            // Omit it entirely and we take the default plan: everything this
            // recipe needs that is in the fridge and is not a cupboard staple.
            'pantry_item_ids' => 'sometimes|array',
            'pantry_item_ids.*' => 'integer',
        ]);

        $user = $request->user();

        $ids = array_key_exists('pantry_item_ids', $validated)
            ? $validated['pantry_item_ids']
            : $this->consumption->defaultSelection($user, $recipe);

        if ($ids === []) {
            return response()->json([
                'message' => 'Nice one. Nothing to take out of your fridge.',
                'removed' => [],
                'rescued' => [],
                'meta' => $this->meta($request),
            ]);
        }

        $result = $this->consumption->consume($user, $ids, $recipe);
        $count = count($result['removed']);

        return response()->json([
            'message' => $this->message($count, $this->consumption->rescueMessage($result['rescued'])),
            'removed' => $result['removed'],
            'rescued' => $result['rescued'],
            'meta' => $this->meta($request),
        ]);
    }

    private function message(int $count, ?string $rescue): string
    {
        if ($count === 0) {
            return 'Nice one. Nothing to take out of your fridge.';
        }

        $headline = $count === 1
            ? '1 ingredient taken out of your fridge.'
            : "{$count} ingredients taken out of your fridge.";

        return $rescue ? "{$headline} {$rescue}" : $headline;
    }

    /** @return array<string, mixed> */
    private function meta(Request $request): array
    {
        $soon = $this->useItUp->expiringSoon($request->user());

        return [
            'expiring_soon_count' => $soon->count(),
            'soonest_days_left' => $soon->first()['days_left'] ?? null,
        ];
    }
}
