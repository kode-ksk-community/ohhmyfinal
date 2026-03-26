<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CounterController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\Client\CounterSetupController;
use App\Http\Controllers\Client\ServicerActivationController;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PUBLIC PAGES (No authentication required)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Route::get('/', function () {
    return Inertia::render('landing-page');
})->name('home');

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// COUNTER DEVICE PAGES (Servicer/Counter setup flow)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Route::get('servicer/dashboard', [ServicerDashboardController::class, 'index'])->name('servicer.dashboard')->middleware(['auth', 'can:access_branch_manager_page']);

Route::prefix('counter')
    ->name('counter.')
    ->group(function () {
        // Step 1-3: Counter device setup (QR code scanning â†’ counter selection â†’ PIN)
        Route::get('/setup', [CounterSetupController::class, 'show'])->name('setup');

        // Idle screen: Waiting for servicer to login
        Route::get('/idle', [CounterSetupController::class, 'idle'])->name('idle');

        // Servicer login page (shows form for email/password or QR verification)
        Route::get('/activate', [ServicerActivationController::class, 'show'])->name('activate');
    });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ADMIN DASHBOARD & PAGES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

use App\Http\Controllers\AdminDashboardController;

Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth', 'can:access_branch_manager_page']) // Only authenticated users with 'admin' or 'super_admin' role can access these routes
    ->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index'])->name('dashboard');

        // Admin pages (views for managing entities)
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::get('/users/{user}', [UserController::class, 'show'])->name('users.show');
        Route::get('/users/{user}/stats', [UserController::class, 'servicerStats'])->name('users.stats');
        Route::get('/tags', [TagController::class, 'index'])->name('tags.index');
        Route::get('/branches', [BranchController::class, 'index'])->name('branches.index');
        Route::get('/counters', [CounterController::class, 'index'])->name('counters.index');
        Route::get('/feedback', [FeedbackController::class, 'index'])->name('feedback.index');
        Route::get('/settings', function () {
            return Inertia::render('admin/settings');
        })->name('settings')->middleware('can:access_superadmin_page'); // Only 'super_admin' can access settings
    });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AUTHENTICATED PAGES (Require login)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', function () {
        $user = auth()->user();

        return match ($user->role) {
            'servicer' => redirect()->route('servicer.dashboard'),
            'branch_manager' => redirect()->route('admin.dashboard'),
            'admin', 'super_admin' => redirect()->route('admin.dashboard'),
            default => Inertia::render('dashboard'),
        };
    })->name('dashboard');
});

// ────────────────────────────────────────────────────────────────────────────
// SERVICER DASHBOARD
// ────────────────────────────────────────────────────────────────────────────

use App\Http\Controllers\ServicerDashboardController;
use Illuminate\Support\Facades\Artisan;

Route::middleware(['auth', 'can:access_servicer_page'])
    ->get('/servicer/dashboard', [ServicerDashboardController::class, 'index'])
    ->name('servicer.dashboard');

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ADMIN API ROUTES (CRUD operations)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {

        // Tags CRUD
        Route::resource('tags', TagController::class)->only(['store', 'update', 'destroy']);
        Route::patch('/tags/{tag}/toggle', [TagController::class, 'toggle'])->name('tags.toggle');

        // Branches CRUD
        Route::resource('branches', BranchController::class)->only(['store', 'update', 'destroy']);
        Route::patch('/branches/{branch}/toggle', [BranchController::class, 'toggle'])->name('branches.toggle');

        // Counters CRUD
        Route::resource('counters', CounterController::class)->only(['store', 'update', 'destroy']);
        Route::patch('/counters/{counter}/toggle', [CounterController::class, 'toggle'])->name('counters.toggle');
        Route::patch('/counters/{counter}/force-end-session', [CounterController::class, 'forceEndSession'])->name('counters.force-end-session');

        // Users CRUD
        Route::resource('users', UserController::class)->only(['store', 'update', 'destroy']);
        Route::patch('/users/{user}/toggle', [UserController::class, 'toggle'])->name('users.toggle');
        Route::post('/users/{user}/generate-qr-token', [UserController::class, 'generateQrToken'])->name('users.generate-qr');
        Route::post('/users/{user}/revoke-qr-token', [UserController::class, 'revokeQrToken'])->name('users.revoke-qr-token');
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
    });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AUTHENTICATION ROUTES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Route::get('/clear-cache', function () {
    Artisan::call('config:clear');
    Artisan::call('cache:clear');
    Artisan::call('view:clear');
    return 'All cleared at ' . now();
});

Route::get('/csrf-check', function () {
    return response()->json([
        'csrf_token'        => csrf_token(),
        'session_id'        => session()->getId(),
        'session_driver'    => config('session.driver'),
        'session_domain'    => config('session.domain'),
        'session_secure'    => config('session.secure'),
        'app_url'           => config('app.url'),
        'request_cookies'   => request()->cookies->all(),
        'xsrf_cookie'       => request()->cookie('XSRF-TOKEN'),
        'session_cookie'    => request()->cookie('laravel_session'),
    ]);
});


require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';



// Route::get('/', function () {
//     return Inertia::render('welcome');
// })->name('home');

// Route::middleware(['auth'])->group(function () {
//     Route::get('dashboard', function () {
//         return Inertia::render('dashboard');
//     })->name('dashboard');
// });

// require __DIR__.'/settings.php';
// require __DIR__.'/auth.php';
