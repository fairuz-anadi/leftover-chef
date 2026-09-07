<?php

namespace App\Http\Services;

use App\Models\Ingredient;
use App\Models\Recipe;
use App\Support\CuisineCatalog;

/**
 * Keeps the structured side of a recipe in step with the free-text one.
 *
 * `recipes.ingredients` stays the authoring format (a plain list of lines);
 * this service projects it onto the `ingredient_recipe` pivot that powers
 * pantry matching, the shopping list and nutrition, and normalises the
 * cuisine fields at the same time.
 */
class RecipeIngredientSync
{
    /**
     * Things every kitchen has on tap. They stay in the written ingredient
     * list but are kept off the pivot, so they never count as "missing" or
     * land on a shopping list.
     */
    private const ALWAYS_AVAILABLE = ['water', 'ice', 'cold-water', 'warm-water', 'boiling-water'];

    public function __construct(
        private IngredientParser $parser,
        private NutritionService $nutrition,
    ) {
    }

    public function sync(Recipe $recipe): Recipe
    {
        $this->syncCuisine($recipe);
        $this->syncPivot($recipe);
        $this->syncNutrition($recipe);

        $recipe->save();

        return $recipe;
    }

    private function syncCuisine(Recipe $recipe): void
    {
        $code = CuisineCatalog::resolveCode($recipe->cuisine_code)
            ?? CuisineCatalog::resolveCode($recipe->cuisine_country);

        if (!$code) {
            return;
        }

        $recipe->cuisine_code = $code;
        $recipe->cuisine_country = CuisineCatalog::nameFor($code);
        $recipe->cuisine_region = CuisineCatalog::regionFor($code);
    }

    private function syncPivot(Recipe $recipe): void
    {
        $attach = [];
        $position = 0;

        foreach ($recipe->ingredients ?? [] as $line) {
            $parsed = $this->parser->parse((string) $line);

            if ($parsed['name'] === '') {
                continue;
            }

            $ingredient = Ingredient::resolve($parsed['name']);

            if (in_array($ingredient->slug, self::ALWAYS_AVAILABLE, true)) {
                continue;
            }

            // A recipe can list the same ingredient twice ("1 tbsp oil" for the
            // pan, "2 tbsp oil" for the sauce). The pivot is unique per pair,
            // so fold the quantities together instead of losing one.
            if (isset($attach[$ingredient->id])) {
                $existing = $attach[$ingredient->id];
                if ($existing['unit'] === $parsed['unit'] && $existing['quantity'] !== null && $parsed['quantity'] !== null) {
                    $attach[$ingredient->id]['quantity'] = $existing['quantity'] + $parsed['quantity'];
                }
                $attach[$ingredient->id]['raw_text'] = $existing['raw_text'] . '; ' . $parsed['raw_text'];
                continue;
            }

            $attach[$ingredient->id] = [
                'quantity' => $parsed['quantity'],
                'unit' => $parsed['unit'],
                'raw_text' => $parsed['raw_text'],
                'is_optional' => $parsed['is_optional'],
                'position' => $position++,
            ];
        }

        $recipe->ingredientRecords()->sync($attach);
    }

    private function syncNutrition(Recipe $recipe): void
    {
        // A recipe that shipped its own nutrition figures keeps them.
        if ($recipe->nutrition_source === 'manual') {
            return;
        }

        $recipe->nutrition = $this->nutrition->estimateForRecipe($recipe);
        $recipe->nutrition_source = config('services.nutrition.provider', 'local');
    }
}
