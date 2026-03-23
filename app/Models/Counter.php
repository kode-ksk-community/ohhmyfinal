<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

/**
 * Counter Model
 *
 * Represents a physical service counter (tablet or PC) at a branch.
 *
 * Device login flow:
 *   1. Device visits app URL
 *   2. Selects branch → selects counter → enters PIN
 *   3. A device_token is issued and stored in device localStorage
 *   4. Counter sits on idle screen, polling for an active session
 *
 * @property int         $id
 * @property int         $branch_id
 * @property string      $name           e.g. "Counter 1", "Window A"
 * @property string      $pin            bcrypt hashed
 * @property string|null $device_token   unique token per physical device
 * @property bool        $is_active
 * @property string|null $description
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 * @property Carbon|null $deleted_at
 */
class Counter extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'branch_id',
        'name',
        'pin',
        'device_token',
        'is_active',
        'description',
    ];

    protected $hidden = [
        'pin', // Never expose the hashed PIN in API responses
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * The branch this counter belongs to.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * All sessions (shifts) that have ever happened on this counter.
     * Used for historical reporting: "Counter 1 had 3 servicers today"
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(CounterSession::class);
    }

    /**
     * The currently active session on this counter.
     * NULL → counter is idle, waiting for a servicer to scan QR
     * NOT NULL → a servicer is currently active, counter shows feedback form
     *
     * This is the key relationship polled by the counter device every 3–5 seconds.
     */
    public function activeSession(): HasOne
    {
        return $this->hasOne(CounterSession::class)
            ->whereNull('ended_at')
            ->latest('started_at');
    }

    /**
     * All feedback submitted at this counter.
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(Feedback::class);
    }

    // ─── Helper Methods ───────────────────────────────────────────────────────

    /**
     * Check if this counter currently has an active servicer session.
     * Used when a new servicer tries to scan — if true, reject with error.
     *
     * Usage: $counter->isOccupied()
     */
    public function isOccupied(): bool
    {
        return $this->sessions()
            ->whereNull('ended_at')
            ->exists();
    }

    /**
     * Check if this counter is idle (no active session).
     * Used to populate the "available counters" list when a servicer is rejected.
     *
     * Usage: $counter->isIdle()
     */
    public function isIdle(): bool
    {
        return !$this->isOccupied();
    }

    /**
     * Get the servicer currently active on this counter.
     * Returns null if counter is idle.
     *
     * Usage: $counter->currentServicer()
     */
    public function currentServicer(): ?User
    {
        return $this->activeSession?->servicer;
    }

    /**
     * Get or generate a device token for this counter.
     * If a token already exists, returns it without regenerating.
     * Only generates a new token on first call or if explicitly changed by admin.
     *
     * Called when a device successfully logs in with the correct PIN.
     * The token is returned once and stored in the device's localStorage.
     *
     * Usage: $token = $counter->issueDeviceToken()
     */
    public function issueDeviceToken(): string
    {
        // If token already exists, return it (don't regenerate)
        if ($this->device_token) {
            return $this->device_token;
        }

        // Only generate if token doesn't exist
        $token = Str::random(64);
        $this->update(['device_token' => $token]);
        return $token;
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope to only active counters.
     * Usage: Counter::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to counters that are currently idle (no active session).
     * Used to show available counters when a servicer is rejected.
     *
     * Usage: Counter::idle()->where('branch_id', $id)->get()
     */
    public function scopeIdle($query)
    {
        return $query->whereDoesntHave('sessions', function ($q) {
            $q->whereNull('ended_at');
        });
    }

    /**
     * Scope to counters that are currently occupied (have active session).
     * Usage: Counter::occupied()->get()
     */
    public function scopeOccupied($query)
    {
        return $query->whereHas('sessions', function ($q) {
            $q->whereNull('ended_at');
        });
    }
}
