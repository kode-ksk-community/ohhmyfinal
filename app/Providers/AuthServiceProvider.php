<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        Gate::define('access_branch_manager_page', function (User $user) {
            return in_array($user->role, ['super_admin', 'admin', 'branch_manager']);
        });
        Gate::define('access_admin_page', function (User $user) {
            return in_array($user->role, ['super_admin', 'admin']);
        });
        Gate::define('access_superadmin_page', function (User $user) {
            return in_array($user->role, ['super_admin']);
        });
        Gate::define('access_servicer_page', function (User $user) {
            return in_array($user->role, ['servicer']);
        });
    }
}
