<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * CounterSession Model
 *
 * Represents one servicer's shift at one counter.
 *
 * Lifecycle:
 *   CREATED  → servicer scans their QR code on their phone
 *   ACTIVE   → ended_at IS NULL → counter shows live feedback form
 *   ENDED    → ended_at IS SET  → counter returns to idle screen
 *
 * Business rules enforced at service layer:
 *   - Only ONE active session per counter at a time
 *   - Any servicer in the same branch can activate an idle counter
 *   - Servicer B gets rejected (with idle counter list) if counter is busy
 *
 * @property int         $id
 * @property int         $counter_id
 * @property int         $user_id          the servicer
 * @property Carbon      $started_at
 * @property Carbon|null $ended_at         NULL = currently active
 * @property string|null $end_reason       logout|terminate|forced|expired
 * @property string|null $device_ip
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 */
class CounterSession extends Model
{
    protected $fillable = [
        'counter_id',
        'user_id',
        'started_at',
        'ended_at',
        'end_reason',
        'device_ip',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at'   => 'datetime',
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * The counter this session is happening on.
     */
    public function counter(): BelongsTo
    {
        return $this->belongsTo(Counter::class);
    }

    /**
     * The servicer who activated this session by scanning their QR.
     */
    public function servicer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * All feedback submitted during this session.
     * When reports filter by "session", they use this relationship.
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(Feedback::class);
    }

    // ─── Helper Methods ───────────────────────────────────────────────────────

    /**
     * Check if this session is currently active.
     * Active = ended_at is null.
     *
     * Usage: $session->isActive()
     */
    public function isActive(): bool
    {
        return is_null($this->ended_at);
    }

    /**
     * End this session with a given reason.
     * Called when servicer logs out or terminates session.
     *
     * @param string $reason logout|terminate|forced|expired
     *
     * Usage: $session->end('logout')
     */
    public function end(string $reason = 'logout'): void
    {
        $this->update([
            'ended_at'   => now(),
            'end_reason' => $reason,
        ]);
    }

    /**
     * Get how long this session lasted (in minutes).
     * If session is still active, calculates from started_at to now.
     *
     * Usage: $session->durationInMinutes()
     */
    public function durationInMinutes(): int
    {
        $end = $this->ended_at ?? now();
        return (int) $this->started_at->diffInMinutes($end);
    }

    /**
     * Get total feedback count during this session.
     * Shortcut for $session->feedbacks()->count()
     */
    public function feedbackCount(): int
    {
        return $this->feedbacks()->count();
    }

    /**
     * Get average rating during this session.
     * Returns null if no feedback was given.
     */
    public function averageRating(): ?float
    {
        return $this->feedbacks()->avg('rating');
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope to only active (ongoing) sessions.
     * Usage: CounterSession::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->whereNull('ended_at');
    }

    /**
     * Scope to only ended sessions.
     * Usage: CounterSession::ended()->get()
     */
    public function scopeEnded($query)
    {
        return $query->whereNotNull('ended_at');
    }
}