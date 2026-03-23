<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Tag Model
 *
 * Pre-defined labels customers can tap when giving feedback.
 * Displayed as large touch-friendly chip buttons in the feedback UI.
 *
 * Tag scope:
 *   branch_id = NULL → Global tag (shown at ALL branches)
 *   branch_id = set  → Branch-specific tag (shown only at that branch)
 *
 * Sentiment levels (5-point scale for sentiment analysis):
 *   very_positive  → level 5 (score: +2)
 *   positive       → level 4 (score: +1)
 *   neutral        → level 3 (score: 0)
 *   negative       → level 2 (score: -1)
 *   very_negative  → level 1 (score: -2)
 *
 * @property int         $id
 * @property int|null    $branch_id
 * @property string      $name          English label
 * @property string|null $name_kh       Khmer label (multi-language)
 * @property string      $color         hex color for chip UI
 * @property string|null $icon          lucide-react icon name
 * @property string      $sentiment     very_positive|positive|neutral|negative|very_negative
 * @property int         $sort_order
 * @property bool        $is_active
 * @property Carbon      $created_at
 * @property Carbon      $updated_at
 * @property Carbon|null $deleted_at
 */
class Tag extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'branch_id',
        'name',
        'name_kh',
        'color',
        'icon',
        'sentiment',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    // ─── Relationships ────────────────────────────────────────────────────────

    /**
     * The branch this tag belongs to.
     * NULL means this is a global tag shown at all branches.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * All feedback records that have this tag applied.
     * Used for tag frequency charts in dashboards.
     */
    public function feedbacks(): BelongsToMany
    {
        return $this->belongsToMany(Feedback::class, 'feedback_tags');
    }

    // ─── Helper Methods ───────────────────────────────────────────────────────

    /**
     * Check if this is a global tag (shown at all branches).
     *
     * Usage: $tag->isGlobal()
     */
    public function isGlobal(): bool
    {
        return is_null($this->branch_id);
    }

    /**
     * Get the display name based on current language.
     * Falls back to English name if Khmer name is not set.
     *
     * @param string $lang 'en' or 'kh'
     *
     * Usage: $tag->displayName('kh')
     */
    public function displayName(string $lang = 'en'): string
    {
        if ($lang === 'kh' && $this->name_kh) {
            return $this->name_kh;
        }
        return $this->name;
    }

    /**
     * Get the sentiment score contribution of this tag.
     * Used when calculating composite sentiment score for a feedback.
     *
     *   positive → +0.2
     *   negative → -0.2
     *   neutral  →  0.0
     *
     * Usage: $tag->sentimentWeight()
     */
    public function sentimentWeight(): float
    {
        return match($this->sentiment) {
            'positive' =>  0.2,
            'negative' => -0.2,
            default    =>  0.0,
        };
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Scope to only active tags.
     * Usage: Tag::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to global tags only (branch_id IS NULL).
     * Usage: Tag::global()->get()
     */
    public function scopeGlobal($query)
    {
        return $query->whereNull('branch_id');
    }

    /**
     * Scope to tags available for a specific branch.
     * Returns BOTH global tags AND branch-specific tags.
     *
     * Usage: Tag::availableForBranch($branchId)->get()
     */
    public function scopeAvailableForBranch($query, int $branchId)
    {
        return $query->where(function ($q) use ($branchId) {
            $q->whereNull('branch_id')           // global tags
                ->orWhere('branch_id', $branchId); // branch-specific tags
        });
    }

    /**
     * Scope ordered by sort_order then name.
     * Usage: Tag::ordered()->get()
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }
}