<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * User Model
 *
 * Covers all authenticated roles:
 *   super_admin    → full system control
 *   admin          → manages branches, counters, tags, users
 *   branch_manager → manages servicers in their branch, views reports
 *   servicer       → activates counters, receives feedback
 *
 * Customers are NOT users — they are anonymous guests.
 *
 * @property int         $id
 * @property int|null    $branch_id
 * @property string      $name
 * @property string      $email
 * @property string      $password
 * @property string      $role        super_admin|admin|branch_manager|servicer
 * @property string|null $avatar
 * @property string      $language    en|kh
 * @property bool        $is_active
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 * @property Carbon|null $deleted_at
 */
class User extends Authenticatable
{
    use HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'branch_id',
        'name',
        'email',
        'password',
        'role',
        'avatar',
        'language',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'is_active'         => 'boolean',
        'email_verified_at' => 'datetime',
        'password'          => 'hashed', // Laravel 12 auto-hashing
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * The branch this user belongs to.
     * Null for super_admin and admin (they operate globally).
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * The QR token(s) belonging to this servicer.
     * Typically one active token per servicer.
     * Admin can revoke and regenerate tokens.
     */
    public function qrTokens(): HasMany
    {
        return $this->hasMany(ServicerQrToken::class);
    }

    /**
     * The currently active QR token for this servicer.
     * Used when generating the QR code image to display/print.
     */
    public function activeQrToken(): HasOne
    {
        return $this->hasOne(ServicerQrToken::class)
            ->where('is_active', true)
            ->latest();
    }

    /**
     * All counter sessions this servicer has ever had.
     * Each session = one shift at one counter.
     */
    public function counterSessions(): HasMany
    {
        return $this->hasMany(CounterSession::class);
    }

    /**
     * The currently active counter session.
     * If not null → this servicer is currently serving at a counter.
     * If null → servicer is not currently active on any counter.
     */
    public function activeSession(): HasOne
    {
        return $this->hasOne(CounterSession::class)
            ->whereNull('ended_at');
    }

    /**
     * All feedback this servicer has received.
     * Uses the denormalized servicer_id FK on feedbacks for performance.
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(Feedback::class, 'servicer_id');
    }

    // ─── Role Helper Methods ──────────────────────────────────────────────────

    /**
     * Check if user is a Super Admin.
     * Super Admin has full system control including settings.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    /**
     * Check if user is an Admin.
     * Admin manages branches, counters, tags, users.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Check if user is a Branch Manager.
     * Branch Manager manages servicers and views reports for their branch.
     */
    public function isBranchManager(): bool
    {
        return $this->role === 'branch_manager';
    }

    /**
     * Check if user is a Servicer (staff).
     * Servicer activates counters and receives customer feedback.
     */
    public function isServicer(): bool
    {
        return $this->role === 'servicer';
    }

    /**
     * Check if user has admin-level access (super_admin OR admin).
     * Used for routes that both roles can access.
     */
    public function hasAdminAccess(): bool
    {
        return in_array($this->role, ['super_admin', 'admin']);
    }

    /**
     * Check if user has management-level access (super_admin, admin, OR branch_manager).
     * Used for dashboard/report routes.
     */
    public function hasManagementAccess(): bool
    {
        return in_array($this->role, ['super_admin', 'admin', 'branch_manager']);
    }

    /**
     * Check if this servicer is currently active on a counter.
     * Returns true if they have a session with ended_at = null.
     */
    public function isCurrentlyActive(): bool
    {
        return $this->counterSessions()
            ->whereNull('ended_at')
            ->exists();
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope to only active users.
     * Usage: User::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to only servicers.
     * Usage: User::servicers()->where('branch_id', $id)->get()
     */
    public function scopeServicers($query)
    {
        return $query->where('role', 'servicer');
    }

    /**
     * Scope to only users in a specific branch.
     * Usage: User::inBranch($branchId)->get()
     */
    public function scopeInBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    // ─── Accessors ────────────────────────────────────────────────────────────

    /**
     * Get the avatar URL.
     * Returns a default avatar URL if no avatar is set.
     */
    public function getAvatarUrlAttribute(): string
    {
        if ($this->avatar) {
            return asset('storage/' . $this->avatar);
        }

        // Default: generate initials-based avatar URL (can use UI Avatars service)
        return 'https://ui-avatars.com/api/?name=' . urlencode($this->name) . '&background=6366f1&color=fff';
    }
}