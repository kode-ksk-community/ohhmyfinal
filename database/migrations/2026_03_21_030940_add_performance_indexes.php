<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add critical performance indexes for the feedback system.
     */
    public function up(): void
    {
        // Counter Sessions - Critical for real-time polling
        Schema::table('counter_sessions', function (Blueprint $table) {
            // Index for active session queries (polled every 4 seconds)
            $table->index(['counter_id', 'ended_at', 'started_at'], 'idx_counter_sessions_active');

            // Index for user session history
            $table->index(['user_id', 'ended_at'], 'idx_counter_sessions_user_active');

            // Index for session duration calculations
            $table->index(['started_at', 'ended_at'], 'idx_counter_sessions_duration');
        });

        // Counters - Critical for device authentication and branch filtering
        Schema::table('counters', function (Blueprint $table) {
            // Index for active counters in branch
            $table->index(['branch_id', 'is_active'], 'idx_counters_branch_active');

            // Index for device token lookups (frequent)
            $table->index('device_token', 'idx_counters_device_token');
        });

        // Feedback - Critical for admin dashboard and analytics
        Schema::table('feedbacks', function (Blueprint $table) {
            // Composite index for session-based feedback queries
            $table->index(['counter_session_id', 'rating'], 'idx_feedbacks_session_rating');

            // Index for date range queries with branch filtering
            $table->index(['created_at', 'branch_id', 'rating'], 'idx_feedbacks_date_range');

            // Index for servicer performance queries
            $table->index(['servicer_id', 'created_at'], 'idx_feedbacks_servicer_date');

            // Index for counter performance queries
            $table->index(['counter_id', 'created_at'], 'idx_feedbacks_counter_date');
        });

        // Tags - Critical for feedback form loading
        Schema::table('tags', function (Blueprint $table) {
            // Index for active tags by branch (loaded on feedback form)
            $table->index(['branch_id', 'is_active', 'sort_order'], 'idx_tags_branch_active_sort');

            // Index for global tags fallback
            $table->index(['is_active', 'sort_order'], 'idx_tags_global_active_sort');
        });

        // Users - Critical for authentication and role filtering
        Schema::table('users', function (Blueprint $table) {
            // Index for servicer authentication by branch
            $table->index(['email', 'branch_id', 'role', 'is_active'], 'idx_users_auth_branch');

            // Index for role-based queries
            $table->index(['role', 'is_active'], 'idx_users_role_active');
        });

        // Branches - Critical for counter setup
        Schema::table('branches', function (Blueprint $table) {
            // Index for active branches (loaded on setup page)
            $table->index('is_active', 'idx_branches_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop all added indexes
        Schema::table('counter_sessions', function (Blueprint $table) {
            $table->dropIndex('idx_counter_sessions_active');
            $table->dropIndex('idx_counter_sessions_user_active');
            $table->dropIndex('idx_counter_sessions_duration');
        });

        Schema::table('counters', function (Blueprint $table) {
            $table->dropIndex('idx_counters_branch_active');
            $table->dropIndex('idx_counters_device_token');
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropIndex('idx_feedbacks_session_rating');
            $table->dropIndex('idx_feedbacks_date_range');
            $table->dropIndex('idx_feedbacks_servicer_date');
            $table->dropIndex('idx_feedbacks_counter_date');
        });

        Schema::table('tags', function (Blueprint $table) {
            $table->dropIndex('idx_tags_branch_active_sort');
            $table->dropIndex('idx_tags_global_active_sort');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_auth_branch');
            $table->dropIndex('idx_users_role_active');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->dropIndex('idx_branches_active');
        });
    }
};
