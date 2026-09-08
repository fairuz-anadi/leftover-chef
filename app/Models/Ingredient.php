<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Support\ShelfLifeCatalog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Ingredient extends Model
{
    use HasFactory;

    protected $fillable = [
        'slug',
        'name',
        'aisle',
        'calories_per_100g',
        'protein_per_100g',
        'carbs_per_100g',
        'fat_per_100g',
        'aliases',
        'is_staple',
        'shelf_life_days',
    ];

    protected $casts = [
        'aliases' => 'array',
        'is_staple' => 'boolean',
        'calories_per_100g' => 'float',
        'protein_per_100g' => 'float',
        'carbs_per_100g' => 'float',
        'fat_per_100g' => 'float',
        'shelf_life_days' => 'integer',
    ];

    public function recipes()
    {
        return $this->belongsToMany(Recipe::class)
            ->withPivot(['quantity', 'unit', 'raw_text', 'is_optional', 'position']);
    }

    public function pantryItems()
    {
        return $this->hasMany(PantryItem::class);
    }

    /**
     * Normalise a free-text ingredient name into a stable lookup key.
     *
     * Case, spacing and punctuation are flattened, and the final word is
     * singularised so "Green Chillies", "green chilli" and "GREEN CHILLI"
     * all land on "green-chilli" — without that, a fridge stocked with
     * chilli would not match a recipe calling for chillies.
     */
    public static function slugify(string $name): string
    {
        $words = preg_split('/\s+/', Str::of($name)->lower()->squish()->toString()) ?: [];

        if ($words !== []) {
            $last = array_pop($words);
            $words[] = Str::singular($last);
        }

        return Str::slug(implode(' ', $words));
    }

    /**
     * Find an ingredient by slug or by one of its aliases. Returns null
     * rather than creating anything, so read-only callers (the nutrition
     * estimator, search) cannot pollute the vocabulary.
     */
    public static function lookup(string $name): ?self
    {
        $slug = self::slugify($name);

        if ($slug === '') {
            return null;
        }

        $existing = self::where('slug', $slug)->first();
        if ($existing) {
            return $existing;
        }

        return self::whereNotNull('aliases')->get()
            ->first(fn (self $ingredient) => collect($ingredient->aliases ?? [])
                ->map(fn ($alias) => self::slugify((string) $alias))
                ->contains($slug));
    }

    /**
     * Look the ingredient up by slug or alias, creating a bare row when the
     * pantry vocabulary has not seen this name before.
     */
    public static function resolve(string $name): self
    {
        $clean = Str::of($name)->squish()->toString();

        return self::lookup($clean) ?? self::create([
            'slug' => self::slugify($clean),
            'name' => Str::title($clean),
            'aisle' => 'other',
        ]);
    }

    /**
     * Typical shelf life once this is in someone's fridge, or null if it does
     * not meaningfully expire.
     *
     * Prefers the seeded column and falls back to the catalog, so a row
     * created on the fly by resolve() - which has no shelf life of its own -
     * still gets whatever its aisle suggests.
     */
    public function shelfLifeDays(): ?int
    {
        return $this->shelf_life_days ?? ShelfLifeCatalog::daysFor($this->slug, $this->aisle);
    }

    /**
     * The use-by date to propose when this lands in a fridge today.
     *
     * A guess, and treated as one everywhere it is used: the pantry row marks
     * it estimated and the UI shows it differently from a date a cook typed.
     */
    public function suggestedExpiry(): ?Carbon
    {
        $days = $this->shelfLifeDays();

        return $days === null ? null : Carbon::today()->addDays($days);
    }
}
