<?php

namespace App\Http\Controllers;

use App\Models\Feedback;
use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    /**
     * Display admin feedback page with filtering and search.
     * Optimized with eager loading to prevent N+1 queries.
     */
    public function index(): Response
    {
        $feedbacks = Feedback::with([
            'counter:id,name,branch_id',
            'counter.branch:id,name',
            'servicer:id,name',
            'tags:id,name'
        ])
            ->select([
                'id',
                'counter_id',
                'counter_session_id',
                'servicer_id',
                'branch_id',
                'rating',
                'sentiment_label',
                'sentiment_score',
                'comment',
                'created_at'
            ])
            ->orderBy('created_at', 'desc')
            ->paginate(50)
            ->through(function ($feedback) {
                return [
                    'id' => $feedback->id,
                    'rating' => $feedback->rating,
                    'sentiment_label' => $feedback->sentiment_label,
                    'sentiment_score' => $feedback->sentiment_score,
                    'comment' => $feedback->comment,
                    'counter_name' => $feedback->counter->name,
                    'branch_name' => $feedback->counter->branch->name,
                    'servicer_name' => $feedback->servicer?->name ?? 'Unknown',
                    'tags' => $feedback->tags->pluck('name')->toArray(),
                    'submitted_at' => $feedback->created_at->format('Y-m-d H:i'),
                ];
            });

        return Inertia::render('admin/feedback', [
            'feedbacks' => $feedbacks,
        ]);
    }

    /**
     * Get feedback data for display on counter device.
     * Called by CounterFeedback.tsx on mount.
     */
    public function data(Request $request): JsonResponse
    {
        // Get counter from middleware attribute; not from request input
        $counter = $request->attributes->get('counter');
        if (!$counter instanceof \App\Models\Counter) {
            return response()->json(['error' => 'Invalid or missing counter token'], 401);
        }

        $session = $counter->activeSession()->with('servicer')->first();

        if (!$session) {
            return response()->json(['error' => 'No active session'], 404);
        }

        $servicer = $session->servicer;
        if (!$servicer) {
            return response()->json(['error' => 'Active session has no servicer attached'], 500);
        }

        // Get tags for this branch (or global tags)
        $tags = Tag::where(function ($query) use ($counter) {
            $query->where('branch_id', $counter->branch_id)
                ->orWhereNull('branch_id');
        })
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->select('id', 'name', 'color', 'sentiment')
            ->get();

        return response()->json([
            'servicer' => [
                'id' => $servicer->id,
                'name' => $servicer->name,
                'avatar_url' => $servicer->avatar,
            ],
            'tags' => $tags,
        ]);
    }

    /**
     * Store a customer feedback submission.
     * Called by CounterFeedback.tsx step 3 (submit button).
     * Anonymous submission — no authentication required.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $counter = $request->attributes->get('counter');
            if (!$counter instanceof \App\Models\Counter) {
                \Log::warning('Invalid or missing counter in feedback store', [
                    'counter' => $counter,
                    'type' => gettype($counter),
                ]);
                return response()->json(['error' => 'Invalid or missing counter token'], 401);
            }

            $session = $counter->activeSession()->with('servicer')->first();
            if (!$session) {
                \Log::warning('No active session for counter in feedback store', [
                    'counter_id' => $counter->id,
                ]);
                return response()->json(['error' => 'No active session'], 404);
            }

            if (!$session->servicer) {
                \Log::warning('Active session has no servicer in feedback store', [
                    'session_id' => $session->id,
                    'servicer_id' => $session->servicer_id,
                ]);
                return response()->json(['error' => 'Active session has no servicer attached'], 500);
            }

            $validated = $request->validate([
                'rating' => 'required|integer|min:1|max:5',
                'tag_ids' => 'nullable|array',
                'tag_ids.*' => 'integer|exists:tags,id',
                'comment' => 'nullable|string|max:1000',
            ]);

            $feedback = Feedback::create([
                'counter_id' => $counter->id,
                'counter_session_id' => $session->id,
                'servicer_id' => $session->servicer->id,
                'branch_id' => $counter->branch_id,
                'rating' => $validated['rating'],
                'comment' => $validated['comment'] ?? null,
                'submitted_ip' => $request->ip(),
                'sentiment_score' => $this->calculateSentimentScore(
                    $validated['rating'],
                    $validated['tag_ids'] ?? []
                ),
            ]);

            // Attach tags
            if (!empty($validated['tag_ids'])) {
                $feedback->tags()->attach($validated['tag_ids']);

                // Set sentiment label based on tags
                $feedback->sentiment_label = $this->determineSentimentLabel($feedback);
                $feedback->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'Thank you for your feedback!',
                'feedback_id' => $feedback->id,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::warning('Validation error in feedback store', $e->errors());
            throw $e; // Re-throw to let Laravel handle it
        } catch (\Exception $e) {
            \Log::error('Exception in feedback store', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to submit feedback: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get feedback analytics for reports.
     */
    public function analytics(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date', now()->subDays(30));
        $endDate = $request->query('end_date', now());
        $branchId = $request->query('branch_id');
        $servicerId = $request->query('servicer_id');

        $query = Feedback::whereBetween('created_at', [$startDate, $endDate]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($servicerId) {
            $query->where('servicer_id', $servicerId);
        }

        $totalFeedback = $query->count();
        $averageRating = $query->avg('rating') ?? 0;

        $ratingDistribution = $query->selectRaw('rating, COUNT(*) as count')
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->toArray();

        $sentimentDistribution = $query->selectRaw('sentiment_label, COUNT(*) as count')
            ->groupBy('sentiment_label')
            ->pluck('count', 'sentiment_label')
            ->toArray();

        return response()->json([
            'total_feedback' => $totalFeedback,
            'average_rating' => round($averageRating, 2),
            'rating_distribution' => $ratingDistribution,
            'sentiment_distribution' => $sentimentDistribution,
        ]);
    }

    /**
     * Get top tags by usage.
     */
    public function topTags(Request $request): JsonResponse
    {
        $limit = $request->query('limit', 10);
        $startDate = $request->query('start_date', now()->subDays(30));
        $endDate = $request->query('end_date', now());

        $topTags = Tag::whereHas('feedbacks', function ($query) use ($startDate, $endDate) {
            $query->whereBetween('feedbacks.created_at', [$startDate, $endDate]);
        })
            ->withCount('feedbacks')
            ->orderByDesc('feedbacks_count')
            ->limit($limit)
            ->get(['id', 'name', 'color'])
            ->map(function ($tag) {
                return [
                    'id' => $tag->id,
                    'name' => $tag->name,
                    'color' => $tag->color,
                    'count' => $tag->feedbacks_count,
                ];
            });

        return response()->json(['tags' => $topTags]);
    }

    /**
     * Delete feedback (admin only).
     */
    public function destroy(Feedback $feedback): JsonResponse
    {
        $feedback->forceDelete();

        return response()->json(['message' => 'Feedback deleted successfully']);
    }

    // ─── Helper Methods ──────────────────────────────────────────────────────

    /**
     * Calculate sentiment score based on rating and tags.
     * Returns value between -1.0 and +1.0
     */
    private function calculateSentimentScore(int $rating, array $tagIds = []): float
    {
        // Base score from rating (1-5 → -1.0 to +1.0)
        $ratingScore = ($rating - 3) / 2;

        // Get tag sentiment modifiers
        $tagScore = 0;
        if (!empty($tagIds)) {
            $tags = Tag::whereIn('id', $tagIds)->get();
            foreach ($tags as $tag) {
                $tagScore += match ($tag->sentiment) {
                    'very_positive' => 0.4,
                    'positive' => 0.2,
                    'neutral' => 0,
                    'negative' => -0.2,
                    'very_negative' => -0.4,
                    default => 0,
                };
            }
            // Average tag scores
            $tagScore = $tagScore / count($tags);
        }

        // Combine scores
        $combined = ($ratingScore * 0.7) + ($tagScore * 0.3);

        // Clamp to -1.0 to +1.0
        return max(-1.0, min(1.0, $combined));
    }

    /**
     * Determine sentiment label from feedback data.
     */
    private function determineSentimentLabel(Feedback $feedback): ?string
    {
        $score = $feedback->sentiment_score ?? 0;

        return match (true) {
            $score >= 0.6 => 'very_positive',
            $score >= 0.2 => 'positive',
            $score >= -0.2 => 'neutral',
            $score >= -0.6 => 'negative',
            default => 'very_negative',
        };
    }

    /**
     * Get servicer performance metrics.
     */
    public function servicerPerformance(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date', now()->subDays(30));
        $endDate = $request->query('end_date', now());
        $branchId = $request->query('branch_id');

        $performance = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->with('servicer:id,name')
            ->selectRaw('
                servicer_id,
                COUNT(*) as total_feedbacks,
                ROUND(AVG(rating), 2) as avg_rating,
                ROUND(AVG(sentiment_score), 3) as avg_sentiment,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_feedbacks,
                COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_feedbacks
            ')
            ->groupBy('servicer_id')
            ->having('total_feedbacks', '>', 0)
            ->orderByDesc('avg_rating')
            ->get()
            ->map(function ($item) {
                $total = (int) $item->total_feedbacks;
                return [
                    'servicer_id' => $item->servicer_id,
                    'servicer_name' => $item->servicer->name,
                    'total_feedbacks' => $total,
                    'average_rating' => (float) $item->avg_rating,
                    'average_sentiment' => (float) $item->avg_sentiment,
                    'positive_percentage' => $total > 0 ? round(($item->positive_feedbacks / $total) * 100, 1) : 0,
                    'negative_percentage' => $total > 0 ? round(($item->negative_feedbacks / $total) * 100, 1) : 0,
                ];
            });

        return response()->json($performance);
    }

    /**
     * Get counter performance metrics.
     */
    public function counterPerformance(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date', now()->subDays(30));
        $endDate = $request->query('end_date', now());
        $branchId = $request->query('branch_id');

        $performance = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->with('counter:id,name')
            ->selectRaw('
                counter_id,
                COUNT(*) as total_feedbacks,
                ROUND(AVG(rating), 2) as avg_rating,
                ROUND(AVG(sentiment_score), 3) as avg_sentiment,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_feedbacks
            ')
            ->groupBy('counter_id')
            ->having('total_feedbacks', '>', 0)
            ->orderByDesc('avg_rating')
            ->get()
            ->map(function ($item) {
                $total = (int) $item->total_feedbacks;
                return [
                    'counter_id' => $item->counter_id,
                    'counter_name' => $item->counter->name,
                    'total_feedbacks' => $total,
                    'average_rating' => (float) $item->avg_rating,
                    'average_sentiment' => (float) $item->avg_sentiment,
                    'positive_percentage' => $total > 0 ? round(($item->positive_feedbacks / $total) * 100, 1) : 0,
                ];
            });

        return response()->json($performance);
    }

    /**
     * Get trend analysis over time.
     */
    public function trends(Request $request): JsonResponse
    {
        $period = $request->query('period', 'daily'); // daily, weekly, monthly
        $startDate = $request->query('start_date', now()->subDays(30));
        $endDate = $request->query('end_date', now());
        $branchId = $request->query('branch_id');

        $dateFormat = match ($period) {
            'weekly' => 'DATE_FORMAT(created_at, "%Y-%u")',
            'monthly' => 'DATE_FORMAT(created_at, "%Y-%m")',
            default => 'DATE(created_at)',
        };

        $trends = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->selectRaw("
                {$dateFormat} as period,
                COUNT(*) as total_feedbacks,
                ROUND(AVG(rating), 2) as avg_rating,
                ROUND(AVG(sentiment_score), 3) as avg_sentiment,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_count,
                COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_count
            ")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(function ($item) {
                $total = (int) $item->total_feedbacks;
                return [
                    'period' => $item->period,
                    'total_feedbacks' => $total,
                    'average_rating' => (float) $item->avg_rating,
                    'average_sentiment' => (float) $item->avg_sentiment,
                    'positive_percentage' => $total > 0 ? round(($item->positive_count / $total) * 100, 1) : 0,
                    'negative_percentage' => $total > 0 ? round(($item->negative_count / $total) * 100, 1) : 0,
                ];
            });

        return response()->json($trends);
    }
}
