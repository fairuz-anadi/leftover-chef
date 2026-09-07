<?php

namespace App\Http\Services;

use App\Models\Recipe;
use Illuminate\Support\Str;

/**
 * Guided Cooking Mode — turns a recipe's instruction list into timed steps.
 *
 * Any duration written into a step ("simmer for 20 minutes", "rest 1 hour")
 * becomes a countdown the UI can start with one tap; an explicit
 * `step_timers` array on the recipe overrides the detected value.
 */
class GuidedCookService
{
    public function steps(Recipe $recipe): array
    {
        $overrides = collect($recipe->step_timers ?? []);

        return collect($recipe->instructions ?? [])
            ->values()
            ->map(function ($text, int $index) use ($overrides) {
                $text = (string) $text;
                $override = $overrides->get($index);

                return [
                    'index' => $index,
                    'number' => $index + 1,
                    'text' => $text,
                    'timer_seconds' => $override !== null && $override !== ''
                        ? (int) $override
                        : $this->detectSeconds($text),
                    // The UI reads this aloud; keeping it separate leaves room
                    // to strip parentheticals from the spoken version later.
                    'speech' => Str::of($text)->squish()->toString(),
                ];
            })
            ->all();
    }

    /** First duration mentioned in the step, in seconds, or null. */
    public function detectSeconds(string $text): ?int
    {
        $normalised = Str::lower($text);

        // "10-12 minutes" → take the upper bound so the timer never rings early.
        $pattern = '/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/';
        if (preg_match($pattern, $normalised, $range)) {
            return $this->toSeconds((float) $range[2], $range[3]);
        }

        if (preg_match('/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/', $normalised, $single)) {
            return $this->toSeconds((float) $single[1], $single[2]);
        }

        return null;
    }

    private function toSeconds(float $value, string $unit): int
    {
        $seconds = match (true) {
            Str::startsWith($unit, ['hour', 'hr']) => $value * 3600,
            Str::startsWith($unit, ['min']) => $value * 60,
            default => $value,
        };

        return (int) round($seconds);
    }
}
