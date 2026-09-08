<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Recipe authorship, and nothing else.
 *
 * The app has no accounts: nobody signs in, and there is no route that reads
 * or writes a user. This survives only because the seeded recipe dataset
 * records who each dish came from, which is metadata about the data rather
 * than a feature of the product.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'google_id',
        'points',
        'is_admin',
        'skill_level',
        'dietary_preferences',
        'allergies',
        'household_size',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_admin' => 'boolean',
        'dietary_preferences' => 'array',
        'allergies' => 'array',
        'household_size' => 'integer',
    ];

    public function recipes()
    {
        return $this->hasMany(Recipe::class);
    }

}
