<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Recipe;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function user(Request $request)
    {
        $user = $request->user();
        
        // Load recipes with categories and reviews
        $user->load([
            'recipes.categories',
            'recipes.reviews.user',
            'favorites' => function($query) {
                $query->with('user', 'categories');
            },
        ]);

        return response()->json([
            'user' => $user,
            'stats' => [
                'recipes_count' => $user->recipes->count(),
                'favorites_count' => $user->favorites->count(),
                'points' => $user->points,
                'average_recipe_rating' => round((float) $user->recipes->avg('average_rating'), 2),
            ],
        ]);
    }

    public function leaderboards()
    {
        $topUsers = User::leaderboard()->limit(10)->get(['id', 'name', 'username', 'points']);

        $topRecipes = Recipe::with(['user:id,name', 'categories:id,name'])
            ->withCount('reviews')
            ->orderByDesc('average_rating')
            ->orderByDesc('reviews_count')
            ->latest()
            ->limit(10)
            ->get();

        $trendingCategories = Category::query()
            ->whereHas('recipes')
            ->withCount('recipes')
            ->orderByDesc('recipes_count')
            ->orderBy('name')
            ->limit(5)
            ->get(['id', 'name']);

        $risingChef = User::query()
            ->withCount('recipes')
            ->whereHas('recipes')
            ->orderByDesc('recipes_count')
            ->orderByDesc('points')
            ->orderBy('name')
            ->first(['id', 'name', 'username', 'points']);

        return response()->json([
            'top_users' => $topUsers,
            'top_recipes' => $topRecipes,
            'trending_categories' => $trendingCategories,
            'rising_chef' => $risingChef,
            'platform_stats' => [
                'recipes' => Recipe::count(),
                'reviews' => Review::count(),
                'categories' => Category::count(),
                'chefs' => User::where('is_admin', false)->count(),
            ],
        ]);
    }
}
