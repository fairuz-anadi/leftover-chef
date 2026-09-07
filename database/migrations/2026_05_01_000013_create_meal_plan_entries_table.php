<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_plan_entries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('recipe_id');
            $table->date('plan_date');
            $table->string('meal_slot'); // breakfast | lunch | dinner | snack
            $table->unsignedSmallInteger('servings')->default(2);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('recipe_id')->references('id')->on('recipes')->cascadeOnDelete();
            $table->unique(['user_id', 'plan_date', 'meal_slot']);
            $table->index(['user_id', 'plan_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_plan_entries');
    }
};
