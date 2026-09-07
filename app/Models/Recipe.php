<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class Recipe extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'ingredients',
        'instructions',
        'image_path',
        'average_rating',
        'cuisine_country',
        'cuisine_code',
        'cuisine_region',
        'difficulty',
        'prep_minutes',
        'cook_minutes',
        'servings',
        'step_timers',
        'diet_tags',
        'nutrition',
        'nutrition_source',
    ];

    protected $casts = [
        'ingredients' => 'array',
        'instructions' => 'array',
        'step_timers' => 'array',
        'diet_tags' => 'array',
        'nutrition' => 'array',
        'average_rating' => 'float',
        'prep_minutes' => 'integer',
        'cook_minutes' => 'integer',
        'servings' => 'integer',
    ];

    protected $appends = [
        'image_url',
        'total_minutes',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function favoritedByUsers()
    {
        return $this->belongsToMany(User::class, 'favorite_recipe')
            ->withTimestamps();
    }

    public function ingredientRecords()
    {
        return $this->belongsToMany(Ingredient::class)
            ->withPivot(['quantity', 'unit', 'raw_text', 'is_optional', 'position'])
            ->orderBy('ingredient_recipe.position');
    }

    public function mealPlanEntries()
    {
        return $this->hasMany(MealPlanEntry::class);
    }

    public function getImageUrlAttribute()
    {
        return $this->image_path ? '/api/recipe-images/' . $this->image_path : null;
    }

    public function getTotalMinutesAttribute()
    {
        $total = (int) $this->prep_minutes + (int) $this->cook_minutes;

        return $total > 0 ? $total : null;
    }
}
