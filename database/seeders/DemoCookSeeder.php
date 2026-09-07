<?php

namespace Database\Seeders;

use App\Models\Ingredient;
use App\Models\MealPlanEntry;
use App\Models\PantryItem;
use App\Models\Recipe;
use App\Models\Review;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * A signed-in cook with a stocked fridge, a half-filled week and a few
 * reviews, so every screen has something to show on a fresh install - and,
 * more to the point, so the demo opens on a populated state instead of an
 * empty one with a judge watching.
 */
class DemoCookSeeder extends Seeder
{
    /**
     * The demo fridge: [ingredient, days until it expires].
     *
     * The dates are relative rather than fixed so the "expiring soon" shelf is
     * populated on whatever day the laptop is opened - a hardcoded 2026 date
     * would read as "expired 400 days ago" by the time a judge sees it.
     *
     * null means a cupboard staple with no meaningful use-by date. The three
     * negative-to-two-day items are the ones the Use It Up ranking exists to
     * surface, and they are all things a real fridge actually loses.
     */
    private const FRIDGE = [
        ['Spinach', 1],
        ['Chicken Breast', 2],
        ['Milk', 2],
        ['Yoghurt', 3],
        ['Tomato', 4],
        ['Bell Pepper', 5],
        ['Green Chilli', 6],
        ['Coriander', 6],
        ['Egg', 9],
        ['Lemon', 12],
        ['Ginger', 14],
        ['Garlic', 21],
        ['Onion', 24],
        ['Chopped Tomatoes', null],
        ['Pasta', null],
        ['Rice', null],
        ['Lentils', null],
        ['Olive Oil', null],
        ['Vegetable Oil', null],
        ['Salt', null],
        ['Black Pepper', null],
        ['Cumin', null],
        ['Turmeric', null],
        ['Chilli Powder', null],
        ['Parsley', null],
    ];

    public function run(): void
    {
        $demo = User::firstOrCreate(
            ['email' => 'demo@leftoverchef.test'],
            [
                'name' => 'Demo Cook',
                'username' => 'demo',
                'password' => Hash::make('DemoPass123!'),
                'email_verified_at' => now(),
                'skill_level' => 'beginner',
                'household_size' => 2,
                'dietary_preferences' => [],
                'allergies' => [],
                'points' => 20,
            ]
        );

        foreach (self::FRIDGE as [$name, $daysLeft]) {
            $ingredient = Ingredient::lookup($name);

            if (!$ingredient) {
                continue;
            }

            PantryItem::updateOrCreate(
                ['user_id' => $demo->id, 'ingredient_id' => $ingredient->id],
                [
                    'expires_on' => $daysLeft === null ? null : Carbon::today()->addDays($daysLeft),
                    'source' => 'seed',
                ]
            );
        }

        $this->seedMealPlan($demo);
        $this->seedFavouritesAndReviews($demo);
    }

    private function seedMealPlan(User $demo): void
    {
        $monday = Carbon::today()->startOfWeek(Carbon::MONDAY);

        $plan = [
            [0, 'breakfast', 'Shakshuka'],
            [0, 'dinner', 'Spaghetti Aglio e Olio'],
            [1, 'lunch', 'Red Lentil Dal'],
            [1, 'dinner', 'Bengali Chicken Curry'],
            [2, 'dinner', 'Black Bean Tacos'],
            [3, 'dinner', 'Thai Green Curry'],
            [4, 'dinner', 'Chicken Katsu Curry'],
        ];

        foreach ($plan as [$offset, $slot, $title]) {
            $recipe = Recipe::where('title', $title)->first();

            if (!$recipe) {
                continue;
            }

            MealPlanEntry::updateOrCreate(
                [
                    'user_id' => $demo->id,
                    'plan_date' => $monday->copy()->addDays($offset)->toDateString(),
                    'meal_slot' => $slot,
                ],
                [
                    'recipe_id' => $recipe->id,
                    'servings' => 2,
                ]
            );
        }
    }

    private function seedFavouritesAndReviews(User $demo): void
    {
        $favourites = Recipe::whereIn('title', [
            'Spaghetti Aglio e Olio',
            'Red Lentil Dal',
            'Miso Salmon with Greens',
        ])->pluck('id');

        $demo->favorites()->syncWithoutDetaching($favourites);

        $reviews = [
            ['Spaghetti Aglio e Olio', 5, 'Made this on a Tuesday with nothing in the house. Genuinely brilliant.'],
            ['Red Lentil Dal', 5, 'The tempering step makes all the difference — do not skip it.'],
            ['Chicken Katsu Curry', 4, 'Sauce was great. I needed a couple more minutes on the chicken.'],
        ];

        foreach ($reviews as [$title, $rating, $comment]) {
            $recipe = Recipe::where('title', $title)->first();

            if (!$recipe) {
                continue;
            }

            Review::updateOrCreate(
                ['recipe_id' => $recipe->id, 'user_id' => $demo->id],
                ['rating' => $rating, 'comment' => $comment]
            );

            $recipe->update([
                'average_rating' => round((float) $recipe->reviews()->avg('rating'), 2),
            ]);
        }
    }
}
