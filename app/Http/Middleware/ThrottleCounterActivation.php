<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * ThrottleCounterActivation Middleware
 *
 * Rate limits counter activation attempts to prevent brute force attacks.
 * - 5 attempts per minute per IP for activate-info
 * - 3 attempts per minute per IP for activate-session
 */
class ThrottleCounterActivation
{
    protected static array $limits = [
        'counter.activate-info'    => '5,1',  // 5 attempts per minute
        'counter.activate-session' => '3,1',  // 3 attempts per minute
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $routeName = $request->route()?->getName();

        if (!$routeName || !isset(static::$limits[$routeName])) {
            return $next($request);
        }

        $key = "counter_activation:{$routeName}:{$request->ip()}";
        [$limit, $minutes] = explode(',', static::$limits[$routeName]);

        if (RateLimiter::tooManyAttempts($key, $limit)) {
            return response()->json([
                'message' => 'Too many attempts. Please try again in a few minutes.',
            ], 429);
        }

        RateLimiter::hit($key, $minutes * 60);

        return $next($request);
    }
}
