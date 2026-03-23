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
        Schema::create('servicer_qr_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('token', 64)->unique();           // random 64-char secure token
            $table->boolean('is_active')->default(true);     // revokable by admin
            $table->timestamp('expires_at')->nullable();     // null = never expires
            $table->timestamp('last_used_at')->nullable();   // audit: last scan time
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('servicer_qr_tokens');
    }
};
