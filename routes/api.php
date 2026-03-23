<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Client\CounterSetupController;
use App\Http\Controllers\Client\CounterSessionController;
use App\Http\Controllers\Client\CounterFeedbackController;
use App\Http\Controllers\Client\Serviceractivationcontroller;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CounterController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\FeedbackController;


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');




// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API ROUTES (no authentication required)
// ─────────────────────────────────────────────────────────────────────────────

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

// Counter Device Setup (Step 1-3 of counter login flow)
Route::get('/branches/{branch}/counters', [Countersetupcontroller::class, 'counters']);
Route::post('/counter/activate-device', [Countersetupcontroller::class, 'activateDevice']);

// Servicer Activation (scanning counter QR code)
// Needs 'web' middleware to access Laravel session and check session ownership
Route::middleware('web', 'throttle:5,1')->get('/counter/activate-info', [Serviceractivationcontroller::class, 'info'])
    ->name('counter.activate-info');

// Session activation requires session middleware for Laravel session cookies
// Uses smart rate limiting: only rate limits unauthenticated guests, not logged-in users
Route::middleware('web', \App\Http\Middleware\ThrottleAuthenticatedActivation::class)
    ->post('/counter/activate-session', [Serviceractivationcontroller::class, 'activateSession'])
    ->name('counter.activate-session');

// Session logout - authenticated users (no rate limit)
Route::middleware('web')->post('/counter/session/end', [Serviceractivationcontroller::class, 'endSession'])
    ->name('counter.session.end');

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER DEVICE API (requires device token)
// ─────────────────────────────────────────────────────────────────────────────

// Route::middleware('device.token')->prefix('counter')->group(function () {
Route::middleware('device.token')->prefix('counter')->group(function () {
    // Session polling (called every 4 seconds by counter idle screen)
    Route::get('/session/status', [CounterSessionController::class, 'status']);

    // Allow counter to end its own active session (servicer presses "end shift" button)
    Route::post('/session/end', [CounterSessionController::class, 'end']);

    // Feedback data and submission
    Route::get('/feedback-data', [FeedbackController::class, 'data']);
    Route::post('/feedback', [FeedbackController::class, 'store']);
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED API ROUTES (staff only)
// ─────────────────────────────────────────────────────────────────────────────

Route::middleware('auth:sanctum,web')->group(function () {
    // Feedback analytics and reporting
    Route::get('/feedback/analytics', [FeedbackController::class, 'analytics']);
    Route::get('/feedback/top-tags', [FeedbackController::class, 'topTags']);
    Route::get('/feedback/servicer-performance', [FeedbackController::class, 'servicerPerformance']);
    Route::get('/feedback/counter-performance', [FeedbackController::class, 'counterPerformance']);
    Route::get('/feedback/trends', [FeedbackController::class, 'trends']);
    Route::get('/feedback', [FeedbackController::class, 'index']);
    Route::delete('/feedback/{feedback}', [FeedbackController::class, 'destroy']);

    // Admin dashboard stats endpoint (for dynamic dashboard)
    Route::middleware('role:admin')->get('/admin/stats', [\App\Http\Controllers\AdminDashboardController::class, 'stats']);

    // Servicer Dashboard API Routes - ensure 'web' middleware so session is started
    Route::middleware(['web', 'auth:sanctum,web', 'can:access_servicer_page'])->prefix('servicer')->group(function () {
        Route::get('/active-session', [\App\Http\Controllers\ServicerDashboardController::class, 'getActiveSession']);
        Route::post('/terminate-session/{session}', [\App\Http\Controllers\ServicerDashboardController::class, 'terminateSession']);
    });
});
