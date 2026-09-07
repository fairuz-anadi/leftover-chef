<?php

namespace App\Http\Controllers;

use App\Http\Services\PantryMatchService;
use App\Http\Services\RecipeIngredientSync;
use App\Models\Category;
use App\Models\Recipe;
use App\Models\User;
use App\Support\CuisineCatalog;
use App\Support\DishArtwork;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class RecipeController extends Controller
{
    private const UPLOAD_REWARD = 10;

    public function __construct(
        private RecipeIngredientSync $sync,
        private PantryMatchService $matcher,
    ) {
    }

    public function index(Request $request)
    {
        $query = Recipe::with(['user:id,name,username', 'categories:id,name', 'reviews.user:id,name,username'])
            ->withCount('reviews')
            ->latest();

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->string('search') . '%');
        }

        if ($request->filled('cuisine')) {
            $code = CuisineCatalog::resolveCode((string) $request->string('cuisine'));
            $query->where('cuisine_code', $code ?? '__none__');
        }

        if ($request->filled('region')) {
            $query->where('cuisine_region', (string) $request->string('region'));
        }

        if ($request->filled('difficulty')) {
            $query->where('difficulty', (string) $request->string('difficulty'));
        }

        if ($request->filled('skill')) {
            $query->whereIn('difficulty', $this->matcher->skillLadder((string) $request->string('skill')));
        }

        if ($request->filled('max_minutes')) {
            $query->whereRaw(
                '(COALESCE(prep_minutes, 0) + COALESCE(cook_minutes, 0)) <= ?',
                [(int) $request->integer('max_minutes')]
            );
        }

        if ($request->filled('diets')) {
            $diets = collect(explode(',', (string) $request->string('diets')))
                ->map(fn ($value) => strtolower(trim($value)))
                ->filter();

            foreach ($diets as $diet) {
                // diet_tags is a JSON array column; LIKE keeps this portable
                // across sqlite, postgres and sql server.
                $query->whereRaw('LOWER(CAST(diet_tags AS ' . $this->textCast() . ')) LIKE ?', ['%"' . $diet . '"%']);
            }
        }

        if ($request->filled('ingredients')) {
            $names = collect(explode(',', (string) $request->string('ingredients')))
                ->map(fn ($value) => trim($value))
                ->filter();

            $ids = $this->matcher->resolveIngredientIds($names->all());

            if ($ids->isEmpty()) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas(
                    'ingredientRecords',
                    fn ($builder) => $builder->whereIn('ingredients.id', $ids),
                    '>=',
                    $ids->count()
                );
            }
        }

        if ($request->filled('categories')) {
            $categories = collect(explode(',', (string) $request->string('categories')))
                ->map(fn ($value) => trim($value))
                ->filter();

            if ($categories->isNotEmpty()) {
                $query->whereHas('categories', function ($builder) use ($categories) {
                    $builder->whereIn('name', $categories);
                });
            }
        }

        $recipes = $query->paginate(5)->withQueryString();
        $favoriteIds = $this->favoriteIdsForUser($request);

        $recipes->getCollection()->each(function (Recipe $recipe) use ($favoriteIds) {
            $recipe->setAttribute('favorited_by_auth_user', $favoriteIds->contains($recipe->id));
        });

        return response()->json([
            'data' => $recipes->items(),
            'meta' => [
                'current_page' => $recipes->currentPage(),
                'last_page' => $recipes->lastPage(),
                'per_page' => $recipes->perPage(),
                'total' => $recipes->total(),
                'from' => $recipes->firstItem(),
                'to' => $recipes->lastItem(),
            ],
        ]);
    }

    /** JSON columns are cast to text before a LIKE; sql server spells it differently. */
    private function textCast(): string
    {
        return \Illuminate\Support\Facades\DB::getDriverName() === 'sqlsrv' ? 'NVARCHAR(MAX)' : 'TEXT';
    }

    public function show(Request $request, Recipe $recipe)
    {
        $recipe->load([
            'user:id,name,username',
            'categories:id,name',
            'reviews.user:id,name,username',
            'ingredientRecords:id,name,slug,aisle',
        ]);
        $recipe->setAttribute(
            'favorited_by_auth_user',
            $this->favoriteIdsForUser($request)->contains($recipe->id)
        );

        return response()->json([
            'data' => $recipe,
        ]);
    }

    public function image(string $path)
    {
        abort_unless(Storage::disk('public')->exists($path), Response::HTTP_NOT_FOUND);

        return Storage::disk('public')->response($path, null, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string|max:2000',
            'ingredients' => 'required|array|min:1',
            'ingredients.*' => 'required|string|max:255',
            'instructions' => 'required|array|min:1',
            'instructions.*' => 'required|string|max:2000',
            'categories' => 'required|array|min:1',
            'categories.*' => 'required|string|max:100',
            // Raster formats only. Generated dish artwork is SVG and is served
            // inline, so accepting uploaded SVG would hand users a script
            // injection route through the image endpoint.
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp,gif|max:5120',
        ] + $this->detailRules());

        $recipe = $user->recipes()->create([
            'title' => $validated['title'],
            'description' => $validated['description'],
            'ingredients' => array_values($validated['ingredients']),
            'instructions' => array_values($validated['instructions']),
            'image_path' => $request->hasFile('image')
                ? $request->file('image')->store('recipes', 'public')
                : null,
        ] + $this->detailAttributes($validated));

        $categoryIds = $this->resolveCategoryIds($validated['categories']);
        $recipe->categories()->sync($categoryIds);
        $this->sync->sync($recipe);

        // No photo uploaded? Give the recipe a generated dish illustration
        // rather than leaving an empty card in the library.
        if (!$recipe->image_path) {
            DishArtwork::attach($recipe->load('categories'));
        }

        $user->increment('points', self::UPLOAD_REWARD);

        return response()->json([
            'message' => 'Recipe created successfully.',
            'data' => $recipe->load(['user:id,name,username', 'categories:id,name', 'ingredientRecords:id,name,slug,aisle']),
        ], Response::HTTP_CREATED);
    }

    /**
     * Cuisine, timing, difficulty, diet and nutrition inputs shared by
     * store() and update().
     */
    private function detailRules(): array
    {
        return [
            'cuisine_country' => 'sometimes|nullable|string|max:80',
            'cuisine_code' => 'sometimes|nullable|string|max:2',
            'difficulty' => 'sometimes|in:beginner,intermediate,advanced',
            'prep_minutes' => 'sometimes|nullable|integer|min:0|max:1440',
            'cook_minutes' => 'sometimes|nullable|integer|min:0|max:1440',
            'servings' => 'sometimes|integer|min:1|max:50',
            'diet_tags' => 'sometimes|nullable|array',
            'diet_tags.*' => 'string|max:40',
            'step_timers' => 'sometimes|nullable|array',
            'step_timers.*' => 'nullable|integer|min:0|max:86400',
        ];
    }

    private function detailAttributes(array $validated): array
    {
        return collect($validated)
            ->only(array_keys($this->detailRules()))
            ->all();
    }

    public function update(Request $request, Recipe $recipe)
    {
        $user = $request->user();

        if (!$recipe || (string) $recipe->user_id !== (string) $user->id) {
            return response()->json([
                'message' => 'You can only update your own recipe.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string|max:2000',
            'ingredients' => 'sometimes|array|min:1',
            'ingredients.*' => 'required|string|max:255',
            'instructions' => 'sometimes|array|min:1',
            'instructions.*' => 'required|string|max:2000',
            'categories' => 'sometimes|array|min:1',
            'categories.*' => 'required|string|max:100',
            // Raster formats only. Generated dish artwork is SVG and is served
            // inline, so accepting uploaded SVG would hand users a script
            // injection route through the image endpoint.
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp,gif|max:5120',
            'remove_image' => 'sometimes|boolean',
        ] + $this->detailRules());

        if (array_key_exists('ingredients', $validated)) {
            $validated['ingredients'] = array_values($validated['ingredients']);
        }

        if (array_key_exists('instructions', $validated)) {
            $validated['instructions'] = array_values($validated['instructions']);
        }

        if ($request->hasFile('image')) {
            if ($recipe->image_path) {
                Storage::disk('public')->delete($recipe->image_path);
            }

            $validated['image_path'] = $request->file('image')->store('recipes', 'public');
        } elseif (($validated['remove_image'] ?? false) && $recipe->image_path) {
            Storage::disk('public')->delete($recipe->image_path);
            $validated['image_path'] = null;
        }

        $recipe->fill(collect($validated)->except(['categories', 'image', 'remove_image'])->all());
        $recipe->save();

        if (array_key_exists('categories', $validated)) {
            $recipe->categories()->sync($this->resolveCategoryIds($validated['categories']));
        }

        $this->sync->sync($recipe);

        if (!$recipe->image_path) {
            DishArtwork::attach($recipe->load('categories'));
        }

        return response()->json([
            'message' => 'Recipe updated successfully.',
            'data' => $recipe->load([
                'user:id,name,username',
                'categories:id,name',
                'reviews.user:id,name,username',
                'ingredientRecords:id,name,slug,aisle',
            ]),
        ]);
    }

    public function destroy(Request $request, Recipe $recipe)
    {
        $user = $request->user();

        if (!$recipe || (string) $recipe->user_id !== (string) $user->id) {
            return response()->json([
                'message' => 'You can only delete your own recipe.',
            ], Response::HTTP_FORBIDDEN);
        }

        $owner = User::find($recipe->user_id);
        if ($owner) {
            $owner->decrement('points', min($owner->points, self::UPLOAD_REWARD));
        }

        if ($recipe->image_path) {
            Storage::disk('public')->delete($recipe->image_path);
        }

        $recipe->reviews()->delete();
        $recipe->categories()->detach();
        $recipe->favoritedByUsers()->detach();
        $recipe->delete();

        return response()->json([
            'message' => 'Recipe deleted successfully.',
        ]);
    }

    private function resolveCategoryIds(array $categories)
    {
        return collect($categories)
            ->map(fn ($name) => trim($name))
            ->filter()
            ->unique()
            ->map(fn ($name) => Category::firstOrCreate(['name' => $name])->id)
            ->values();
    }

    private function favoriteIdsForUser(Request $request)
    {
        $user = $request->user('sanctum') ?? $request->user();

        if (!$user) {
            return collect();
        }

        return $user->favorites()->pluck('recipes.id');
    }
}
