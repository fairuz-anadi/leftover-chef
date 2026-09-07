<?php

namespace App\Support;

use App\Models\Recipe;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Generates a flat-illustration "plated dish" SVG for a recipe.
 *
 * Every recipe gets a distinct image without shipping stock photography: the
 * layout is fixed (overhead plate on a tinted ground), while the palette,
 * blob silhouette and garnish scatter are all derived deterministically from
 * the recipe title. The same title always produces the same picture, so
 * re-seeding does not churn the image files.
 */
class DishArtwork
{
    private const WIDTH = 800;
    private const HEIGHT = 600;

    /** Food palettes: [ground, plate rim, food body, food shade, garnish A, garnish B]. */
    private const PALETTES = [
        'greens' => ['#eef2ec', '#f7f9f6', '#7c9a63', '#5f7d49', '#c9d67f', '#3f5c34'],
        'tomato' => ['#f4ece7', '#fbf7f4', '#c0533a', '#9c3f2c', '#e8a06a', '#5c7f4e'],
        'spice'  => ['#f5efe4', '#fcf9f3', '#c98432', '#a66722', '#e0b96a', '#7d4a2a'],
        'golden' => ['#f6f2e6', '#fdfbf5', '#dcb45f', '#bf9540', '#f0dca4', '#8a6a34'],
        'seafood' => ['#eaf0f2', '#f8fbfc', '#d98f78', '#b86e59', '#a9c4cc', '#4d6b74'],
        'meat'   => ['#f2ece8', '#faf7f5', '#8f5637', '#6f402a', '#c98432', '#5c7f4e'],
        'dessert' => ['#f3eeea', '#fbf8f6', '#5d3b2c', '#432a1f', '#d9b48a', '#8a5a3c'],
        'herb'   => ['#edf1ee', '#f8faf8', '#5f7d49', '#445c34', '#a9c47f', '#c98432'],
    ];

    /**
     * Write the artwork to the public disk and point the recipe at it.
     * Used for seeded recipes and for uploads that arrive without a photo, so
     * no recipe ever renders as an empty grey box.
     */
    public static function attach(Recipe $recipe): Recipe
    {
        $path = 'recipes/generated/' . Str::slug($recipe->title) . '.svg';

        Storage::disk('public')->put($path, self::svg($recipe));

        $recipe->forceFill(['image_path' => $path])->save();

        return $recipe;
    }

    public static function svg(Recipe $recipe): string
    {
        $seed = crc32(mb_strtolower(trim($recipe->title)));
        $rand = self::generator($seed);

        $palette = self::PALETTES[self::paletteKey($recipe, $rand)];
        [$ground, $plate, $body, $shade, $garnishA, $garnishB] = $palette;

        $cx = self::WIDTH / 2;
        $cy = self::HEIGHT / 2;

        $parts = [];
        $parts[] = self::header();
        $parts[] = self::defs($ground, $body);

        // Ground + soft vignette
        $parts[] = '<rect width="' . self::WIDTH . '" height="' . self::HEIGHT . '" fill="' . $ground . '"/>';
        $parts[] = '<rect width="' . self::WIDTH . '" height="' . self::HEIGHT . '" fill="url(#wash)"/>';

        // Table shadow, then the plate itself
        $parts[] = '<ellipse cx="' . $cx . '" cy="' . ($cy + 14) . '" rx="212" ry="206" fill="rgba(16,24,32,0.10)"/>';
        $parts[] = '<circle cx="' . $cx . '" cy="' . $cy . '" r="208" fill="' . $plate . '"/>';
        $parts[] = '<circle cx="' . $cx . '" cy="' . $cy . '" r="208" fill="none" stroke="rgba(16,24,32,0.10)" stroke-width="2"/>';
        $parts[] = '<circle cx="' . $cx . '" cy="' . $cy . '" r="176" fill="none" stroke="rgba(16,24,32,0.06)" stroke-width="1.5"/>';

        // The food: two offset blobs so the mass reads as layered, not flat
        $parts[] = '<path d="' . self::blob($cx, $cy + 6, 128, 10, 0.16, $rand) . '" fill="' . $shade . '"/>';
        $parts[] = '<path d="' . self::blob($cx, $cy - 4, 124, 10, 0.18, $rand) . '" fill="' . $body . '"/>';
        $parts[] = '<path d="' . self::blob($cx - 14, $cy - 16, 74, 9, 0.22, $rand) . '" fill="rgba(255,255,255,0.14)"/>';

        // Garnish scattered over the food, and a couple of crumbs on the rim
        $parts[] = self::garnish($cx, $cy, 118, 11, [$garnishA, $garnishB], $rand);
        $parts[] = self::garnish($cx, $cy, 190, 4, [$garnishA], $rand, 0.5);

        $parts[] = '<rect width="' . self::WIDTH . '" height="' . self::HEIGHT . '" fill="url(#grain)" opacity="0.05"/>';
        $parts[] = '</svg>';

        return implode("\n", $parts);
    }

