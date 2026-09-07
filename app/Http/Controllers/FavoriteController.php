<?php

namespace App\Http\Controllers;

use App\Models\Recipe;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function store(Request $request, Recipe $recipe)
    {
        $request->user()->favorites()->syncWithoutDetaching([$recipe->id]);

        return response()->json([
            'message' => 'Recipe added to favourites.',
        ]);
    }

    public function destroy(Request $request, Recipe $recipe)
    {
        $request->user()->favorites()->detach($recipe->id);

        return response()->json([
            'message' => 'Recipe removed from favourites.',
        ]);
    }
}
