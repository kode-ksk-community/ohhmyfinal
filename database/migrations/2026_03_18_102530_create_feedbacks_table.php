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
        Schema::create('feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('counter_id')->constrained('counters')->restrictOnDelete();
            $table->foreignId('counter_session_id')->constrained('counter_sessions')->restrictOnDelete();
            $table->foreignId('servicer_id')->constrained('users')->restrictOnDelete(); // denormalized
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete(); // denormalized
            $table->unsignedTinyInteger('rating');           // 1=Very Bad, 2=Bad, 3=Neutral, 4=Good, 5=Excellent
            $table->text('comment')->nullable();
            $table->decimal('sentiment_score', 4, 3)->nullable(); // -1.000 to +1.000
            $table->enum('sentiment_label', ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'])->nullable();
            $table->string('submitted_ip')->nullable();
            $table->timestamps();

            // Indexes for fast dashboard queries
            $table->index('rating');
            $table->index('branch_id');
            $table->index('servicer_id');
            $table->index('counter_id');
            $table->index('created_at');
            $table->index(['branch_id', 'created_at']);
            $table->index(['servicer_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('feedbacks');
    }
};
