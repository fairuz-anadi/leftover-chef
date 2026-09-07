<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('favorite_recipe', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('recipe_id');
            $table->timestamps();
            $table->unique(['user_id', 'recipe_id']);
            
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('recipe_id')->references('id')->on('recipes')->noActionOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorite_recipe');
    }
};
