<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Everything the app needs to run offline: the ingredient vocabulary with its
 * shelf lives, and the local recipe dataset.
 *
 * No users, no categories to browse, no demo account — a visitor's fridge is
 * stocked by DemoFridge the first time they open the app, keyed to their
 * session rather than to a login.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            IngredientSeeder::class,
            RecipeSeeder::class,
        ]);
    }
}
