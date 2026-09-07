<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'Breakfast',
            'Lunch',
            'Dinner',
            'Dessert',
            'Vegan',
            'Street Food',
            'Quick Meals',
            'Seafood',
            'Italian',
            'Bengali',
        ] as $categoryName) {
            Category::firstOrCreate(['name' => $categoryName]);
        }

        User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@leftoverchef.test')],
            [
                'name' => 'Leftover Chef Admin',
                'username' => 'admin',
                'password' => Hash::make(env('ADMIN_PASSWORD', 'AdminPass123!')),
                'email_verified_at' => now(),
                'is_admin' => true,
            ]
        );

        $this->call([
            IngredientSeeder::class,
            RecipeSeeder::class,
            DemoCookSeeder::class,
        ]);
    }
}
