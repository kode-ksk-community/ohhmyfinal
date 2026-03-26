<?php

namespace App\Http\Controllers;

use App\Models\Feedback;
use App\Models\Tag;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    // ─── Admin Pages ──────────────────────────────────────────────────────────

    /**
     * Display admin feedback page.
     * Eagerly loads all relations to prevent N+1 queries.
     */
    public function index(): Response
    {
        $feedbacks = Feedback::with([
            'counter:id,name,branch_id',
            'counter.branch:id,name',
            'servicer:id,name',
            'tags:id,name',
        ])
            ->select(['id','counter_id','servicer_id','branch_id','rating','sentiment_label','sentiment_score','comment','created_at'])
            ->latest()
            ->paginate(50)
            ->through(fn($f) => $this->formatFeedback($f));

        return Inertia::render('admin/feedback', compact('feedbacks'));
    }

    // ─── Counter Device API ───────────────────────────────────────────────────

    /**
     * Return counter session data for the kiosk UI.
     */
    public function data(Request $request): JsonResponse
    {
        $counter = $request->attributes->get('counter');

        if (! $counter instanceof \App\Models\Counter) {
            return $this->counterError();
        }

        $session = $counter->activeSession()->with('servicer')->first();

        if (! $session) {
            return response()->json(['error' => 'No active session'], 404);
        }

        if (! $session->servicer) {
            return response()->json(['error' => 'Active session has no servicer attached'], 500);
        }

        // Cache tags per branch for 5 minutes — they rarely change
        $tags = Cache::remember("tags:branch:{$counter->branch_id}", 300, fn() =>
            Tag::where(function ($q) use ($counter) {
                $q->where('branch_id', $counter->branch_id)->orWhereNull('branch_id');
            })
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'name', 'color', 'sentiment'])
        );

        return response()->json([
            'servicer' => [
                'id'         => $session->servicer->id,
                'name'       => $session->servicer->name,
                'avatar_url' => $session->servicer->avatar,
            ],
            'tags' => $tags,
        ]);
    }

    /**
     * Store a new feedback submission from a counter kiosk.
     */
    public function store(Request $request): JsonResponse
    {
        $counter = $request->attributes->get('counter');

        if (! $counter instanceof \App\Models\Counter) {
            Log::warning('Feedback store: invalid counter token', ['type' => gettype($counter)]);
            return $this->counterError();
        }

        $session = $counter->activeSession()->with('servicer')->first();

        if (! $session) {
            Log::warning('Feedback store: no active session', ['counter_id' => $counter->id]);
            return response()->json(['error' => 'No active session'], 404);
        }

        if (! $session->servicer) {
            Log::warning('Feedback store: session has no servicer', ['session_id' => $session->id]);
            return response()->json(['error' => 'Active session has no servicer attached'], 500);
        }

        $data = $request->validate([
            'rating'     => 'required|integer|min:1|max:5',
            'tag_ids'    => 'nullable|array',
            'tag_ids.*'  => 'integer|exists:tags,id',
            'comment'    => 'nullable|string|max:1000',
        ]);

        $tagIds        = $data['tag_ids'] ?? [];
        $sentimentScore = $this->calculateSentimentScore($data['rating'], $tagIds);

        $feedback = Feedback::create([
            'counter_id'         => $counter->id,
            'counter_session_id' => $session->id,
            'servicer_id'        => $session->servicer->id,
            'branch_id'          => $counter->branch_id,
            'rating'             => $data['rating'],
            'comment'            => $data['comment'] ?? null,
            'submitted_ip'       => $request->ip(),
            'sentiment_score'    => $sentimentScore,
            'sentiment_label'    => $this->scoreToLabel($sentimentScore),
        ]);

        if (! empty($tagIds)) {
            $feedback->tags()->attach($tagIds);
        }

        return response()->json([
            'success'     => true,
            'message'     => 'Thank you for your feedback!',
            'feedback_id' => $feedback->id,
        ], 201);
    }

    // ─── Analytics API ────────────────────────────────────────────────────────

    /**
     * Aggregate analytics for a date range / branch / servicer.
     */
    public function analytics(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);
        $branchId   = $request->query('branch_id');
        $servicerId = $request->query('servicer_id');

        $query = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($branchId,   fn($q) => $q->where('branch_id', $branchId))
            ->when($servicerId, fn($q) => $q->where('servicer_id', $servicerId));

        // Run aggregates in a single query instead of three separate calls
        $stats = $query->selectRaw('
            COUNT(*) as total,
            ROUND(AVG(rating), 2) as avg_rating
        ')->first();

        $ratingDist = (clone $query)
            ->selectRaw('rating, COUNT(*) as count')
            ->groupBy('rating')
            ->pluck('count', 'rating');

        $sentimentDist = (clone $query)
            ->selectRaw('sentiment_label, COUNT(*) as count')
            ->groupBy('sentiment_label')
            ->pluck('count', 'sentiment_label');

        return response()->json([
            'total_feedback'         => (int) ($stats->total ?? 0),
            'average_rating'         => (float) ($stats->avg_rating ?? 0),
            'rating_distribution'    => $ratingDist,
            'sentiment_distribution' => $sentimentDist,
        ]);
    }

    /**
     * Top tags by usage count within a date range.
     */
    public function topTags(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);
        $limit = min((int) $request->query('limit', 10), 50); // cap to prevent abuse

        $tags = Tag::whereHas('feedbacks', fn($q) =>
            $q->whereBetween('feedbacks.created_at', [$startDate, $endDate])
        )
            ->withCount(['feedbacks as feedbacks_count' => fn($q) =>
                $q->whereBetween('feedbacks.created_at', [$startDate, $endDate])
            ])
            ->orderByDesc('feedbacks_count')
            ->limit($limit)
            ->get(['id', 'name', 'color'])
            ->map(fn($tag) => [
                'id'    => $tag->id,
                'name'  => $tag->name,
                'color' => $tag->color,
                'count' => $tag->feedbacks_count,
            ]);

        return response()->json(['tags' => $tags]);
    }

    /**
     * Delete a feedback record (hard delete).
     */
    public function destroy(Feedback $feedback): JsonResponse
    {
        $feedback->forceDelete();

        return response()->json(['message' => 'Feedback deleted successfully']);
    }

    // ─── Performance Reports ──────────────────────────────────────────────────

    /**
     * Servicer performance summary.
     */
    public function servicerPerformance(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);

        $rows = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($request->query('branch_id'),   fn($q) => $q->where('branch_id',   $request->query('branch_id')))
            ->when($request->query('servicer_id'), fn($q) => $q->where('servicer_id', $request->query('servicer_id')))
            ->with('servicer:id,name')
            ->selectRaw('
                servicer_id,
                COUNT(*) as total,
                ROUND(AVG(rating), 2) as avg_rating,
                ROUND(AVG(sentiment_score), 3) as avg_sentiment,
                SUM(rating >= 4) as positive_count,
                SUM(rating <= 2) as negative_count
            ')
            ->groupBy('servicer_id')
            ->having('total', '>', 0)
            ->orderByDesc('avg_rating')
            ->get()
            ->map(function ($row) {
                $total = (int) $row->total;
                return [
                    'servicer_id'         => $row->servicer_id,
                    'servicer_name'       => $row->servicer->name,
                    'total_feedbacks'     => $total,
                    'average_rating'      => (float) $row->avg_rating,
                    'average_sentiment'   => (float) $row->avg_sentiment,
                    'positive_percentage' => $total ? round(($row->positive_count / $total) * 100, 1) : 0,
                    'negative_percentage' => $total ? round(($row->negative_count / $total) * 100, 1) : 0,
                ];
            });

        return response()->json($rows);
    }

    /**
     * Raw feedback entries for a single servicer.
     */
    public function servicerFeedback(Request $request): JsonResponse
    {
        $servicerId = $request->query('servicer_id');
        if (! $servicerId) {
            return response()->json(['error' => 'servicer_id is required'], 422);
        }

        [$startDate, $endDate] = $this->parseDateRange($request);

        $feedbacks = Feedback::where('servicer_id', $servicerId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->with(['counter:id,name,branch_id', 'counter.branch:id,name'])
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn($f) => $this->formatFeedback($f));

        return response()->json(['feedbacks' => $feedbacks]);
    }

    /**
     * Counter performance summary.
     */
    public function counterPerformance(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);

        $rows = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($request->query('branch_id'), fn($q) => $q->where('branch_id', $request->query('branch_id')))
            ->with('counter:id,name')
            ->selectRaw('
                counter_id,
                COUNT(*) as total,
                ROUND(AVG(rating), 2) as avg_rating,
                ROUND(AVG(sentiment_score), 3) as avg_sentiment,
                SUM(rating >= 4) as positive_count
            ')
            ->groupBy('counter_id')
            ->having('total', '>', 0)
            ->orderByDesc('avg_rating')
            ->get()
            ->map(function ($row) {
                $total = (int) $row->total;
                return [
                    'counter_id'          => $row->counter_id,
                    'counter_name'        => $row->counter->name,
                    'total_feedbacks'     => $total,
                    'average_rating'      => (float) $row->avg_rating,
                    'average_sentiment'   => (float) $row->avg_sentiment,
                    'positive_percentage' => $total ? round(($row->positive_count / $total) * 100, 1) : 0,
                ];
            });

        return response()->json($rows);
    }

    /**
     * Time-series trend data (daily / weekly / monthly).
     */
    public function trends(Request $request): JsonResponse
    {
        $period     = in_array($request->query('period'), ['daily','weekly','monthly'])
            ? $request->query('period')
            : 'daily';

        [$startDate, $endDate] = $this->parseDateRange($request);

        $dateExpr = match ($period) {
            'weekly'  => "DATE_FORMAT(created_at, '%Y-%u')",
            'monthly' => "DATE_FORMAT(created_at, '%Y-%m')",
            default   => 'DATE(created_at)',
        };

        $trends = Feedback::whereBetween('created_at', [$startDate, $endDate])
            ->when($request->query('branch_id'), fn($q) => $q->where('branch_id', $request->query('branch_id')))
            ->selectRaw("
                {$dateExpr} as period,
                COUNT(*) as total,
                ROUND(AVG(rating), 2) as avg_rating,
                ROUND(AVG(sentiment_score), 3) as avg_sentiment,
                SUM(rating >= 4) as positive_count,
                SUM(rating <= 2) as negative_count
            ")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(function ($row) {
                $total = (int) $row->total;
                return [
                    'period'              => $row->period,
                    'total_feedbacks'     => $total,
                    'average_rating'      => (float) $row->avg_rating,
                    'average_sentiment'   => (float) $row->avg_sentiment,
                    'positive_percentage' => $total ? round(($row->positive_count / $total) * 100, 1) : 0,
                    'negative_percentage' => $total ? round(($row->negative_count / $total) * 100, 1) : 0,
                ];
            });

        return response()->json($trends);
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Shared feedback DTO used by index() and servicerFeedback().
     */
    private function formatFeedback(Feedback $f): array
    {
        return [
            'id'              => $f->id,
            'rating'          => $f->rating,
            'sentiment_label' => $f->sentiment_label,
            'sentiment_score' => $f->sentiment_score,
            'comment'         => $f->comment,
            'counter_name'    => $f->counter?->name ?? 'Unknown',
            'branch_name'     => $f->counter?->branch?->name ?? 'Unknown',
            'servicer_name'   => $f->servicer?->name ?? 'Unknown',
            'tags'            => $f->relationLoaded('tags') ? $f->tags->pluck('name')->all() : [],
            'submitted_at'    => $f->created_at->format('Y-m-d H:i'),
        ];
    }

    /**
     * Parse start/end dates from request with safe fallback.
     *
     * @return array{Carbon, Carbon}
     */
    private function parseDateRange(Request $request): array
    {
        $start = $request->query('start_date');
        $end   = $request->query('end_date');

        try {
            $startDate = $start ? Carbon::parse($start)->startOfDay() : now()->subDays(30)->startOfDay();
            $endDate   = $end   ? Carbon::parse($end)->endOfDay()     : now()->endOfDay();
        } catch (\Exception) {
            $startDate = now()->subDays(30)->startOfDay();
            $endDate   = now()->endOfDay();
        }

        return [$startDate, $endDate];
    }

    /**
     * Sentiment score: combines rating (70%) and tag sentiments (30%).
     * Returns a clamped float between -1.0 and +1.0.
     */
    private function calculateSentimentScore(int $rating, array $tagIds): float
    {
        $ratingScore = ($rating - 3) / 2; // 1→-1, 3→0, 5→+1

        $tagScore = 0.0;
        if (! empty($tagIds)) {
            $weightMap = ['very_positive' => 0.4, 'positive' => 0.2, 'neutral' => 0.0, 'negative' => -0.2, 'very_negative' => -0.4];
            $tags      = Tag::whereIn('id', $tagIds)->pluck('sentiment');
            $tagScore  = $tags->sum(fn($s) => $weightMap[$s] ?? 0) / count($tags);
        }

        return max(-1.0, min(1.0, $ratingScore * 0.7 + $tagScore * 0.3));
    }

    /**
     * Map a numeric sentiment score to a human-readable label.
     */
    private function scoreToLabel(float $score): string
    {
        return match (true) {
            $score >= 0.6  => 'very_positive',
            $score >= 0.2  => 'positive',
            $score >= -0.2 => 'neutral',
            $score >= -0.6 => 'negative',
            default        => 'very_negative',
        };
    }

    /**
     * Standard 401 response for missing/invalid counter token.
     */
    private function counterError(): JsonResponse
    {
        return response()->json(['error' => 'Invalid or missing counter token'], 401);
    }
}