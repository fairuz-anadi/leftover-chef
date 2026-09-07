<?php

namespace App\Http\Controllers;

use App\Models\MealPlanEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * Weekly Meal Planner.
 */
class MealPlanController extends Controller
{
    public function index(Request $request)
    {
        $start = $this->weekStart($request->query('week_start'));
        $end = $start->copy()->addDays(6);

        $entries = $request->user()
            ->mealPlanEntries()
            ->with(['recipe:id,title,image_path,cuisine_country,cuisine_code,servings,prep_minutes,cook_minutes,nutrition,average_rating'])
            ->whereBetween('plan_date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('plan_date')
            ->get();

        return response()->json([
            'data' => $entries,
            'meta' => [
                'week_start' => $start->toDateString(),
                'week_end' => $end->toDateString(),
                'slots' => MealPlanEntry::SLOTS,
                'days' => collect(range(0, 6))
                    ->map(fn (int $offset) => $start->copy()->addDays($offset)->toDateString()),
                'nutrition_by_day' => $this->nutritionByDay($entries, $start),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'recipe_id' => 'required|exists:recipes,id',
            'plan_date' => 'required|date',
            'meal_slot' => 'required|in:' . implode(',', MealPlanEntry::SLOTS),
            'servings' => 'sometimes|integer|min:1|max:20',
        ]);

        $entry = MealPlanEntry::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'plan_date' => Carbon::parse($validated['plan_date'])->toDateString(),
                'meal_slot' => $validated['meal_slot'],
            ],
            [
                'recipe_id' => $validated['recipe_id'],
                'servings' => $validated['servings'] ?? $request->user()->household_size ?? 2,
            ]
        );

        return response()->json([
            'message' => 'Added to your meal plan.',
            'data' => $entry->load('recipe:id,title,image_path,cuisine_country,cuisine_code,servings,nutrition'),
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, MealPlanEntry $mealPlanEntry)
    {
        if ((string) $mealPlanEntry->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own meal plan.'], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'plan_date' => 'sometimes|date',
            'meal_slot' => 'sometimes|in:' . implode(',', MealPlanEntry::SLOTS),
            'servings' => 'sometimes|integer|min:1|max:20',
        ]);

        if (isset($validated['plan_date'])) {
            $validated['plan_date'] = Carbon::parse($validated['plan_date'])->toDateString();
        }

        $mealPlanEntry->fill($validated)->save();

        return response()->json([
            'message' => 'Meal plan updated.',
            'data' => $mealPlanEntry->load('recipe:id,title,image_path,cuisine_country,cuisine_code,servings,nutrition'),
        ]);
    }

    public function destroy(Request $request, MealPlanEntry $mealPlanEntry)
    {
        if ((string) $mealPlanEntry->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own meal plan.'], Response::HTTP_FORBIDDEN);
        }

        $mealPlanEntry->delete();

        return response()->json(['message' => 'Removed from your meal plan.']);
    }

    /** Monday of the week containing the given date (today when omitted). */
    private function weekStart($value): Carbon
    {
        $date = $value ? Carbon::parse($value) : Carbon::today();

        return $date->startOfWeek(Carbon::MONDAY);
    }

    private function nutritionByDay($entries, Carbon $start): array
    {
        $totals = [];

        foreach (range(0, 6) as $offset) {
            $totals[$start->copy()->addDays($offset)->toDateString()] = [
                'calories' => 0, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 0.0,
            ];
        }

        foreach ($entries as $entry) {
            $day = $entry->plan_date->toDateString();
            $nutrition = $entry->recipe?->nutrition ?? [];
            $servings = max(1, (int) $entry->servings);

            if (!isset($totals[$day]) || $nutrition === []) {
                continue;
            }

            $totals[$day]['calories'] += (float) ($nutrition['calories'] ?? 0) * $servings;
            $totals[$day]['protein_g'] += (float) ($nutrition['protein_g'] ?? 0) * $servings;
            $totals[$day]['carbs_g'] += (float) ($nutrition['carbs_g'] ?? 0) * $servings;
            $totals[$day]['fat_g'] += (float) ($nutrition['fat_g'] ?? 0) * $servings;
        }

        return collect($totals)->map(fn (array $day) => [
            'calories' => round($day['calories']),
            'protein_g' => round($day['protein_g'], 1),
            'carbs_g' => round($day['carbs_g'], 1),
            'fat_g' => round($day['fat_g'], 1),
        ])->all();
    }
}
