<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where did this fridge item come from — typed in, or seen by the camera?
 *
 * Worth storing rather than inferring: the pantry UI marks scanned items so a
 * cook can tell at a glance what the model put there, and `detected_as` keeps
 * the raw detector label for when a mapping looks wrong and someone has to
 * work out why "carton of milk" landed on the wrong row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pantry_items', function (Blueprint $table) {
            $table->string('source', 20)->default('manual')->after('unit');
            $table->string('detected_as')->nullable()->after('source');
            $table->decimal('confidence', 5, 4)->nullable()->after('detected_as');
        });
    }

    public function down(): void
    {
        Schema::table('pantry_items', function (Blueprint $table) {
            $table->dropColumn(['source', 'detected_as', 'confidence']);
        });
    }
};
