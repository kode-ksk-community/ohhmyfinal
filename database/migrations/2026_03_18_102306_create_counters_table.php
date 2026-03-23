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
        Schema::create('counters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('name');                          // e.g. "Counter 1", "Window A"
            $table->string('pin');                           // bcrypt hashed 4–6 digit PIN
            $table->string('device_token')->nullable()->unique(); // identifies the physical device
            $table->boolean('is_active')->default(true);
            $table->string('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['branch_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('counters');
    }
};
