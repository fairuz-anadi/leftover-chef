<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * Dietary / skill-level profile setup.
 */
class ProfileController extends Controller
{
    public const DIETS = [
        'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher',
        'gluten-free', 'dairy-free', 'nut-free', 'low-carb', 'high-protein',
    ];

    public function show(Request $request)
    {
        return response()->json([
            'data' => $request->user(),
            'meta' => [
                'diet_options' => self::DIETS,
                'skill_levels' => ['beginner', 'intermediate', 'advanced'],
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'skill_level' => 'sometimes|in:beginner,intermediate,advanced',
            'household_size' => 'sometimes|integer|min:1|max:20',
            'dietary_preferences' => 'sometimes|array',
            'dietary_preferences.*' => 'string|in:' . implode(',', self::DIETS),
            'allergies' => 'sometimes|array',
            'allergies.*' => 'string|max:60',
        ]);

        $user = $request->user();
        $user->fill($validated)->save();

        return response()->json([
            'message' => 'Preferences saved.',
            'data' => $user->fresh(),
        ]);
    }
}
