<?php

namespace App\Http\Services;

use App\Models\Ingredient;
use Illuminate\Support\Collection;

/**
 * Turns raw detector output into rows the rest of the app understands.
 *
 * The sidecar already emits a canonical ingredient name per detection, but it
 * has no database, so it cannot know whether "Chopped Tomatoes" actually exists
 * in this install. That check happens here, through Ingredient::lookup(), which
 * also means the alias table does the work: a detector label of "capsicum"
 * resolves to Bell Pepper without a single line of mapping code.
 *
 * Anything that does not resolve is not silently dropped — it comes back under
 * `unmatched` so the UI can show it and the cook can add it by hand.
 */
class DetectionMapper
{
    /**
     * @param  array<int, array<string, mixed>>  $detections  Raw sidecar detections.
     * @return array{items: array<int, array<string, mixed>>, unmatched: array<int, array<string, mixed>>}
     */
    public function map(array $detections): array
    {
        $resolved = collect();
        $unmatched = collect();

        foreach ($detections as $detection) {
            $name = trim((string) ($detection['ingredient'] ?? ''));
            $label = trim((string) ($detection['label'] ?? $name));
            $confidence = round((float) ($detection['confidence'] ?? 0), 4);
            $box = $this->normaliseBox($detection['box'] ?? null);

            if ($name === '') {
                continue;
            }

            $ingredient = Ingredient::lookup($name);

            if (!$ingredient) {
                $unmatched->push([
                    'label' => $label,
                    'name' => $name,
                    'confidence' => $confidence,
                    'box' => $box,
                ]);

                continue;
            }

            $resolved->push([
                'ingredient_id' => $ingredient->id,
                'name' => $ingredient->name,
                'slug' => $ingredient->slug,
                'aisle' => $ingredient->aisle,
                'label' => $label,
                'confidence' => $confidence,
                'box' => $box,
            ]);
        }

        return [
            'items' => $this->collapse($resolved)->all(),
            'unmatched' => $this->collapse($unmatched, 'name')->all(),
        ];
    }

    /**
     * One chip per ingredient, keeping the most confident sighting.
     *
     * The boxes are all kept, because "3 tomatoes" is more convincing on screen
     * than one box labelled tomato — but the cook only ever confirms the
     * ingredient once.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return Collection<int, array<string, mixed>>
     */
    private function collapse(Collection $rows, string $key = 'slug'): Collection
    {
        return $rows
            ->groupBy($key)
            ->map(function (Collection $group) {
                $best = $group->sortByDesc('confidence')->first();

                return array_merge($best, [
                    'count' => $group->count(),
                    'boxes' => $group->pluck('box')->filter()->values()->all(),
                ]);
            })
            ->sortByDesc('confidence')
            ->values()
            ->map(function (array $row) {
                unset($row['box']);

                return $row;
            });
    }

    /** @return array<int, float>|null */
    private function normaliseBox(mixed $box): ?array
    {
        if (!is_array($box) || count($box) !== 4) {
            return null;
        }

        return array_map(fn ($value) => round((float) $value, 1), array_values($box));
    }
}
