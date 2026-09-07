<?php

namespace App\Http\Controllers;

use App\Models\Recipe;
use App\Support\CuisineCatalog;
use Illuminate\Http\Request;

/**
 * Cuisine Map Explorer — the country-by-country browse experience.
 */
class CuisineController extends Controller
{
    /** Every country on the map, with how many recipes sit behind it. */
    public function index()
    {
        $counts = Recipe::query()
            ->whereNotNull('cuisine_code')
            ->selectRaw('cuisine_code, COUNT(*) as total')
            ->groupBy('cuisine_code')
            ->pluck('total', 'cuisine_code');

        $countries = collect(CuisineCatalog::all())
            ->map(fn (array $country) => array_merge($country, [
                'recipe_count' => (int) ($counts[$country['code']] ?? 0),
            ]));

        return response()->json([
            'data' => $countries->values(),
            'meta' => [
                'regions' => $countries->pluck('region')->unique()->sort()->values(),
                'total_recipes' => (int) $counts->sum(),
                'countries_with_recipes' => $countries->where('recipe_count', '>', 0)->count(),
            ],
        ]);
    }

    /** The recipes pinned to one country. */
    public function show(Request $request, string $code)
    {
        $resolved = CuisineCatalog::resolveCode($code);

        if (!$resolved) {
            return response()->json([
                'message' => 'We do not have that country on the map yet.',
            ], 404);
        }

        $user = $request->user('sanctum');
        $favoriteIds = $user ? $user->favorites()->pluck('recipes.id') : collect();

        $recipes = Recipe::with(['user:id,name,username', 'categories:id,name'])
            ->withCount('reviews')
            ->where('cuisine_code', $resolved)
            ->orderByDesc('average_rating')
            ->orderByDesc('created_at')
            ->get()
            ->each(fn (Recipe $recipe) => $recipe->setAttribute(
                'favorited_by_auth_user',
                $favoriteIds->contains($recipe->id)
            ));

        return response()->json([
            'data' => $recipes,
            'meta' => array_merge(
                CuisineCatalog::find($resolved) ?? [],
                ['code' => $resolved, 'recipe_count' => $recipes->count()]
            ),
        ]);
    }
}
