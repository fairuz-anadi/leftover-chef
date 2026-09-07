<?php

namespace App\Http\Controllers;

use App\Models\ContactSubmission;
use App\Models\Recipe;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class AdminController extends Controller
{
    private const UPLOAD_REWARD = 10;

    public function dashboard()
    {
        $totalRecipes = Recipe::count();
        $totalReviews = Review::count();
        $totalUsers = User::count();
        $totalContacts = ContactSubmission::count();
        $memberCount = User::where('is_admin', false)->count();

        $recentRecipes = Recipe::with(['user:id,name,username', 'categories:id,name'])
            ->withCount('reviews')
            ->latest()
            ->limit(8)
            ->get();

        $recentReviews = Review::with(['user:id,name,username', 'recipe:id,title,user_id'])
            ->latest()
            ->limit(8)
            ->get();

        $recentContacts = ContactSubmission::latest()->limit(8)->get();
        $userDirectory = User::withCount(['recipes', 'reviews', 'favorites'])
            ->latest()
            ->limit(12)
            ->get(['id', 'name', 'username', 'email', 'points', 'is_admin', 'created_at']);

        $topCategory = \App\Models\Category::query()
            ->whereHas('recipes')
            ->withCount('recipes')
            ->orderByDesc('recipes_count')
            ->orderBy('name')
            ->first(['id', 'name']);

        $mostReviewedRecipe = Recipe::with(['user:id,name'])
            ->withCount('reviews')
            ->orderByDesc('reviews_count')
            ->orderByDesc('average_rating')
            ->first(['id', 'title', 'user_id', 'average_rating']);

        $newestMember = User::latest()->first(['id', 'name', 'username', 'created_at', 'is_admin']);

        return response()->json([
            'stats' => [
                'users' => $totalUsers,
                'members' => $memberCount,
                'admins' => $totalUsers - $memberCount,
                'recipes' => $totalRecipes,
                'reviews' => $totalReviews,
                'contacts' => $totalContacts,
                'average_recipe_rating' => round((float) (Recipe::avg('average_rating') ?? 0), 2),
                'reviews_per_recipe' => round($totalRecipes > 0 ? $totalReviews / $totalRecipes : 0, 2),
                'recipes_this_week' => Recipe::where('created_at', '>=', now()->subDays(7))->count(),
                'users_this_week' => User::where('created_at', '>=', now()->subDays(7))->count(),
            ],
            'highlights' => [
                'top_category' => $topCategory,
                'most_reviewed_recipe' => $mostReviewedRecipe,
                'newest_member' => $newestMember,
            ],
            'recent_contacts' => $recentContacts,
            'recent_recipes' => $recentRecipes,
            'recent_reviews' => $recentReviews,
            'users' => $userDirectory,
        ]);
    }

    public function deleteRecipe(Recipe $recipe)
    {
        $owner = $recipe->user;
        $deduction = min($owner->points, self::UPLOAD_REWARD);
        $owner->decrement('points', $deduction);

        if ($recipe->image_path) {
            Storage::disk('public')->delete($recipe->image_path);
        }

        $recipe->reviews()->delete();
        $recipe->categories()->detach();
        $recipe->favoritedByUsers()->detach();
        $recipe->delete();

        return response()->json([
            'message' => 'Recipe deleted successfully by admin.',
        ]);
    }

    public function deleteUser(Request $request, User $user)
    {
        if ((string) $request->user()->id === (string) $user->id) {
            return response()->json([
                'message' => 'Admin accounts cannot delete themselves.',
            ], Response::HTTP_FORBIDDEN);
        }

        $user->reviews()->delete();
        $user->favorites()->detach();
        $user->recipes->each(function (Recipe $recipe) {
            if ($recipe->image_path) {
                Storage::disk('public')->delete($recipe->image_path);
            }
            $recipe->reviews()->delete();
            $recipe->categories()->detach();
            $recipe->favoritedByUsers()->detach();
        });
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully by admin.',
        ]);
    }

    public function deleteReview(Review $review)
    {
        $recipe = $review->recipe;
        $owner = $recipe?->user;

        if ($owner) {
            $owner->decrement('points', min($owner->points, $review->rating));
        }

        $review->delete();

        if ($recipe) {
            $recipe->update([
                'average_rating' => round((float) ($recipe->reviews()->avg('rating') ?? 0), 2),
            ]);
        }

        return response()->json([
            'message' => 'Review deleted successfully by admin.',
        ]);
    }

    public function deleteContact(ContactSubmission $contact)
    {
        $contact->delete();

        return response()->json([
            'message' => 'Contact message archived successfully.',
        ]);
    }
}
