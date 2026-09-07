<?php

namespace App\Http\Services;

use App\Models\Ingredient;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Ingredient-Based Search: rank recipes by how much of them the cook can
 * already make from what is in the fridge.
 */
class PantryMatchService
{
    public function __construct(private readonly UseItUpService $useItUp = new UseItUpService())
    {
    }

    /**
     * @param  array<int, string>  $names  Free-text ingredient names.
     * @return Collection<int, int>  Ingredient ids.
     */
    public function resolveIngredientIds(array $names): Collection
    {
        // Go through lookup() rather than a straight slug query: the alias
        // table is the only thing that turns "capsicum" into Bell Pepper, and
        // the fridge scanner leans on it for every detector label it emits.
        // Matching on slug alone drops those names silently — no error, just a
        // recipe that quietly stops matching.
        return collect($names)
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->map(fn ($name) => Ingredient::lookup($name)?->id)
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * @param  Collection<int, int>|array<int, int>  $ingredientIds
     * @param  array{
     *     max_missing?: int, diets?: array<int, string>, skill?: string|null,
     *     cuisine?: string|null, region?: string|null, max_minutes?: int|null,
     *     allergies?: array<int, string>, limit?: int
     * }  $filters
     * @param  Collection<int, array<string, mixed>>|null  $urgency  Expiry map from UseItUpService.
     */
    public function match($ingredientIds, array $filters = [], ?Collection $urgency = null): Collection
    {
        $urgency ??= collect();
        $ingredientIds = collect($ingredientIds)->map(fn ($id) => (int) $id)->unique();
        $maxMissing = (int) ($filters['max_missing'] ?? 3);
        $limit = (int) ($filters['limit'] ?? 30);

        $query = Recipe::with(['user:id,name,username', 'categories:id,name', 'ingredientRecords:id,name,slug,aisle'])
            ->withCount('reviews');

        if (!empty($filters['cuisine'])) {
            $query->where('cuisine_code', $filters['cuisine']);
        }

        if (!empty($filters['region'])) {
            $query->where('cuisine_region', $filters['region']);
        }

        if (!empty($filters['skill'])) {
            $query->whereIn('difficulty', $this->skillLadder($filters['skill']));
        }

        if (!empty($filters['max_minutes'])) {
            $minutes = (int) $filters['max_minutes'];
            $query->whereRaw('(COALESCE(prep_minutes, 0) + COALESCE(cook_minutes, 0)) <= ?', [$minutes]);
        }

        $recipes = $query->get();

        return $recipes
            ->map(fn (Recipe $recipe) => $this->score($recipe, $ingredientIds, $urgency))
            ->reject(function (array $row) use ($maxMissing, $filters) {
                if ($row['required_count'] === 0) {
                    return true;
                }

                if (count($row['missing']) > $maxMissing) {
                    return true;
                }

                return $this->violatesDiet($row['recipe'], $filters)
                    || $this->hitsAllergy($row['recipe'], $filters);
            })
            ->sortBy([
                fn (array $a, array $b) => $b['priority_score'] <=> $a['priority_score'],
                fn (array $a, array $b) => count($a['missing']) <=> count($b['missing']),
                fn (array $a, array $b) => $b['recipe']->average_rating <=> $a['recipe']->average_rating,
            ])
            ->take($limit)
            ->values();
    }

    /**
     * How the two halves of the pitch combine into one running order.
     *
     * 70% "can I cook this tonight", 30% "does it save food that is about to go
     * off". With no expiry dates anywhere in the fridge every recipe scores 0
     * on the second term, so the ranking collapses back to plain match
     * percentage - nothing changes for a cook who never sets a date, and the
     * ordering stays explainable either way.
     */
    public function priority(float $matchRatio, int $useItUpScore): int
    {
        return (int) round((0.7 * $matchRatio * 100) + (0.3 * $useItUpScore));
    }

    /**
     * Everything a cook of the given skill level can reasonably attempt —
     * an advanced cook still sees beginner recipes.
     *
     * @return array<int, string>
     */
    public function skillLadder(string $skill): array
    {
        return match ($skill) {
            'beginner' => ['beginner'],
            'intermediate' => ['beginner', 'intermediate'],
            'advanced' => ['beginner', 'intermediate', 'advanced'],
            default => ['beginner', 'intermediate', 'advanced'],
        };
    }

    /** Pull the filter defaults off the signed-in cook's profile. */
    public function filtersForUser(?User $user, array $overrides = []): array
    {
        $base = [
            'diets' => $user?->dietary_preferences ?? [],
            'allergies' => $user?->allergies ?? [],
            'skill' => $user?->skill_level,
        ];

        return array_merge($base, array_filter($overrides, fn ($value) => $value !== null && $value !== ''));
    }

    /**
     * @param  Collection<int, int>  $ingredientIds
     * @param  Collection<int, array<string, mixed>>  $urgency
     */
    private function score(Recipe $recipe, Collection $ingredientIds, Collection $urgency): array
    {
        $required = $recipe->ingredientRecords->reject(fn ($i) => (bool) $i->pivot->is_optional);
        $requiredCount = $required->count();

        $have = $required->filter(fn ($i) => $ingredientIds->contains($i->id));
        $missing = $required->reject(fn ($i) => $ingredientIds->contains($i->id));

        $matchRatio = $requiredCount > 0 ? round($have->count() / $requiredCount, 3) : 0.0;

        // Only ingredients the cook actually holds can be rescued - a recipe
        // does not save your spinach by listing spinach you would have to buy.
        $useItUp = $this->useItUp->score($have->pluck('id'), $urgency);

        return [
            'recipe' => $recipe,
            'required_count' => $requiredCount,
            'have_count' => $have->count(),
            'match_ratio' => $matchRatio,
            'use_it_up_score' => $useItUp['score'],
            'rescues' => $useItUp['rescues'],
            'priority_score' => $this->priority($matchRatio, $useItUp['score']),
            'missing' => $missing
                ->map(fn ($i) => ['id' => $i->id, 'name' => $i->name, 'aisle' => $i->aisle, 'raw_text' => $i->pivot->raw_text])
                ->values()
                ->all(),
        ];
    }

    private function violatesDiet(Recipe $recipe, array $filters): bool
    {
        $diets = collect($filters['diets'] ?? [])->filter()->map(fn ($d) => strtolower((string) $d));

        if ($diets->isEmpty()) {
            return false;
        }

        $tags = collect($recipe->diet_tags ?? [])->map(fn ($t) => strtolower((string) $t));

        // Every preference the cook set must be satisfied by the recipe.
        return $diets->contains(fn ($diet) => !$tags->contains($diet));
    }

    private function hitsAllergy(Recipe $recipe, array $filters): bool
    {
        $allergies = collect($filters['allergies'] ?? [])
            ->filter()
            ->map(fn ($a) => Ingredient::slugify((string) $a));

        if ($allergies->isEmpty()) {
            return false;
        }

        return $recipe->ingredientRecords
            ->contains(fn ($ingredient) => $allergies->contains($ingredient->slug));
    }
}
