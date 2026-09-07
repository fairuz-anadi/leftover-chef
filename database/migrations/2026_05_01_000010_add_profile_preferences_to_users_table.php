<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('skill_level')->default('beginner');
            $table->json('dietary_preferences')->nullable();
            $table->json('allergies')->nullable();
            $table->unsignedSmallInteger('household_size')->default(2);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['skill_level', 'dietary_preferences', 'allergies', 'household_size']);
        });
    }
};
