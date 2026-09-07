<?php

namespace App\Http\Services;

use Illuminate\Support\Str;

/**
 * Turns a free-text recipe line ("2 1/2 cups all-purpose flour, sifted") into
 * the structured pieces the pantry matcher, shopping list and nutrition
 * estimator all need.
 */
class IngredientParser
{
    /** Unit aliases → canonical unit. */
    private const UNITS = [
        'g' => 'g', 'gram' => 'g', 'grams' => 'g', 'gr' => 'g',
        'kg' => 'kg', 'kilo' => 'kg', 'kilos' => 'kg', 'kilogram' => 'kg', 'kilograms' => 'kg',
        'mg' => 'mg',
        'oz' => 'oz', 'ounce' => 'oz', 'ounces' => 'oz',
        'lb' => 'lb', 'lbs' => 'lb', 'pound' => 'lb', 'pounds' => 'lb',
        'ml' => 'ml', 'milliliter' => 'ml', 'millilitre' => 'ml', 'milliliters' => 'ml', 'millilitres' => 'ml',
        'l' => 'l', 'liter' => 'l', 'litre' => 'l', 'liters' => 'l', 'litres' => 'l',
        'cup' => 'cup', 'cups' => 'cup',
        'tbsp' => 'tbsp', 'tablespoon' => 'tbsp', 'tablespoons' => 'tbsp', 'tbs' => 'tbsp',
        'tsp' => 'tsp', 'teaspoon' => 'tsp', 'teaspoons' => 'tsp',
        'pinch' => 'pinch', 'pinches' => 'pinch',
        'clove' => 'clove', 'cloves' => 'clove',
        'slice' => 'slice', 'slices' => 'slice',
        'piece' => 'piece', 'pieces' => 'piece',
        'can' => 'can', 'cans' => 'can',
        'packet' => 'packet', 'packets' => 'packet', 'pack' => 'packet',
        'bunch' => 'bunch', 'bunches' => 'bunch',
        'handful' => 'handful', 'handfuls' => 'handful',
        'stick' => 'stick', 'sticks' => 'stick',
    ];

    /** Approximate grams for one of each unit — good enough for a per-serving estimate. */
    private const GRAMS_PER_UNIT = [
        'g' => 1.0, 'kg' => 1000.0, 'mg' => 0.001,
        'oz' => 28.35, 'lb' => 453.59,
        'ml' => 1.0, 'l' => 1000.0,
        'cup' => 150.0, 'tbsp' => 15.0, 'tsp' => 5.0,
        'pinch' => 0.5, 'clove' => 5.0, 'slice' => 25.0, 'piece' => 60.0,
        'can' => 400.0, 'packet' => 100.0, 'bunch' => 80.0, 'handful' => 30.0,
        'stick' => 113.0,
    ];

    /** Preparation words to strip so "finely chopped onion" resolves to "onion". */
    private const DESCRIPTORS = [
        'finely', 'roughly', 'coarsely', 'thinly', 'freshly', 'lightly',
        'chopped', 'minced', 'diced', 'sliced', 'grated', 'shredded', 'crushed',
        'peeled', 'melted', 'softened', 'beaten', 'cooked', 'uncooked', 'raw',
        'large', 'small', 'medium', 'ripe', 'fresh', 'dried', 'ground', 'whole',
        'optional', 'divided', 'plus', 'more', 'extra', 'warm', 'cold', 'hot',
        'room', 'temperature', 'boneless', 'skinless', 'unsalted', 'salted',
    ];

    private const VULGAR_FRACTIONS = [
        '½' => '1/2', '⅓' => '1/3', '⅔' => '2/3', '¼' => '1/4', '¾' => '3/4',
        '⅕' => '1/5', '⅙' => '1/6', '⅛' => '1/8', '⅜' => '3/8', '⅝' => '5/8', '⅞' => '7/8',
    ];

