<?php

namespace App\Http\Controllers;

use App\Http\Services\FreshnessService;
use App\Http\Services\DetectionMapper;
use App\Http\Services\RecipeComposer;
use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\Recipe;
use App\Http\Services\VisionClient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

/**
 * Fridge Scan — photo in, candidate ingredients out.
 *
 * This endpoint deliberately does not touch the cook's fridge. It answers
 * "here is what the camera thinks it saw, with boxes and confidences"; the
 * cook confirms the chips in the UI and a separate call writes them. A 70%
 * accurate model behind a confirm step is a 100% reliable demo, and it is
 * also just the honest interaction — nobody wants a computer silently
 * deciding what is in their kitchen.
 */
class FridgeScanController extends Controller
{
    public function __construct(
        private DetectionMapper $mapper,
        private FreshnessService $freshness = new FreshnessService(),
        private RecipeComposer $composer = new RecipeComposer(),
    ) {
    }

    /** GET /api/fridge/scan/status — is the detector up? Used to pick the UI copy. */
    public function status()
    {
        return response()->json(VisionClient::fromConfig()->health());
    }

    /**
     * Commit the chips the cook confirmed.
     *
     * Additive: a photo of the top shelf must not delete the rice in the
     * cupboard. New items are dated from their typical shelf life, because
     * this is the endpoint that adds a dozen things in one tap and nobody is
     * going to date twelve chips by hand.
     */
    public function confirm(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.name' => 'required|string|max:120',
            'items.*.confidence' => 'nullable|numeric|min:0|max:1',
            'items.*.detected_as' => 'nullable|string|max:120',
        ]);

        $session = $this->fridge($request);
        $today = $session->today();
        $added = 0;
        $dated = 0;

        foreach ($validated['items'] as $item) {
            $ingredient = Ingredient::resolve($item['name']);

            $record = PantryItem::firstOrNew([
                'session_id' => $session->session_id,
                'ingredient_id' => $ingredient->id,
            ]);

            $isNew = !$record->exists;
            $added += $isNew ? 1 : 0;

            $record->source = 'scan';
            $record->detected_as = $item['detected_as'] ?? null;
            $record->confidence = $item['confidence'] ?? null;

            // Only ever fills a blank — something already on the shelf keeps
            // the date it has, even if this scan sees it again.
            if ($isNew && ($days = $ingredient->shelfLifeDays()) !== null) {
                $record->expires_on = $today->copy()->addDays($days);
                $record->expiry_estimated = true;
                $dated++;
            }

            $record->save();
        }

        $total = count($validated['items']);
        $headline = $added === $total
            ? "{$added} ingredients added to your fridge."
            : "{$total} ingredients confirmed ({$added} new).";

        return response()->json([
            'message' => $dated === 0
                ? $headline
                : $headline . ' ' . ($dated === 1
                    ? 'One use-by date estimated — tap it to correct.'
                    : "{$dated} use-by dates estimated — tap any to correct."),
            'added' => $added,
            'dated' => $dated,
        ], Response::HTTP_CREATED);
    }

    /** POST /api/fridge/scan — multipart photo. */
    public function scan(Request $request)
    {
        $validated = $request->validate([
            'photo' => 'required|image|mimes:jpeg,jpg,png,webp,bmp|max:32768',
            'confidence' => 'sometimes|numeric|min:0.01|max:0.95',
        ]);

        $confidence = (float) ($validated['confidence'] ?? config('services.vision.confidence'));

        try {
            $result = VisionClient::fromConfig()->detect($request->file('photo'), $confidence);
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'vision_offline' => $exception->getCode() === 503,
            ], $exception->getCode() >= 400 ? $exception->getCode() : Response::HTTP_BAD_GATEWAY);
        }

        $mapped = $this->mapper->map($result['detections']);
        $ingredientsHealth = $this->freshness->healthFromItems($mapped['items']);
        $suggestedRecipes = $this->composer->composeForIngredients($mapped['items'], 4);

        return response()->json([
            'data' => $mapped['items'],
            'unmatched' => $mapped['unmatched'],
            'image' => $result['image'],
            'ingredients_health' => $ingredientsHealth,
            'suggested_recipes' => $suggestedRecipes->map(fn (Recipe $r) => [
                'id' => $r->id,
                'title' => $r->title,
                'description' => $r->description,
                'cuisine_country' => $r->cuisine_country ?? 'Bangladesh',
                'difficulty' => $r->difficulty,
                'total_minutes' => (int) $r->prep_minutes + (int) $r->cook_minutes,
                'image_path' => $r->image_path,
                'ingredients' => $r->ingredients,
                'generated' => true,
            ])->values()->all(),
            'meta' => array_merge($result['meta'], [
                'detection_count' => count($result['detections']),
                'ingredient_count' => count($mapped['items']),
                'recipe_count' => $suggestedRecipes->count(),
            ]),
        ]);
    }
}
