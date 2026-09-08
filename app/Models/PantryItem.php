<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One thing on the shelf.
 *
 * Belongs to a fridge session rather than a user — there are no accounts.
 */
class PantryItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'ingredient_id',
        'quantity',
        'unit',
        'expires_on',
        'expiry_estimated',
        'source',
        'detected_as',
        'confidence',
    ];

    protected $casts = [
        'quantity' => 'float',
        'expires_on' => 'date',
        'expiry_estimated' => 'boolean',
        'confidence' => 'float',
    ];

    public function session()
    {
        return $this->belongsTo(FridgeSession::class, 'session_id', 'session_id');
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }
}