    /**
     * @return array{quantity: float|null, unit: string|null, name: string, raw_text: string, is_optional: bool}
     */
    public function parse(string $line): array
    {
        $raw = Str::of($line)->squish()->toString();
        $working = Str::lower($raw);

        $isOptional = Str::contains($working, ['(optional)', ', optional', 'optional)']);

        // Drop parenthetical asides and anything after the first comma —
        // "2 onions, finely chopped" keeps only "2 onions".
        $working = preg_replace('/\([^)]*\)/', ' ', $working) ?? $working;
        $working = explode(',', $working)[0];

        $working = strtr($working, self::VULGAR_FRACTIONS);
        $working = str_replace(['–', '—'], '-', $working);

        [$quantity, $working] = $this->extractQuantity($working);
        [$unit, $working] = $this->extractUnit($working);

        $name = $this->cleanName($working);

        if ($name === '') {
            // Nothing but a quantity — fall back to the original text so the
            // line still shows up on the shopping list.
            $name = $this->cleanName(Str::lower($raw));
        }

        return [
            'quantity' => $quantity,
            'unit' => $unit,
            'name' => $name,
            'raw_text' => $raw,
            'is_optional' => $isOptional,
        ];
    }

    /** Convert a parsed quantity to grams, or null when it cannot be known. */
    public function toGrams(?float $quantity, ?string $unit): ?float
    {
        if ($quantity === null || $quantity <= 0) {
            return null;
        }

        if ($unit === null) {
            // Bare count, e.g. "2 eggs" — assume a medium piece.
            return $quantity * self::GRAMS_PER_UNIT['piece'];
        }

        $perUnit = self::GRAMS_PER_UNIT[$unit] ?? null;

        return $perUnit === null ? null : $quantity * $perUnit;
    }

    /**
     * @return array{0: float|null, 1: string}
     */
    private function extractQuantity(string $text): array
    {
        $text = trim($text);

        // "1 1/2", "1/2", "2.5", "2-3" (take the lower bound), "2"
        $pattern = '/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*/';

        if (!preg_match($pattern, $text, $matches)) {
            return [null, $text];
        }

        $token = trim($matches[1]);
        $rest = trim(substr($text, strlen($matches[0])));

        // Range: keep the smaller number.
        if (Str::contains($token, '-')) {
            $token = trim(explode('-', $token)[0]);
        }

        if (preg_match('/^(\d+)\s+(\d+)\/(\d+)$/', $token, $mixed)) {
            $value = (float) $mixed[1] + ((float) $mixed[2] / (float) $mixed[3]);
        } elseif (preg_match('/^(\d+)\/(\d+)$/', $token, $frac)) {
            $value = (float) $frac[1] / (float) $frac[2];
        } else {
            $value = (float) $token;
        }

        return [round($value, 3), $rest];
    }

    /**
     * @return array{0: string|null, 1: string}
     */
    private function extractUnit(string $text): array
    {
        $text = trim($text);
        $words = preg_split('/\s+/', $text) ?: [];

        if ($words === [] || $words[0] === '') {
            return [null, $text];
        }

        $candidate = rtrim(Str::lower($words[0]), '.');

        if (!isset(self::UNITS[$candidate])) {
            return [null, $text];
        }

        array_shift($words);

        // "cups of flour" → drop the "of".
        if (isset($words[0]) && Str::lower($words[0]) === 'of') {
            array_shift($words);
        }

        return [self::UNITS[$candidate], implode(' ', $words)];
    }

    private function cleanName(string $text): string
    {
        $text = preg_replace('/[^a-z0-9\s\-]/i', ' ', Str::lower($text)) ?? $text;

        $words = collect(preg_split('/\s+/', $text) ?: [])
            ->map(fn ($word) => trim($word))
            ->filter()
            ->reject(fn ($word) => in_array($word, self::DESCRIPTORS, true))
            ->reject(fn ($word) => in_array($word, ['of', 'to', 'taste', 'and', 'or', 'a', 'an', 'the'], true))
            ->values();

        return Str::of($words->implode(' '))->squish()->toString();
    }
}
