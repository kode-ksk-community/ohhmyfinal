<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First drop the emoji_levels column if it exists
        Schema::table('tags', function (Blueprint $table) {
            if (Schema::hasColumn('tags', 'emoji_levels')) {
                $table->dropColumn('emoji_levels');
            }
        });

        // Modify sentiment to support 5 levels
        Schema::table('tags', function (Blueprint $table) {
            // Drop the old enum constraint and recreate with 5 values
            $table->dropColumn('sentiment');
        });

        Schema::table('tags', function (Blueprint $table) {
            $table->enum('sentiment', [
                'very_positive',
                'positive',
                'neutral',
                'negative',
                'very_negative',
            ])->default('neutral')->after('icon');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tags', function (Blueprint $table) {
            $table->dropColumn('sentiment');
        });

        Schema::table('tags', function (Blueprint $table) {
            $table->enum('sentiment', [
                'positive',
                'negative',
                'neutral',
            ])->default('neutral')->after('icon');
        });
    }
};
