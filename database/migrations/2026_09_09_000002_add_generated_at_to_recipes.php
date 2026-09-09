<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mark the recipes FridgeMama wrote itself.
 *
 * A composed recipe is a real row in the same table as a seeded one — it has
 * to be, or none of the machinery downstream works: the suggestion engine
 * scores it, the reveal opens it, cooking it takes the ingredients back off
 * the shelf. The only thing that distinguishes it is where it came from, and
 * that is worth saying honestly on the card rather than passing a generated
 * dish off as one somebody wrote.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->timestamp('generated_at')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('generated_at');
        });
    }
};
