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
            return response()->json(['active' => false]);
        }

        return response()->json([
            'active'  => true,
            'session' => [
                'id'           => $session->id,
                'servicer_name' => $session->servicer->name,
                'started_at'   => $session->started_at->toISOString(),
            ],
        ]);
    }
}
