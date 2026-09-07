<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PantryItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'ingredient_id',
        'quantity',
        'unit',
        'expires_on',
        'source',
        'detected_as',
        'confidence',
    ];

    protected $casts = [
        'quantity' => 'float',
        'expires_on' => 'date',
        'confidence' => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }
}
