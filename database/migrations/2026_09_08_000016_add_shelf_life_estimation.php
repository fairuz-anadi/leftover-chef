<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Expiry estimation on scan.
 *
 * `ingredients.shelf_life_days` holds how long the thing lasts once it is
 * home, so adding it to a fridge can propose a use-by date instead of leaving
 * the field blank. Nullable throughout: salt does not expire, and a column
 * that forces a number would invent one.
 *
 * `pantry_items.expiry_estimated` records that the date was our guess rather
 * than the cook's. It matters: a guessed date must not look like a fact on
 * screen, and the moment somebody corrects one it stops being a guess.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            $table->unsignedSmallInteger('shelf_life_days')->nullable()->after('is_staple');
        });

        Schema::table('pantry_items', function (Blueprint $table) {
            $table->boolean('expiry_estimated')->default(false)->after('expires_on');
        });
    }

    public function down(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            $table->dropColumn('shelf_life_days');
        });

        Schema::table('pantry_items', function (Blueprint $table) {
            $table->dropColumn('expiry_estimated');
        });
    }
};
