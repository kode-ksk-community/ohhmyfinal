<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * ThrottleAuthenticatedActivation Middleware
 *
 * Rate limits counter activation attempts, but ONLY for unauthenticated users.
 * Authenticated users can attempt as many times as they want.
 *
 * Rationale:
 *   - Unauthenticated users (PASSWORD LOGIN) → rate limited at 3/min (brute force protection)
 *   - Authenticated users (ALREADY LOGGED IN) → unlimited (already trusted)
 */
class ThrottleAuthenticatedActivation
{
    public function handle(Request $request, Closure $next): Response
    {
        // If user is already authenticated, skip rate limiting
        if (auth()->check()) {
            return $next($request);
        }

        // Not authenticated → apply rate limit
        $key = "activation_guest:{$request->ip()}";
        $limit = 3; // 3 attempts
        $minutes = 1; // Per minute

        if (RateLimiter::tooManyAttempts($key, $limit)) {
            return response()->json([
                'message' => 'Too many login attempts. Please try again in a few minutes.',
            ], 429);
        }

        RateLimiter::hit($key, $minutes * 60);

        return $next($request);
    }
}