    /** Deterministic 0..1 generator (xorshift), so artwork is stable per title. */
    private static function generator(int $seed): callable
    {
        $state = $seed !== 0 ? $seed : 0x9e3779b9;

        return function () use (&$state): float {
            $state ^= ($state << 13) & 0xFFFFFFFF;
            $state ^= ($state >> 17);
            $state ^= ($state << 5) & 0xFFFFFFFF;
            $state &= 0xFFFFFFFF;

            return $state / 0xFFFFFFFF;
        };
    }

    private static function paletteKey(Recipe $recipe, callable $rand): string
    {
        $categories = mb_strtolower($recipe->categories->pluck('name')->implode(' '));
        $diets = collect($recipe->diet_tags ?? [])->map(fn ($t) => mb_strtolower((string) $t));
        $title = mb_strtolower($recipe->title);

        return match (true) {
            str_contains($categories, 'dessert') => 'dessert',
            str_contains($categories, 'seafood'), $diets->contains('pescatarian') => 'seafood',
            $diets->contains('vegan') => 'greens',
            str_contains($title, 'curry'), str_contains($title, 'tikka'), str_contains($title, 'tagine') => 'spice',
            str_contains($title, 'tomato'), str_contains($title, 'shakshuka'), str_contains($title, 'pizza') => 'tomato',
            str_contains($title, 'rice'), str_contains($title, 'katsu'), str_contains($title, 'pasta') => 'golden',
            $diets->contains('vegetarian') => 'herb',
            default => $rand() > 0.5 ? 'meat' : 'golden',
        };
    }

    /**
     * A closed organic shape: points sampled around a circle with jittered
     * radius, joined with a Catmull-Rom spline converted to cubic beziers.
     */
    private static function blob(float $cx, float $cy, float $radius, int $points, float $jitter, callable $rand): string
    {
        $coords = [];
        for ($i = 0; $i < $points; $i++) {
            $angle = ($i / $points) * 2 * M_PI;
            $r = $radius * (1 - $jitter + $rand() * $jitter * 2);
            $coords[] = [$cx + cos($angle) * $r, $cy + sin($angle) * $r];
        }

        $count = count($coords);
        $path = 'M' . self::point($coords[0]);

        for ($i = 0; $i < $count; $i++) {
            $p0 = $coords[($i - 1 + $count) % $count];
            $p1 = $coords[$i];
            $p2 = $coords[($i + 1) % $count];
            $p3 = $coords[($i + 2) % $count];

            $c1 = [$p1[0] + ($p2[0] - $p0[0]) / 6, $p1[1] + ($p2[1] - $p0[1]) / 6];
            $c2 = [$p2[0] - ($p3[0] - $p1[0]) / 6, $p2[1] - ($p3[1] - $p1[1]) / 6];

            $path .= 'C' . self::point($c1) . ' ' . self::point($c2) . ' ' . self::point($p2);
        }

        return $path . 'Z';
    }

    /** Scatter small ellipses and leaf shapes within a radius. */
    private static function garnish(float $cx, float $cy, float $radius, int $count, array $colours, callable $rand, float $scale = 1.0): string
    {
        $shapes = [];

        for ($i = 0; $i < $count; $i++) {
            $angle = $rand() * 2 * M_PI;
            $distance = sqrt($rand()) * $radius;
            $x = $cx + cos($angle) * $distance;
            $y = $cy + sin($angle) * $distance;
            $colour = $colours[(int) floor($rand() * count($colours))] ?? $colours[0];
            $size = (5 + $rand() * 9) * $scale;
            $rotation = $rand() * 360;

            if ($rand() > 0.45) {
                $shapes[] = sprintf(
                    '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s" transform="rotate(%.1f %.1f %.1f)" opacity="0.92"/>',
                    $x, $y, $size, $size * 0.55, $colour, $rotation, $x, $y
                );
                continue;
            }

            // Leaf: two mirrored quadratic curves.
            $shapes[] = sprintf(
                '<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f Q%.1f %.1f %.1f %.1f Z" fill="%s" transform="rotate(%.1f %.1f %.1f)" opacity="0.92"/>',
                $x - $size, $y,
                $x, $y - $size * 0.85, $x + $size, $y,
                $x, $y + $size * 0.85, $x - $size, $y,
                $colour, $rotation, $x, $y
            );
        }

        return implode('', $shapes);
    }

    private static function point(array $p): string
    {
        return sprintf('%.1f %.1f', $p[0], $p[1]);
    }

    private static function header(): string
    {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . self::WIDTH . ' ' . self::HEIGHT . '" '
            . 'width="' . self::WIDTH . '" height="' . self::HEIGHT . '" role="img">';
    }

    private static function defs(string $ground, string $body): string
    {
        return <<<SVG
        <defs>
          <radialGradient id="wash" cx="30%" cy="20%" r="85%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
            <stop offset="60%" stop-color="{$ground}" stop-opacity="0"/>
            <stop offset="100%" stop-color="{$body}" stop-opacity="0.16"/>
          </radialGradient>
          <filter id="grainFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
          </filter>
          <pattern id="grain" width="180" height="180" patternUnits="userSpaceOnUse">
            <rect width="180" height="180" filter="url(#grainFilter)"/>
          </pattern>
        </defs>
        SVG;
    }
}
