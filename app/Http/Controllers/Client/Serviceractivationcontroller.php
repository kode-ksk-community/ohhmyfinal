<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\Client\ServicerActivationRequest;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * ServicerActivationController
 *
 * Handles the servicer login flow after scanning the COUNTER's QR code.
 *
 * ── New flow (counter QR) vs old flow (servicer QR) ──────────────────────────
 * OLD: Each servicer had a personal QR token → scanned to auto-activate
 * NEW: The counter displays its own QR → servicer scans → enters email/password
 *
 * The counter's QR encodes:
 *   /counter/activate?counter_token=<device_token>
 *
 * The device_token is already stored in the counter record (set during setup).
 * No servicer-specific tokens are needed anymore.
 *
 * Register in routes:
 *   // web.php
 *   Route::get('/counter/activate', [ServicerActivationController::class, 'show'])
 *        ->name('counter.activate');
 *
 *   // api.php — public, no auth needed
 *   Route::get('/counter/activate-info',     [ServicerActivationController::class, 'info']);
 *   Route::post('/counter/activate-session',  [ServicerActivationController::class, 'activateSession']);
 */
class Serviceractivationcontroller extends Controller
{
    use ApiResponse;
    /**
     * GET /counter/activate
     *
     * Renders the ServicerActivation.tsx Inertia page on the servicer's phone.
     * The page reads ?counter_token from the URL client-side and calls the API.
     */
    public function show(): InertiaResponse
    {
        return Inertia::render('client/counter/Activate');
    }

    /**
     * GET /api/counter/activate-info?counter_token=<token>
     *
     * Validates the counter token from the QR code and returns counter info.
     * Called by ServicerActivation.tsx on mount to show the confirm screen.
     *
     * Response 200:
     *   { counter: { id, name, branch_name, branch_id } }
     *
     * Response 404: counter not found / token invalid
     * Response 403: counter or branch is inactive
     * Response 409: counter is currently occupied
     *   { message, idle_counters: [{ id, name, description, device_token }] }
     *
     * Note: idle_counters includes device_token so the phone can redirect to
     *       a different counter's activation URL without going back to the counter.
     */
    public function info(Request $request): JsonResponse
    {
        $counterToken = $request->query('counter_token');

        if (!$counterToken) {
            return $this->error('Counter token is required.', 422);
        }

        // Find the counter by its device_token
        $counter = Counter::where('device_token', $counterToken)
            ->with('branch:id,name,is_active')
            ->first();

        if (!$counter) {
            return $this->error(
                'Invalid QR code. This counter has not been set up or its QR has expired.',
                404
            );
        }

        if (!$counter->is_active) {
            return $this->error(
                'This counter is currently inactive. Please contact your manager.',
                403
            );
        }

        if (!$counter->branch?->is_active) {
            return $this->error('This branch is currently inactive.', 403);
        }

        // Check if counter is already occupied
        if ($counter->isOccupied()) {
            // If user is authenticated, check if they own this session
            if (auth()->check()) {
                $activeSession = CounterSession::where('counter_id', $counter->id)
                    ->whereNull('ended_at')
                    ->with('servicer')
                    ->first();

                // If the current user owns this session, allow them through
                if ($activeSession && $activeSession->user_id === auth()->id()) {
                    return $this->success([
                        'counter' => [
                            'id'          => $counter->id,
                            'name'        => $counter->name,
                            'branch_name' => $counter->branch->name,
                            'branch_id'   => $counter->branch_id,
                        ],
                        'session_owner' => true,
                        'servicer_name' => $activeSession->servicer->name,
                    ]);
                }
            }

            // Counter is occupied by someone else
            return response()->json([
                'message'       => "{$counter->name} is currently occupied.",
                'idle_counters' => $this->getIdleCounters($counter),
            ], 409);
        }

        return $this->success([
            'counter' => [
                'id'          => $counter->id,
                'name'        => $counter->name,
                'branch_name' => $counter->branch->name,
                'branch_id'   => $counter->branch_id,
            ],
        ]);
    }

