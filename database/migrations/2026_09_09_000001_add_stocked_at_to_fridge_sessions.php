<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Record whether a fridge has ever been stocked with the demo contents.
 *
 * It used to be inferred from `wasRecentlyCreated` on the session row, which
 * is only true on the single request that created it. That held exactly as
 * long as `GET /fridge` was the first call any client made. The Android app
 * checks the connection first — it asks the detector whether it is alive
 * before it saves the laptop's address — and that call creates the session, so
 * by the time the fridge is fetched it is no longer new and nothing stocks.
 * The app opens on an empty shelf, which is the one screen that teaches a
 * judge nothing.
 *
 * A column is the honest fix. "Has this been stocked" is a fact about the
 * fridge, not a side effect of which endpoint happened to be called first, and
 * unlike counting the items it does not re-stock a fridge somebody emptied on
 * purpose.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fridge_sessions', function (Blueprint $table) {
            $table->timestamp('stocked_at')->nullable()->after('day_offset');
        });

        // Every fridge that already exists has been through the old path, so
        // it is stocked as far as anyone is concerned. Backfilling stops this
        // migration re-stocking a fridge mid-rehearsal.
        \App\Models\FridgeSession::whereNull('stocked_at')->update(['stocked_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('fridge_sessions', function (Blueprint $table) {
            $table->dropColumn('stocked_at');
        });
    }
};
