<?php

namespace App\Http\Controllers;

use App\Models\Ingredient;
use Illuminate\Http\Request;

class IngredientController extends Controller
{
    /**
     * Autocomplete source for the pantry and shopping-list inputs.
     */
    public function index(Request $request)
    {
        $query = Ingredient::query()->orderBy('name');

        if ($request->filled('search')) {
            $term = trim((string) $request->string('search'));
            $query->where('name', 'like', '%' . $term . '%');
        }

        if ($request->boolean('staples')) {
            $query->where('is_staple', true);
        }

        return response()->json([
            'data' => $query->limit((int) $request->integer('limit', 40) ?: 40)
                ->get(['id', 'name', 'name_bn', 'slug', 'aisle', 'is_staple']),
        ]);
    }

    /** The aisle buckets the shopping list groups by. */
    public function aisles()
    {
        return response()->json([
            'data' => Ingredient::query()
                ->select('aisle')
                ->distinct()
                ->orderBy('aisle')
                ->pluck('aisle'),
        ]);
    }
}
