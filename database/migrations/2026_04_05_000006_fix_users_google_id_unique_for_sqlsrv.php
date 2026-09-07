<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlsrv' || !Schema::hasTable('users')) {
            return;
        }

        // Check if the google_id column exists before proceeding
        if (!Schema::hasColumn('users', 'google_id')) {
            return;
        }

        DB::statement("
            IF EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'users_google_id_unique'
                  AND object_id = OBJECT_ID('users')
            )
            DROP INDEX users_google_id_unique ON users
        ");

        DB::statement('CREATE UNIQUE INDEX users_google_id_unique ON users (google_id) WHERE google_id IS NOT NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlsrv' || !Schema::hasTable('users')) {
            return;
        }

        DB::statement("
            IF EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'users_google_id_unique'
                  AND object_id = OBJECT_ID('users')
            )
            DROP INDEX users_google_id_unique ON users
        ");

        DB::statement('CREATE UNIQUE INDEX users_google_id_unique ON users (google_id)');
    }
};
