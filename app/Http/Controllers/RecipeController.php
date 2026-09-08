<?php

namespace App\Http\Controllers;

use App\Http\Services\FreshnessService;
use App\Http\Services\GuidedCookService;
use App\Http\Services\PantryConsumptionService;
use App\Models\Recipe;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

/**
 * One recipe, in full — what the Recipe Reveal opens onto.
 *
 * There is no recipe library, no authoring and no browsing here: the app only
 * ever shows recipes it has already decided you can cook. This exists to fill
 * the reveal panel with the plated dish, the method, and what cooking it would
 * take out of your fridge.
 */
class RecipeController extends Controller
{
    public function __construct(
        private GuidedCookService $guide,
        private PantryConsumptionService $consumption,
        private FreshnessService $freshness,
    ) {
    }

    public function show(Request $request, Recipe $recipe)
    {
        $session = $this->fridge($request);
        $recipe->load('ingredientRecords:id,name,slug,aisle,is_staple');

        $owned = $session->pantryItems()->pluck('ingredient_id')->map(fn ($id) => (int) $id);
        $statuses = $this->freshness->statuses($session);

        return response()->json([
            'data' => [
                'id' => $recipe->id,
                'title' => $recipe->title,
                'description' => $recipe->description,
                'cuisine_country' => $recipe->cuisine_country,
                'cuisine_region' => $recipe->cuisine_region,
                'difficulty' => $recipe->difficulty,
                'servings' => $recipe->servings,
                'total_minutes' => (int) $recipe->prep_minutes + (int) $recipe->cook_minutes,
                'image_path' => $recipe->image_path,
                'steps' => $this->guide->steps($recipe),
                'ingredients' => $recipe->ingredientRecords->map(fn ($ingredient) => [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'raw_text' => $ingredient->pivot->raw_text,
                    'is_optional' => (bool) $ingredient->pivot->is_optional,
                    'in_fridge' => $owned->contains($ingredient->id),
                    'freshness' => $statuses->get($ingredient->id),
                ])->values(),
                // What finishing this would take off the shelf, so the reveal
                // can offer it without a second round trip.
                'consumes' => $this->consumption->plan($session, $recipe),
            ],
        ]);
    }

    /**
     * Serve a generated dish illustration.
     *
     * They live on the local disk rather than in public/ so nothing depends on
     * a storage symlink existing on the demo laptop.
     */
    public function image(string $path)
    {
        abort_unless(Storage::disk('public')->exists($path), Response::HTTP_NOT_FOUND);

        return Storage::disk('public')->response($path, null, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
}
