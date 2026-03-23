<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Feedback Model
 *
 * The core model — every customer submission is stored here.
 * Customers are anonymous — no user account required.
 *
 * Rating scale:
 *   1 = Very Bad   😡
 *   2 = Bad        😞
 *   3 = Neutral    😐
 *   4 = Good       😊
 *   5 = Excellent  😍
 *
 * Sentiment score (optional feature):
 *   Composite value between -1.0 (very negative) and +1.0 (very positive)
 *   Calculated from: base rating + selected tag sentiments + comment analysis
 *
 * @property int         $id
 * @property int         $counter_id
 * @property int         $counter_session_id
 * @property int         $servicer_id         denormalized for fast queries
 * @property int         $branch_id           denormalized for fast queries
 * @property int         $rating              1–5
 * @property string|null $comment
 * @property float|null  $sentiment_score     -1.000 to +1.000
 * @property string|null $sentiment_label     very_positive|positive|neutral|negative|very_negative
 * @property string|null $submitted_ip
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 */
class Feedback extends Model
{
    protected $table = 'feedbacks';

    protected $fillable = [
        'counter_id',
        'counter_session_id',
        'servicer_id',
        'branch_id',
        'rating',
        'comment',
        'sentiment_score',
        'sentiment_label',
        'submitted_ip',
    ];

    protected $casts = [
        'rating'          => 'integer',
        'sentiment_score' => 'float',
    ];

    // ─── Rating Constants ─────────────────────────────────────────────────────

    const RATING_VERY_BAD  = 1;
    const RATING_BAD       = 2;
    const RATING_NEUTRAL   = 3;
    const RATING_GOOD      = 4;
    const RATING_EXCELLENT = 5;

    /**
     * Human-readable rating labels.
     * Used in reports and export headers.
     */
    public static array $ratingLabels = [
        1 => 'Very Bad',
        2 => 'Bad',
        3 => 'Neutral',
        4 => 'Good',
        5 => 'Excellent',
    ];

    /**
     * Emoji for each rating level.
     * Used in the customer feedback UI and dashboard displays.
     */
    public static array $ratingEmojis = [
        1 => '😡',
        2 => '😞',
        3 => '😐',
        4 => '😊',
        5 => '😍',
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * The counter device where feedback was submitted.
     */
    public function counter(): BelongsTo
    {
        return $this->belongsTo(Counter::class);
    }

    /**
     * The counter session active when feedback was submitted.
     * Used to determine which servicer received the feedback.
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(CounterSession::class, 'counter_session_id');
    }

    /**
     * The servicer who received this feedback (denormalized FK).
     * Faster than joining through counter_sessions for dashboard queries.
     */
    public function servicer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'servicer_id');
    }

    /**
     * The branch where feedback was submitted (denormalized FK).
     * Enables fast branch-level filtering in dashboard queries.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Tags selected by the customer (many-to-many via feedback_tags pivot).
     * A feedback can have 0 or more tags.
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'feedback_tags');
    }

    // ─── Accessors ────────────────────────────────────────────────────────────

    /**
     * Get the human-readable label for the rating.
     * Usage: $feedback->ratingLabel → "Excellent"
     */
    public function getRatingLabelAttribute(): string
    {
        return static::$ratingLabels[$this->rating] ?? 'Unknown';
    }

    /**
     * Get the emoji for the rating.
     * Usage: $feedback->ratingEmoji → "😍"
     */
    public function getRatingEmojiAttribute(): string
    {
        return static::$ratingEmojis[$this->rating] ?? '❓';
    }

    /**
     * Check if this is a positive feedback (rating >= 4).
     * Usage: $feedback->isPositive()
     */
    public function isPositive(): bool
    {
        return $this->rating >= 4;
    }

    /**
     * Check if this is a negative feedback (rating <= 2).
     * Usage: $feedback->isNegative()
     */
    public function isNegative(): bool
    {
        return $this->rating <= 2;
    }

    // ─── Sentiment Analysis ───────────────────────────────────────────────────

    /**
     * Calculate and store the composite sentiment score.
     *
     * Score components:
     *   1. Base score from rating (mapped -1.0 to +1.0):
     *      1 → -1.0, 2 → -0.5, 3 → 0.0, 4 → +0.5, 5 → +1.0
     *
     *   2. Tag contribution:
     *      Each positive tag adds +0.2, each negative tag subtracts -0.2
     *      Capped so tags can't flip the overall direction entirely
     *
     *   3. Final score is clamped between -1.0 and +1.0
     *
     * Usage: $feedback->calculateSentiment()
     */
    public function calculateSentiment(): void
    {
        // Step 1: Base score from rating
        $baseScores = [
            1 => -1.0,
            2 => -0.5,
            3 =>  0.0,
            4 =>  0.5,
            5 =>  1.0,
        ];
        $score = $baseScores[$this->rating] ?? 0.0;

        // Step 2: Add tag sentiment contributions
        if ($this->relationLoaded('tags')) {
            $tagScore = $this->tags->sum(fn(Tag $tag) => $tag->sentimentWeight());
            // Cap tag contribution to ±0.4 so tags can't fully override the rating
            $tagScore = max(-0.4, min(0.4, $tagScore));
            $score += $tagScore;
        }

        // Step 3: Clamp final score to [-1.0, +1.0]
        $score = max(-1.0, min(1.0, $score));

        // Step 4: Derive label from score
        $label = match (true) {
            $score >= 0.6  => 'very_positive',
            $score >= 0.2  => 'positive',
            $score >= -0.2 => 'neutral',
            $score >= -0.6 => 'negative',
            default        => 'very_negative',
        };

        $this->update([
            'sentiment_score' => round($score, 3),
            'sentiment_label' => $label,
        ]);
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope by date range.
     * Usage: Feedback::dateRange('2024-01-01', '2024-01-31')->get()
     */
    public function scopeDateRange($query, string $from, string $to)
    {
        return $query->whereBetween('created_at', [$from, $to . ' 23:59:59']);
    }

    /**
     * Scope to today's feedback only.
     * Usage: Feedback::today()->count()
     */
    public function scopeToday($query)
    {
        return $query->whereDate('created_at', today());
    }

    /**
     * Scope to a specific rating level.
     * Usage: Feedback::withRating(5)->count()
     */
    public function scopeWithRating($query, int $rating)
    {
        return $query->where('rating', $rating);
    }

    /**
     * Scope to positive feedback (rating >= 4).
     * Usage: Feedback::positive()->count()
     */
    public function scopePositive($query)
    {
        return $query->where('rating', '>=', 4);
    }

    /**
     * Scope to negative feedback (rating <= 2).
     * Usage: Feedback::negative()->count()
     */
    public function scopeNegative($query)
    {
        return $query->where('rating', '<=', 2);
    }
}
