<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\CounterSession;

class ServicerDashboardController extends Controller
{
    public function index()
    {
        return Inertia::render('servicer/dashboard');
    }

    public function getActiveSession()
    {
        $user = auth()->user();

        // Get the active counter session for this servicer (user_id, not servicer_id)
        $activeSession = CounterSession::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->with(['counter.branch'])
            ->first();

        if (!$activeSession) {
            return response()->json([
                'session' => null,
                'message' => 'No active session',
            ], 404);
        }

        return response()->json([
            'session' => $activeSession,
        ]);
    }

    public function terminateSession($sessionId)
    {
        $user = auth()->user();
        $session = CounterSession::findOrFail($sessionId);

        // Verify the session belongs to this servicer
        if ($session->user_id !== $user->id) {
            return response()->json([
                'message' => 'Unauthorized',
            ], 403);
        }

        // Mark session as ended
        $session->update([
            'ended_at' => now(),
            'end_reason' => 'logout',
        ]);

        // Update counter status to idle
        $session->counter->update([
            'is_active' => false,
        ]);

        return response()->json([
            'message' => 'Session terminated successfully',
            'session' => $session,
        ]);
    }
}