<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Models\ServicerQrToken;
use App\Models\Feedback;
use App\Models\Tag;
use App\Services\SentimentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

// ─────────────────────────────────────────────────────────────────────────────
// CounterSessionController
// Handles session polling and servicer logout from the counter device.
// ─────────────────────────────────────────────────────────────────────────────

class CounterSessionController extends Controller
{
    /**
     * GET /api/counter/session/status
     * Middleware: device.token
     *
     * Polled every 4 seconds by CounterIdle.tsx.
     * Returns whether there is currently an active servicer session on this counter.
     *
     * The counter device uses this to know when to switch from the idle screen
     * to the live feedback form.
     *
     * Response when idle:
     *   { active: false }
     *
     * Response when a servicer has activated:
     *   {
     *     active: true,
     *     session: {
     *       id: 1,
     *       servicer_name: "Sophea Chan",
     *       started_at: "2024-12-20T09:12:00.000Z"
     *     }
     *   }
     */
    public function status(Request $request)
    {
        /** @var Counter $counter */
        $counter = $request->attributes->get('counter');

        $session = $counter->sessions()
            ->whereNull('ended_at')
            ->with('servicer:id,name')
            ->latest('started_at')
            ->first();

        if (! $session) {
            Log::debug('Session Polling: No active session', [
                'counter_id' => $counter->id,
                'counter_name' => $counter->name,
                'branch_id' => $counter->branch_id,
                'ip' => $request->ip(),
                'timestamp' => now(),
            ]);

            return response()->json(['active' => false]);
        }

        Log::debug('Session Polling: Active session found', [
            'counter_id' => $counter->id,
            'counter_name' => $counter->name,
            'branch_id' => $counter->branch_id,
            'session_id' => $session->id,
            'servicer_id' => $session->servicer->id,
            'servicer_name' => $session->servicer->name,
            'session_started_at' => $session->started_at->toISOString(),
            'ip' => $request->ip(),
            'timestamp' => now(),
        ]);

        return response()->json([
            'active'  => true,
            'session' => [
                'id'           => $session->id,
                'servicer_name' => $session->servicer->name,
                'started_at'   => $session->started_at->toISOString(),
            ],
        ]);
    }

    /**
     * POST /api/counter/session/end
     * Middleware: device.token
     *
     * Allows the counter itself to end its own active session, returning to idle waiting.
     */
    public function end(Request $request)
    {
        /** @var Counter|null $counter */
        $counter = $request->attributes->get('counter');

        if (! $counter && $request->filled('counter_token')) {
            $counter = Counter::where('device_token', $request->counter_token)->first();
        }

        if (! $counter) {
            return response()->json(['success' => false, 'message' => 'Counter token is invalid or missing'], 404);
        }

        $session = $counter->sessions()
            ->whereNull('ended_at')
            ->latest('started_at')
            ->first();

        if (! $session) {
            Log::debug('Session end called but no active session', [
                'counter_id' => $counter->id,
                'counter_name' => $counter->name,
                'ip' => $request->ip(),
                'timestamp' => now(),
            ]);

            return response()->json(['success' => true, 'active' => false, 'message' => 'No active session to end'], 200);
        }

        $session->update([
            'ended_at' => now(),
            'end_reason' => 'terminate',
        ]);

        Log::info('Counter session ended via counter API', [
            'counter_id' => $counter->id,
            'counter_name' => $counter->name,
            'session_id' => $session->id,
            'servicer_id' => $session->user_id,
            'servicer_name' => $session->servicer?->name,
            'duration_seconds' => $session->started_at->diffInSeconds(now()),
            'ip' => $request->ip(),
            'timestamp' => now(),
        ]);

        return response()->json(['success' => true, 'active' => false, 'message' => 'Session ended, counter is idle'], 200);
    }
}
