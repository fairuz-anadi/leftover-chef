<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class MealPlanEntry extends Model
{
    use HasFactory;

    public const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

    protected $fillable = [
        'user_id',
        'recipe_id',
        'plan_date',
        'meal_slot',
        'servings',
    ];

    protected $casts = [
        'servings' => 'integer',
    ];

    /**
     * Stored as a bare `YYYY-MM-DD` string rather than through the `date`
     * cast, which would write `YYYY-MM-DD 00:00:00` on SQLite. The week
     * lookup compares against date-only bounds, and the trailing time would
     * push the last day of the week outside the range — and make
     * updateOrCreate miss the row it should have replaced.
     */
    protected function planDate(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => Carbon::parse($value)->startOfDay(),
            set: fn ($value) => Carbon::parse($value)->toDateString(),
        );
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }
}