    /**
     * POST /api/counter/activate-session
     *
     * Smart auth-aware activation — two paths in one endpoint:
     *
     * PATH A — Servicer already has a Laravel session (previously logged in):
     *   Body: { counter_token }
     *   → No password needed — verifies role + branch match
     *   → Activates counter immediately
     *
     * PATH B — Servicer is a guest (first scan or session expired):
     *   Body: { counter_token, email, password }
     *   → Authenticates with credentials
     *   → Logs them into Laravel session (next scan = PATH A)
     *   → Activates counter
     *
     * Response 200:
     *   { success: true, servicer_name: string, already_logged_in: bool }
     *
     * Error responses:
     *   422 → wrong credentials, or guest missing email/password
     *   403 → wrong branch, wrong role, or inactive account
     *   409 → counter became occupied (race condition) + idle_counters list
     *   404 → counter token invalid
     */
    public function activateSession(ServicerActivationRequest $request): JsonResponse
    {
        Log::info('Counter activation attempt', [
            'ip'       => $request->ip(),
            'has_auth' => auth()->check(),
            'email'    => $request->email ? "***" : null,
        ]);

        // ── Find the counter ────────────────────────────────────────────────
        $counter = Counter::where('device_token', $request->counter_token)
            ->where('is_active', true)
            ->with('branch')
            ->first();

        if (!$counter) {
            Log::warning('Counter not found', [
                'token' => substr($request->counter_token, 0, 8) . '...',
            ]);

            return $this->error('Invalid or expired counter token.', 404);
        }

        Log::log('info', 'Counter found', [
            'counter_id'   => $counter->id,
            'counter_name' => $counter->name,
            'branch_id'    => $counter->branch_id,
        ]);

        if (!$counter->branch?->is_active) {
            Log::warning('Branch inactive', ['branch_id' => $counter->branch_id]);
            return $this->error('This branch is currently inactive.', 403);
        }

        // ── Resolve servicer ───────────────────────────────────────────────
        $alreadyLoggedIn = false;
        $servicer        = null;

        if (auth()->check()) {
            // PATH A: Already logged in
            Log::info('Path A: Authenticated user attempting activation');

            $authUser = auth()->user();

            if ($authUser->role !== 'servicer') {
                Log::warning('Invalid role', ['role' => $authUser->role, 'user_id' => $authUser->id]);
                return $this->error('Only servicers can activate counters.', 403);
            }

            if (!$authUser->is_active) {
                Log::warning('Inactive user', ['user_id' => $authUser->id]);
                return $this->error('Your account is inactive.', 403);
            }

            if ($authUser->branch_id !== $counter->branch_id) {
                Log::warning('Branch mismatch', [
                    'user_branch'    => $authUser->branch_id,
                    'counter_branch' => $counter->branch_id,
                ]);
                return $this->error('You are assigned to a different branch.', 403);
            }

            $servicer        = $authUser;
            $alreadyLoggedIn = true;
        } else {
            // PATH B: Guest login
            Log::info('Path B: Guest user attempting login');

            $candidate = User::where('email', $request->email)
                ->where('role', 'servicer')
                ->where('is_active', true)
                ->first();

            if (!$candidate || !Hash::check($request->password, $candidate->password)) {
                Log::warning('Authentication failed', ['email' => $request->email]);
                return $this->error('Invalid email or password.', 422);
            }

            if ($candidate->branch_id !== $counter->branch_id) {
                Log::warning('Branch mismatch (guest)', [
                    'user_branch'    => $candidate->branch_id,
                    'counter_branch' => $counter->branch_id,
                ]);
                return $this->error(
                    "Your account is not assigned to {$counter->branch->name}.",
                    403
                );
            }

            Log::info('Guest login successful', ['user_id' => $candidate->id]);

            // ✅ Login and regenerate session
            auth()->login($candidate, true);
            $request->session()->regenerate();

            $servicer = $candidate;
        }

        // ── Race condition guard ────────────────────────────────────────────
        if ($counter->isOccupied()) {
            Log::warning('Counter already occupied', ['counter_id' => $counter->id]);

            return response()->json([
                'message'       => "{$counter->name} was just taken.",
                'idle_counters' => $this->getIdleCounters($counter),
            ], 409);
        }

        // ── Create session ──────────────────────────────────────────────────
        $session = CounterSession::create([
            'counter_id' => $counter->id,
            'user_id'    => $servicer->id,
            'started_at' => now(),
            'device_ip'  => $request->ip(),
        ]);

        Log::info('Counter session created', [
            'session_id'  => $session->id,
            'counter_id'  => $counter->id,
            'user_id'     => $servicer->id,
            'username'    => $servicer->name,
        ]);

        return $this->success([
            'success'           => true,
            'servicer_name'     => $servicer->name,
            'already_logged_in' => $alreadyLoggedIn,
        ]);
    }

    /**
     * POST /api/counter/session/end
     *
     * Ends the current counter session for a logged-in servicer.
     * Only allows the session owner to end their own session.
     *
     * Body:
     *   {
     *     "counter_token": "device_token"
     *   }
     *
     * Response 200:
     *   { success: true, message: "Session ended" }
     *
     * Error responses:
     *   401 → not authenticated
     *   404 → counter not found
     *   403 → no active session or not session owner
     */
    public function endSession(Request $request): JsonResponse
    {
        // Must be authenticated
        if (!auth()->check()) {
            return $this->error('You must be logged in to end a session.', 401);
        }

        $request->validate([
            'counter_token' => ['required', 'string'],
        ]);

        // Find the counter
        $counter = Counter::where('device_token', $request->counter_token)
            ->first();

        if (!$counter) {
            return $this->error('Counter not found.', 404);
        }

        // Find the active session for this counter
        $session = CounterSession::where('counter_id', $counter->id)
            ->whereNull('ended_at')
            ->first();

        if (!$session) {
            return $this->error('No active session on this counter.', 403);
        }

        // Verify the current user is the session owner
        if ($session->user_id !== auth()->id()) {
            Log::warning('Unauthorized logout attempt', [
                'user_id' => auth()->id(),
                'session_owner' => $session->user_id,
                'counter_id' => $counter->id,
            ]);
            return $this->error('You do not own this session.', 403);
        }

        // End the session
        $session->update([
            'ended_at'  => now(),
            'end_reason' => 'logout',
        ]);

        Log::info('Counter session ended', [
            'session_id' => $session->id,
            'counter_id' => $counter->id,
            'user_id' => auth()->id(),
            'duration_seconds' => $session->started_at->diffInSeconds(now()),
        ]);

        return $this->success([
            'success' => true,
            'message' => 'Session ended. Thank you!',
        ]);
    }
    private function getIdleCounters(Counter $counter): \Illuminate\Support\Collection
    {
        return Counter::idle()
            ->active()
            ->where('branch_id', $counter->branch_id)
            ->where('id', '!=', $counter->id)
            ->whereNotNull('device_token')
            ->select('id', 'name', 'description', 'device_token')
            ->get()
            ->map(fn($c) => [
                'id'           => $c->id,
                'name'         => $c->name,
                'description'  => $c->description,
                'device_token' => $c->device_token,
            ]);
    }
}
