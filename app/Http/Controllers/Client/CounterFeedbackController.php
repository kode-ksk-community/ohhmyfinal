    <?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Models\Feedback;
use App\Models\Tag;
use App\Services\SentimentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

// ─────────────────────────────────────────────────────────────────────────────
// CounterFeedbackController
// Serves the feedback page and handles anonymous customer submissions.
// ─────────────────────────────────────────────────────────────────────────────

class CounterFeedbackController extends Controller
{
    public function __construct(
        private readonly SentimentService $sentimentService
    ) {}

    /**
     * GET /counter/feedback
     *
     * Renders the CustomerFeedback Inertia page.
     * The page itself calls GET /api/counter/feedback-data on mount.
     */
    public function show(): InertiaResponse
    {
        return Inertia::render('Counter/Feedback');
    }

    /**
     * GET /api/counter/feedback-data
     * Middleware: device.token
     *
     * Returns the data needed to render the feedback form:
     * - The currently active servicer (from the active session)
     * - Available tags (global + branch-specific)
     *
     * If no active session exists, returns 404 so the frontend
     * can redirect back to the idle screen.
     */
    public function data(Request $request): JsonResponse
    {
        /** @var Counter $counter */
        $counter = $request->attributes->get('counter');

        // Get the active session
        $session = $counter->activeSession()->with('servicer:id,name,avatar')->first();

        if (! $session) {
            return response()->json([
                'message'  => 'No active session on this counter.',
                'redirect' => '/counter/idle',
            ], 404);
        }

        // Get tags: global (branch_id = null) + branch-specific
        $tags = Tag::active()
            ->availableForBranch($counter->branch_id)
            ->ordered()
            ->select('id', 'name', 'name_kh', 'color', 'icon', 'sentiment', 'sort_order')
            ->get();

        return response()->json([
            'servicer' => [
                'id'         => $session->servicer->id,
                'name'       => $session->servicer->name,
                'avatar_url' => $session->servicer->avatar_url,
            ],
            'tags'       => $tags,
            'session_id' => $session->id,
        ]);
    }

    /**
     * POST /api/counter/submit-feedback
     * Middleware: device.token
     *
     * Stores anonymous customer feedback.
     * No login required — identified by device_token only.
     *
     * Body: {
     *   rating:   int (1-5),
     *   tag_ids:  int[] (optional),
     *   comment:  string (optional, max 300 chars)
     * }
     *
     * Response: { success: true }
     */
    public function store(Request $request): JsonResponse
    {
        /** @var Counter $counter */
        $counter = $request->attributes->get('counter');

        // Ensure there's an active session to attach the feedback to
        $session = $counter->activeSession()->with('servicer')->first();

        if (! $session) {
            return response()->json([
                'message'  => 'No active session. Counter may have been deactivated.',
                'redirect' => '/counter/idle',
            ], 422);
        }

        $validated = $request->validate([
            'rating'    => ['required', 'integer', 'min:1', 'max:5'],
            'tag_ids'   => ['nullable', 'array', 'max:10'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
            'comment'   => ['nullable', 'string', 'max:300'],
        ]);

        // Create feedback record
        $feedback = Feedback::create([
            'counter_id'         => $counter->id,
            'counter_session_id' => $session->id,
            'servicer_id'        => $session->servicer->id,
            'branch_id'          => $counter->branch_id,
            'rating'             => $validated['rating'],
            'comment'            => $validated['comment'] ?? null,
            'submitted_ip'       => $request->ip(),
        ]);

        // Attach tags
        if (! empty($validated['tag_ids'])) {
            $feedback->tags()->attach($validated['tag_ids']);
        }

        // Calculate sentiment score (loads tags relation first for accuracy)
        $feedback->load('tags');
        $feedback->calculateSentiment();

        return response()->json(['success' => true]);
    }
}
