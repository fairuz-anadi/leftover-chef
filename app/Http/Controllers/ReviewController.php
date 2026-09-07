<?php

namespace App\Http\Controllers;

use App\Models\Recipe;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReviewController extends Controller
{
    public function store(Request $request, Recipe $recipe)
    {
        $user = $request->user();

        if ($recipe->user_id === $user->id) {
            return response()->json([
                'message' => 'You cannot rate or review your own recipe.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:2000',
        ]);

        $existing = Review::where('recipe_id', $recipe->id)
            ->where('user_id', $user->id)
            ->first();

        $previousRating = $existing?->rating ?? 0;

        $review = Review::updateOrCreate(
            ['recipe_id' => $recipe->id, 'user_id' => $user->id],
            $validated
        );

        $owner = $recipe->user;
        $owner->increment('points', max(0, $validated['rating'] - $previousRating));
        $recipe->refresh();
        $this->recalculateRecipeRating($recipe);

        return response()->json([
            'message' => $existing ? 'Review updated successfully.' : 'Review added successfully.',
            'data' => $review->load('user:id,name,username'),
        ], $existing ? 200 : 201);
    }

    public function destroy(Request $request, Recipe $recipe, Review $review)
    {
        if ($review->user_id !== $request->user()->id) {
            return response()->json([
                'message' => 'You can only delete your own review.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($review->recipe_id !== $recipe->id) {
            return response()->json([
                'message' => 'Review does not belong to this recipe.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $recipe->user->decrement('points', $review->rating);
        $review->delete();
        $this->recalculateRecipeRating($recipe);

        return response()->json([
            'message' => 'Review deleted successfully.',
        ]);
    }

    private function recalculateRecipeRating(Recipe $recipe): void
    {
        $recipe->update([
            'average_rating' => round((float) ($recipe->reviews()->avg('rating') ?? 0), 2),
        ]);
    }
}
