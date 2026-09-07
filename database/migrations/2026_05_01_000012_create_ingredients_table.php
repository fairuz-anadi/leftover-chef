<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('aisle')->default('other')->index();
            // Nutrition per 100 g, used by the local nutrition estimator.
            $table->decimal('calories_per_100g', 8, 2)->nullable();
            $table->decimal('protein_per_100g', 8, 2)->nullable();
            $table->decimal('carbs_per_100g', 8, 2)->nullable();
            $table->decimal('fat_per_100g', 8, 2)->nullable();
            $table->json('aliases')->nullable();
            $table->boolean('is_staple')->default(false);
            $table->timestamps();
        });

        Schema::create('ingredient_recipe', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('recipe_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity', 8, 2)->nullable();
            $table->string('unit')->nullable();
            $table->string('raw_text');
            $table->boolean('is_optional')->default(false);
            $table->unsignedSmallInteger('position')->default(0);

            $table->foreign('recipe_id')->references('id')->on('recipes')->cascadeOnDelete();
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->cascadeOnDelete();
            $table->unique(['recipe_id', 'ingredient_id']);
        });

        Schema::create('pantry_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity', 8, 2)->nullable();
            $table->string('unit')->nullable();
            $table->date('expires_on')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->cascadeOnDelete();
            $table->unique(['user_id', 'ingredient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pantry_items');
        Schema::dropIfExists('ingredient_recipe');
        Schema::dropIfExists('ingredients');
    }
};
