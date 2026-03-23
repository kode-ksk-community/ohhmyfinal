<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Branch Model
 *
 * Represents a physical business location.
 * All counters, users (managers/servicers), tags, and feedback
 * are scoped to a branch.
 *
 * @property int         $id
 * @property string      $name
 * @property string|null $address
 * @property string|null $phone
 * @property bool        $is_active
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 * @property Carbon|null $deleted_at
 */
class Branch extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'address',
        'phone',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * All users (managers + servicers) belonging to this branch.
     * Super admins and admins have no branch (branch_id = null).
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Only the servicers (staff) in this branch.
     * Useful for counter activation — only branch servicers can activate branch counters.
     */
    public function servicers(): HasMany
    {
        return $this->hasMany(User::class)->where('role', 'servicer');
    }

    /**
     * Only the branch managers in this branch.
     */
    public function managers(): HasMany
    {
        return $this->hasMany(User::class)->where('role', 'branch_manager');
    }

    /**
     * All physical counters (devices) at this branch.
     */
    public function counters(): HasMany
    {
        return $this->hasMany(Counter::class);
    }

    /**
     * Only active counters at this branch.
     * Used when servicer scans QR and needs to pick an available counter.
     */
    public function activeCounters(): HasMany
    {
        return $this->hasMany(Counter::class)->where('is_active', true);
    }

    /**
     * Tags that belong specifically to this branch.
     * (Global tags have branch_id = null and are loaded separately.)
     */
    public function tags(): HasMany
    {
        return $this->hasMany(Tag::class);
    }

    /**
     * All feedback submitted at this branch (denormalized FK).
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(Feedback::class);
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope to only active branches.
     * Usage: Branch::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}