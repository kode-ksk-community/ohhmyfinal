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
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();        // e.g. "app_name", "logo_path"
            $table->text('value')->nullable();      // the setting value
            $table->string('label')->nullable();    // human-readable label for UI
            $table->string('group')->default('general'); // groups: branding, locale, features
            $table->string('type')->default('text'); // text | image | boolean | select
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
