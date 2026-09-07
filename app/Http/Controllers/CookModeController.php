<?php

namespace App\Http\Controllers;

use App\Http\Services\GuidedCookService;
use App\Models\Recipe;
use Illuminate\Http\Request;

class CookModeController extends Controller
{
    public function __construct(private GuidedCookService $guide)
    {
    }

    public function __invoke(Request $request, Recipe $recipe)
    {
        $recipe->load(['ingredientRecords:id,name,slug,aisle', 'user:id,name,username']);

        $servings = (int) $request->integer('servings', $recipe->servings ?: 2);
        $servings = max(1, min($servings, 20));
        $scale = $servings / max(1, (int) ($recipe->servings ?: 1));

        $pantryIds = $request->user('sanctum')?->pantryItems()->pluck('ingredient_id') ?? collect();

        return response()->json([
            'data' => [
                'recipe' => $recipe,
                'servings' => $servings,
                'scale' => round($scale, 3),
                'steps' => $this->guide->steps($recipe),
                'ingredients' => $recipe->ingredientRecords->map(fn ($ingredient) => [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'raw_text' => $ingredient->pivot->raw_text,
                    'quantity' => $ingredient->pivot->quantity === null
                        ? null
                        : round((float) $ingredient->pivot->quantity * $scale, 2),
                    'unit' => $ingredient->pivot->unit,
                    'is_optional' => (bool) $ingredient->pivot->is_optional,
                    'in_pantry' => $pantryIds->contains($ingredient->id),
                ])->values(),
                'nutrition' => $recipe->nutrition,
            ],
        ]);
    }
}
