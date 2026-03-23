<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tags', function (Blueprint $table) {
            // Store 5 emoji levels as JSON array: ["😊", "😐", "😕", "😢", "😭"]
            $table->json('emoji_levels')->nullable()->after('icon');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Schema::table('tags', function (Blueprint $table) {
        //     $table->dropColumn('emoji_levels');
        // });
    }
};
