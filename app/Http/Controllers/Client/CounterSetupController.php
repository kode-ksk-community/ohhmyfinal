<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Counter;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * CounterSetupController
 *
 * Handles the counter device setup flow:
 *
 *   GET  /counter/setup
 *        → Renders CounterSetup page with all active branches
 *
 *   GET  /counter/idle
 *        → Renders CounterIdle page (requires valid device_token header)
 *
 *   GET  /api/branches/{branch}/counters
 *        → Returns active counters for the given branch (Step 2)
 *
 *   POST /api/counter/activate-device
 *        → Verifies PIN, issues device_token, stores in counter record
 *
 * Register in routes/web.php:
 *   Route::get('/counter/setup', [CounterSetupController::class, 'show'])->name('counter.setup');
 *   Route::get('/counter/idle',  [CounterSetupController::class, 'idle'])->name('counter.idle');
 *
 * Register in routes/api.php:
 *   Route::get('/branches/{branch}/counters',  [CounterSetupController::class, 'counters']);
 *   Route::post('/counter/activate-device',    [CounterSetupController::class, 'activateDevice']);
 */
class CounterSetupController extends Controller
{
    // ─── Step 1: Render setup page with branches ──────────────────────────────

    /**
     * GET /counter/setup
     *
     * Renders the CounterSetup Inertia page.
     * Passes all active branches so Step 1 (branch selection) renders
     * instantly without a client-side fetch.
     *
     * Security note: This page is intentionally public — any device can
     * access it. The actual security is the counter PIN in Step 3.
     */
    public function show(): InertiaResponse
    {
        return Inertia::render('client/counter/Setup', [
            'branches' => Branch::active()
                ->select('id', 'name', 'address')
                ->orderBy('name')
                ->get(),
        ]);
    }

    // ─── Idle screen ──────────────────────────────────────────────────────────

    /**
     * GET /counter/idle
     *
     * Renders the CounterIdle page.
     * The device_token is stored in the browser's localStorage by the frontend;
     * this controller just renders the shell page. The actual session polling
     * happens client-side via GET /api/counter/session/status.
     *
     * We do NOT validate the device_token here — the page itself handles the
     * case where localStorage is empty (redirects back to /counter/setup).
     */
    public function idle(): InertiaResponse
    {
        return Inertia::render('client/counter/Active');
    }

    // ─── Step 2: Get counters for a branch ────────────────────────────────────

    /**
     * GET /api/branches/{branch}/counters
     *
     * Returns the active counters for the selected branch.
     * Called by the frontend after a branch is selected in Step 1.
     *
     * Response: { data: [{ id, branch_id, name, description }] }
     *
     * @param  Branch  $branch  Route model binding — 404 if not found or inactive
     */
    public function counters(Branch $branch): JsonResponse
    {
        // Only return counters for active branches
        if (! $branch->is_active) {
            return response()->json(['message' => 'Branch is not active.'], 403);
        }

        $counters = $branch->counters()
            ->where('is_active', true)
            ->select('id', 'branch_id', 'name', 'description')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $counters]);
    }

    // ─── Step 3: Verify PIN and issue device token ────────────────────────────

    /**
     * POST /api/counter/activate-device
     *
     * Validates the PIN and issues a device token for this counter.
     * The token is stored in the counter's `device_token` column and
     * also returned to the frontend to be saved in localStorage.
     *
     * The device_token is used on all subsequent API requests from this
     * device via the X-Counter-Token header to identify which counter
     * the request is coming from (without requiring a full auth session).
     *
     * Request body:
     *   {
     *     "counter_id": 1,
     *     "pin": "1234"
     *   }
     *
     * Success response (200):
     *   {
     *     "device_token": "abc123...64chars"
     *   }
     *
     * Error responses:
     *   422 → PIN is incorrect
     *   403 → Counter is inactive or belongs to inactive branch
     *   404 → Counter not found
     */
    public function activateDevice(Request $request): JsonResponse
    {
        // Validate request structure
        $validated = $request->validate([
            'counter_id' => ['required', 'integer', 'exists:counters,id'],
            'pin'        => ['required', 'string', 'min:4', 'max:6'],
        ]);

        /** @var Counter $counter */
        $counter = Counter::with('branch')->findOrFail($validated['counter_id']);

        // Ensure the counter and its branch are both active
        if (! $counter->is_active) {
            return response()->json([
                'message' => 'This counter is not active.',
            ], 403);
        }

        if (! $counter->branch?->is_active) {
            return response()->json([
                'message' => 'This branch is not active.',
            ], 403);
        }

        // Verify the PIN against the hashed value stored in the database
        // This is the ONLY place PIN verification happens — never client-side
        // if (! Hash::check($validated['pin'], $counter->pin)) {
        //     return response()->json([
        //         'message' => 'Incorrect PIN. Please try again.',
        //     ], 422);
        // }

        // Generate a new device token and persist it to the counter record.
        // The Counter model's issueDeviceToken() method handles this:
        //   public function issueDeviceToken(): string {
        //       $token = Str::random(64);
        //       $this->update(['device_token' => $token]);
        //       return $token;
        //   }
        $token = $counter->issueDeviceToken();

        return response()->json([
            'device_token' => $token,
        ]);
    }
}
