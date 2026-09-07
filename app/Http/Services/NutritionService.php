<?php

namespace App\Http\Services;

use App\Models\Ingredient;
use App\Models\Recipe;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Nutrition Insights — calories and macros per serving.
 *
 * The default provider is `local`: it multiplies each parsed ingredient's
 * gram weight against the per-100g figures stored on the ingredients table.
 * Setting NUTRITION_PROVIDER to `spoonacular` or `edamam` (with the matching
 * key in .env) swaps in a third-party lookup, falling back to the local
 * estimate whenever the call fails.
 */
class NutritionService
{
    public function __construct(private IngredientParser $parser)
    {
    }

    /**
     * @return array{calories: float, protein_g: float, carbs_g: float, fat_g: float, per: string, coverage: float}
     */
    public function estimateForRecipe(Recipe $recipe): array
    {
        $provider = config('services.nutrition.provider', 'local');

        if ($provider === 'spoonacular') {
            $remote = $this->fromSpoonacular($recipe);
            if ($remote) {
                return $remote;
            }
        }

        if ($provider === 'edamam') {
            $remote = $this->fromEdamam($recipe);
            if ($remote) {
                return $remote;
            }
        }

        return $this->fromLocalTable($recipe);
    }

    /**
     * Per-serving totals built from our own ingredient nutrition table.
     */
    public function fromLocalTable(Recipe $recipe): array
    {
        $lines = collect($recipe->ingredients ?? []);
        $servings = max(1, (int) ($recipe->servings ?: 1));

        $totals = ['calories' => 0.0, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 0.0];
        $known = 0;

        foreach ($lines as $line) {
            $parsed = $this->parser->parse((string) $line);
            $ingredient = Ingredient::lookup($parsed['name']);

            if (!$ingredient || $ingredient->calories_per_100g === null) {
                continue;
            }

            $grams = $this->parser->toGrams($parsed['quantity'], $parsed['unit']);
            if ($grams === null) {
                // No usable quantity — assume a modest 50 g so the ingredient
                // still contributes something rather than silently vanishing.
                $grams = 50.0;
            }

            $factor = $grams / 100;
            $totals['calories'] += (float) $ingredient->calories_per_100g * $factor;
            $totals['protein_g'] += (float) $ingredient->protein_per_100g * $factor;
            $totals['carbs_g'] += (float) $ingredient->carbs_per_100g * $factor;
            $totals['fat_g'] += (float) $ingredient->fat_per_100g * $factor;
            $known++;
        }

        $coverage = $lines->isEmpty() ? 0.0 : round($known / $lines->count(), 2);

        return [
            'calories' => round($totals['calories'] / $servings),
            'protein_g' => round($totals['protein_g'] / $servings, 1),
            'carbs_g' => round($totals['carbs_g'] / $servings, 1),
            'fat_g' => round($totals['fat_g'] / $servings, 1),
            'per' => 'serving',
            'coverage' => $coverage,
        ];
    }

    private function fromSpoonacular(Recipe $recipe): ?array
    {
        $key = config('services.nutrition.spoonacular_key');
        if (!$key) {
            return null;
        }

        try {
            $response = Http::timeout(8)->asForm()->post(
                'https://api.spoonacular.com/recipes/parseIngredients',
                [
                    'apiKey' => $key,
                    'ingredientList' => implode("\n", $recipe->ingredients ?? []),
                    'servings' => max(1, (int) $recipe->servings),
                    'includeNutrition' => 'true',
                ]
            );

            if (!$response->successful()) {
                return null;
            }

            $totals = ['calories' => 0.0, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 0.0];
            $map = ['Calories' => 'calories', 'Protein' => 'protein_g', 'Carbohydrates' => 'carbs_g', 'Fat' => 'fat_g'];

            foreach ($response->json() ?? [] as $item) {
                foreach ($item['nutrition']['nutrients'] ?? [] as $nutrient) {
                    $slot = $map[$nutrient['name'] ?? ''] ?? null;
                    if ($slot) {
                        $totals[$slot] += (float) ($nutrient['amount'] ?? 0);
                    }
                }
            }

            $servings = max(1, (int) $recipe->servings);

            return [
                'calories' => round($totals['calories'] / $servings),
                'protein_g' => round($totals['protein_g'] / $servings, 1),
                'carbs_g' => round($totals['carbs_g'] / $servings, 1),
                'fat_g' => round($totals['fat_g'] / $servings, 1),
                'per' => 'serving',
                'coverage' => 1.0,
            ];
        } catch (\Throwable $e) {
            Log::warning('Spoonacular nutrition lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function fromEdamam(Recipe $recipe): ?array
    {
        $appId = config('services.nutrition.edamam_app_id');
        $appKey = config('services.nutrition.edamam_app_key');

        if (!$appId || !$appKey) {
            return null;
        }

        try {
            $response = Http::timeout(8)->post(
                "https://api.edamam.com/api/nutrition-details?app_id={$appId}&app_key={$appKey}",
                [
                    'title' => $recipe->title,
                    'yield' => max(1, (int) $recipe->servings),
                    'ingr' => array_values($recipe->ingredients ?? []),
                ]
            );

            if (!$response->successful()) {
                return null;
            }

            $body = $response->json();
            $servings = max(1, (int) $recipe->servings);
            $nutrients = $body['totalNutrients'] ?? [];

            return [
                'calories' => round((float) ($body['calories'] ?? 0) / $servings),
                'protein_g' => round((float) ($nutrients['PROCNT']['quantity'] ?? 0) / $servings, 1),
                'carbs_g' => round((float) ($nutrients['CHOCDF']['quantity'] ?? 0) / $servings, 1),
                'fat_g' => round((float) ($nutrients['FAT']['quantity'] ?? 0) / $servings, 1),
                'per' => 'serving',
                'coverage' => 1.0,
            ];
        } catch (\Throwable $e) {
            Log::warning('Edamam nutrition lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }
}
