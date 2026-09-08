<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per ingredient that either got used in time or did not.
 *
 * This is the food-waste-saved counter, and the reason it is a table rather
 * than a number in component state: the claim on screen is the project's whole
 * social-impact argument, and a figure that resets on refresh is not a claim,
 * it is a decoration.
 */
class WasteEvent extends Model
{
    public const RESCUED = 'rescued';
    public const LOST = 'lost';

    protected $fillable = ['session_id', 'ingredient_name', 'kind', 'days_left'];

    protected $casts = ['days_left' => 'integer'];

    public function scopeRescued($query)
    {
        return $query->where('kind', self::RESCUED);
    }

    public function scopeLost($query)
    {
        return $query->where('kind', self::LOST);
    }
}
