<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Bengali name, alongside the English one.
 *
 * Display only. The English name stays the canonical key that recipes, the
 * detector vocabulary and the alias table all resolve through, so nothing
 * downstream has to know this column exists. Nullable, because an ingredient
 * without a Bengali name should still work — it just shows in English.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            $table->string('name_bn')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            $table->dropColumn('name_bn');
        });
    }
};
