<?php

namespace App\Http\Controllers;

use App\Models\Feedback;
use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    public function index(Request $request)
    {
        $range = $request->query('range', 'today');
        $stats = $this->stats($request);

        return Inertia::render('admin/dashboard', [
            'stats' => $stats,
            'initialRange' => $range,
        ]);
    }

    public function stats(Request $request)
    {
        $range = $request->query('range', 'today');

        $now = Carbon::now();
        switch ($range) {
            case 'week':
                $from = $now->copy()->subWeek();
                $previousFrom = $now->copy()->subWeeks(2);
                $previousTo = $now->copy()->subWeek();
                break;
            case 'month':
                $from = $now->copy()->subMonth();
                $previousFrom = $now->copy()->subMonths(2);
                $previousTo = $now->copy()->subMonth();
                break;
            case 'year':
                $from = $now->copy()->subYear();
                $previousFrom = $now->copy()->subYears(2);
                $previousTo = $now->copy()->subYear();
                break;
            case 'today':
            default:
                $from = $now->copy()->startOfDay();
                $previousFrom = $now->copy()->subDay()->startOfDay();
                $previousTo = $now->copy()->subDay()->endOfDay();
                break;
        }

        $to = $now;

        $baseQuery = Feedback::whereBetween('created_at', [$from, $to]);

        $total = $baseQuery->count();
        $avg = round((float) $baseQuery->avg('rating') ?: 0, 2);

        $previousQuery = Feedback::whereBetween('created_at', [$previousFrom, $previousTo]);
        $previousTotal = $previousQuery->count();

        $growth = $previousTotal > 0 ? round((($total - $previousTotal) / $previousTotal) * 100, 1) : null;

        $ratingDist = Feedback::select('rating', DB::raw('count(*) as count'))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->toArray();

        $ratingDistFull = array_map(fn($i) => intval($ratingDist[$i] ?? 0), [1, 2, 3, 4, 5]);

        $servicers = Feedback::select('servicer_id', DB::raw('count(*) as total'), DB::raw('avg(rating) as avg'))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('servicer_id')
            ->with('servicer:id,name')
            ->orderByDesc('avg')
            ->limit(5)
            ->get()
            ->map(fn($f) => [
                'id' => $f->servicer?->id,
                'name' => $f->servicer?->name ?? 'Unknown',
                'total' => $f->total,
                'avg' => round((float) $f->avg, 2),
                'trend' => []
            ]);

        $tags = Tag::withCount('feedbacks')
            ->orderByDesc('feedbacks_count')
            ->limit(6)
            ->get()
            ->map(fn($tag) => [
                'name' => $tag->name,
                'count' => $tag->feedbacks_count,
                'sentiment' => $tag->sentiment ?? 'neutral',
            ]);

        $feed = Feedback::with(['servicer:id,name', 'counter:id,name,branch_id', 'counter.branch:id,name'])
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn($f) => [
                'id' => $f->id,
                'rating' => $f->rating,
                'servicer' => $f->servicer?->name ?? 'Unknown',
                'comment' => $f->comment,
                'tags' => $f->tags->pluck('name')->toArray(),
                'time' => $f->created_at->diffForHumans(),
            ]);

        return [
            'range' => $range,
            'total' => $total,
            'avg' => $avg,
            'growth' => $growth,
            'ratingDist' => $ratingDistFull,
            'servicers' => $servicers,
            'tags' => $tags,
            'feed' => $feed,
        ];
    }
}
