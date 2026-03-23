<?php

namespace App\Http\Middleware;

use App\Models\Counter;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * DeviceTokenMiddleware
 *
 * Validates the X-Counter-Token header against stored counter device tokens.
 * If valid, attaches the Counter model to the request for use in controllers.
 *
 * Usage in routes:
 *   Route::middleware('device.token')->group(function () {
 *       Route::get('/counter/session/status', ...);
 *   });
 *
 * The middleware will:
 *   1. Check for X-Counter-Token header
 *   2. Look up the counter by device_token
 *   3. Attach $request->counter if found
 *   4. Return 401 if token invalid or counter not found
 */
class DeviceTokenMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Counter-Token');

        if (!$token) {
            return response()->json(['error' => 'Missing X-Counter-Token header'], 401);
        }

        $counter = Counter::where('device_token', $token)->first();

        if (!$counter) {
            return response()->json(['error' => 'Invalid device token'], 401);
        }

        if (!$counter->is_active) {
            return response()->json(['error' => 'Counter is not active'], 403);
        }

        // Attach the counter to the request attributes
        $request->attributes->set('counter', $counter);

        return $next($request);
    }
}
