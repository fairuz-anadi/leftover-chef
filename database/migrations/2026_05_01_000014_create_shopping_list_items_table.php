<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopping_list_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('ingredient_id')->nullable();
            $table->string('name');
            $table->decimal('quantity', 8, 2)->nullable();
            $table->string('unit')->nullable();
            $table->string('aisle')->default('other');
            $table->boolean('is_checked')->default(false);
            $table->string('source')->default('manual'); // manual | auto
            $table->json('recipe_titles')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->nullOnDelete();
            $table->index(['user_id', 'is_checked']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopping_list_items');
    }
};
