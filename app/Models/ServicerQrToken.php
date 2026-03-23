<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * ServicerQrToken Model
 *
 * Each servicer has a personal QR token used to activate a counter.
 *
 * The QR code encodes a URL like:
 *   https://app.domain.com/counter/activate?token=<token>
 *
 * When the servicer scans this QR with their phone:
 *   1. Their phone opens the URL
 *   2. The system validates the token
 *   3. If the token is valid + counter is idle → session is created
 *   4. If counter is occupied → return error + list of idle counters
 *
 * @property int         $id
 * @property int         $user_id
 * @property string      $token       64-char random secure string
 * @property bool        $is_active   false = revoked by admin
 * @property Carbon|null $expires_at  null = never expires
 * @property Carbon|null $last_used_at
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 */
class ServicerQrToken extends Model
{
    protected $fillable = [
        'user_id',
        'token',
        'is_active',
        'expires_at',
        'last_used_at',
    ];

    protected $casts = [
        'is_active'    => 'boolean',
        'expires_at'   => 'datetime',
        'last_used_at' => 'datetime',
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * The servicer who owns this QR token.
     */
    public function servicer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ─── Helper Methods ───────────────────────────────────────────────────────

    /**
     * Check if this token is currently valid.
     * A token is valid if:
     *   - is_active = true (not revoked)
     *   - expires_at is null OR expires_at is in the future
     *
     * Usage: $token->isValid()
     */
    public function isValid(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        return true;
    }

    /**
     * Mark this token as last used right now.
     * Called every time a servicer scans this QR code.
     * Used for audit logs and detecting unused/lost tokens.
     *
     * Usage: $token->markAsUsed()
     */
    public function markAsUsed(): void
    {
        $this->update(['last_used_at' => now()]);
    }

    /**
     * Revoke this token (admin action when servicer loses their QR card).
     * Usage: $token->revoke()
     */
    public function revoke(): void
    {
        $this->update(['is_active' => false]);
    }

    /**
     * Generate a new token string and save it.
     * Used when regenerating a lost QR token.
     * Usage: $token->regenerate()
     */
    public function regenerate(): string
    {
        $newToken = Str::random(64);
        $this->update([
            'token'     => $newToken,
            'is_active' => true,
        ]);
        return $newToken;
    }

    /**
     * Get the full QR activation URL for this token.
     * This URL is what gets encoded into the QR code image.
     *
     * Usage: $token->activationUrl()
     * Returns: "https://app.domain.com/counter/activate?token=abc123..."
     */
    public function activationUrl(): string
    {
        return url('/counter/activate') . '?token=' . $this->token;
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope to only valid (active + not expired) tokens.
     * Usage: ServicerQrToken::valid()->where('user_id', $id)->first()
     */
    public function scopeValid($query)
    {
        return $query->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            });
    }
}