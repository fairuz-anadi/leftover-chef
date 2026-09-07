<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Cuisine Map Explorer
            $table->string('cuisine_country')->nullable()->index();
            $table->string('cuisine_code', 2)->nullable()->index();
            $table->string('cuisine_region')->nullable()->index();

            // Guided Cooking Mode / filtering
            $table->string('difficulty')->default('beginner')->index();
            $table->unsignedSmallInteger('prep_minutes')->nullable();
            $table->unsignedSmallInteger('cook_minutes')->nullable();
            $table->unsignedSmallInteger('servings')->default(2);
            $table->json('step_timers')->nullable();

            // Personalisation
            $table->json('diet_tags')->nullable();

            // Nutrition Insights (per serving)
            $table->json('nutrition')->nullable();
            $table->string('nutrition_source')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn([
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
            ]);
        });
    }
};
