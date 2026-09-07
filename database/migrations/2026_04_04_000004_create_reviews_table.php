<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('recipe_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedTinyInteger('rating')->default(0);
            $table->text('comment')->nullable();
            $table->timestamps();
            $table->unique(['recipe_id', 'user_id']);
            
            $table->foreign('recipe_id')->references('id')->on('recipes')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->noActionOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
