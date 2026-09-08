<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Single-session fridge, no accounts.
 *
 * The proposal is explicit: "no real cloud backend or user accounts —
 * single-session, local state only". A fridge now belongs to a session id the
 * browser generates and keeps in localStorage, not to a user row. Nobody
 * should have to sign in during a ninety-second demo.
 *
 * `day_offset` is the fast-forward clock. Every expiry calculation reads
 * "today" through it, so one button press makes the whole app behave as though
 * a day has passed — countdown bars move, items cross into red, the
 * notification fires. Waiting a real day for that is not a demo.
 *
 * `waste_events` is the food-waste-saved counter: one row per ingredient
 * either used in time or lost. The tally has to survive a page reload, which
 * rules out keeping it in component state.
 *
 * `pantry_items` is rebuilt rather than altered, because SQLite cannot drop the
 * old user_id foreign key in place. Nothing is copied across: rows keyed to a
 * user have no session to belong to, and the fridge is seeded on every setup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fridge_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->unique();
            $table->unsignedSmallInteger('day_offset')->default(0);
            $table->timestamps();
        });

        Schema::create('waste_events', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->index();
            $table->string('ingredient_name');
            // 'rescued' — used before it went off. 'lost' — binned after.
            $table->string('kind', 12);
            $table->integer('days_left')->nullable();
            $table->timestamps();
        });

        Schema::dropIfExists('pantry_items');

        Schema::create('pantry_items', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->index();
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity', 8, 2)->nullable();
            $table->string('unit')->nullable();
            $table->date('expires_on')->nullable();
            $table->boolean('expiry_estimated')->default(false);
            // Where the item came from: 'scan', 'manual' or 'seed'.
            $table->string('source', 20)->default('manual');
            $table->string('detected_as')->nullable();
            $table->decimal('confidence', 5, 4)->nullable();
            $table->timestamps();

            $table->foreign('ingredient_id')->references('id')->on('ingredients')->cascadeOnDelete();
            $table->unique(['session_id', 'ingredient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_events');
        Schema::dropIfExists('fridge_sessions');
        Schema::dropIfExists('pantry_items');

        Schema::create('pantry_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity', 8, 2)->nullable();
            $table->string('unit')->nullable();
            $table->date('expires_on')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->cascadeOnDelete();
            $table->unique(['user_id', 'ingredient_id']);
        });
    }
};
