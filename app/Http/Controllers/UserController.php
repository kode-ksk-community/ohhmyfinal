<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Branch;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * Shared eager-load query for users.
     */
    private function userQuery()
    {
        return User::with(['branch', 'activeQrToken'])
            ->withCount('feedbacks')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Map a User model to the shape the frontend expects.
     */
    private function formatUser(User $user): array
    {
        return [
            'id'             => $user->id,
            'name'           => $user->name,
            'email'          => $user->email,
            'role'           => $user->role,
            'branch_id'      => $user->branch_id,
            'branch_name'    => $user->branch?->name,
            'is_active'      => (bool) $user->is_active,
            'has_qr_token'   => $user->activeQrToken !== null,
            'feedback_count' => $user->feedbacks_count ?? 0,
            'last_active'    => $user->isCurrentlyActive() ? 'Now' : null,
            'created_at'     => $user->created_at->format('Y-m-d'),
        ];
    }

    /**
     * Validate that branch-scoped roles have a branch assigned.
     * Returns a redirect with an error if the rule is violated, or null if OK.
     */
    private function validateBranchRule(array $validated): ?RedirectResponse
    {
        $scopedRoles = ['branch_manager', 'servicer'];

        if (in_array($validated['role'], $scopedRoles) && empty($validated['branch_id'])) {
            return redirect()->back()
                ->withErrors(['branch_id' => 'Branch is required for this role.'])
                ->withInput();
        }

        return null;
    }

    /**
     * Check if user can manage another user.
     * Branch managers can only manage users in their own branch.
     */
    private function authorizeUserAccess(User $user): ?RedirectResponse
    {
        $authUser = auth()->user();

        // Super admin/admin can manage anyone
        if ($authUser && in_array($authUser->role, ['super_admin', 'admin'])) {
            return null;
        }

        // Branch managers can only manage users in their branch
        if ($authUser && $authUser->role === 'branch_manager') {
            if ($user->branch_id !== $authUser->branch_id) {
                return redirect()->back()
                    ->with('error', 'You can only manage users in your own branch.');
            }
        }

        return null;
    }

    /**
     * Check if user can create/update to a specific role and branch.
     */
    private function canManageUserType(array $validated): ?RedirectResponse
    {
        $authUser = auth()->user();

        // Super admin/admin can do anything
        if ($authUser && in_array($authUser->role, ['super_admin', 'admin'])) {
            return null;
        }

        // Branch managers cannot create/manage global roles
        if ($authUser && $authUser->role === 'branch_manager') {
            if (in_array($validated['role'], ['super_admin', 'admin'])) {
                return redirect()->back()
                    ->with('error', 'You cannot manage global admin roles.');
            }

            // Branch managers can only manage their branch
            if ($validated['branch_id'] !== $authUser->branch_id) {
                return redirect()->back()
                    ->with('error', 'You can only manage users in your own branch.');
            }
        }

        return null;
    }

    /**
     * Display the admin users page.
     */
    public function index(): Response
    {
        $user = auth()->user();

        $query = $this->userQuery();

        // Branch managers can only see users in their branch
        if ($user && $user->role === 'branch_manager') {
            $query->where('branch_id', $user->branch_id);
        }

        $users = $query->get()
            ->map(fn($u) => $this->formatUser($u));

        $branchesQuery = Branch::active()->select('id', 'name');

        // Branch managers can only see their own branch
        if ($user && $user->role === 'branch_manager') {
            $branchesQuery->where('id', $user->branch_id);
        }

        return Inertia::render('admin/users', [
            'users'    => $users,
            'branches' => $branchesQuery->get(),
        ]);
    }

    /**
     * Show a single user's detail page (admin view).
     */
    public function show(User $user): Response
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return $redirect;
        }

        $user->load(['branch', 'activeQrToken']);
        $user->loadCount('feedbacks');

        return Inertia::render('admin/user-detail', [
            'user' => $this->formatUser($user),
        ]);
    }

    /**
     * Servicer stats endpoint — intentionally stays as JSON
     * because it is polled by the UserDetail page via fetch, not Inertia.
     */
    public function servicerStats(Request $request, User $user): JsonResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return response()->json(['error' => $redirect->getSession()->get('error')], 403);
        }

        if (! $user->isServicer()) {
            return response()->json(['error' => 'Only servicers have stats'], 422);
        }

        $period = $request->query('period', 'monthly');
        $end    = Carbon::now();

        $start = match ($period) {
            'daily'   => $end->copy()->startOfDay(),
            'weekly'  => $end->copy()->startOfWeek(),
            'yearly'  => $end->copy()->startOfYear(),
            default   => $end->copy()->startOfMonth(),
        };

        $feedbacks = $user->feedbacks()
            ->whereBetween('created_at', [$start, $end])
            ->with(['counter:id,name,branch_id', 'counter.branch:id,name'])
            ->orderBy('created_at', 'desc')
            ->limit(300)
            ->get();

        $total    = $feedbacks->count();
        $positive = $feedbacks->where('rating', '>=', 4)->count();
        $negative = $feedbacks->where('rating', '<=', 2)->count();

        return response()->json([
            'total_feedbacks'      => $total,
            'average_rating'       => round($feedbacks->avg('rating') ?? 0, 2),
            'average_sentiment'    => round($feedbacks->avg('sentiment_score') ?? 0, 3),
            'positive_percentage'  => $total ? round(100 * $positive / $total, 1) : 0,
            'negative_percentage'  => $total ? round(100 * $negative / $total, 1) : 0,
            'feedbacks'            => $feedbacks->map(fn($f) => [
                'id'              => $f->id,
                'rating'          => $f->rating,
                'sentiment_label' => $f->sentiment_label,
                'sentiment_score' => $f->sentiment_score,
                'comment'         => $f->comment,
                'counter_name'    => $f->counter?->name ?? 'Unknown',
                'branch_name'     => $f->counter?->branch?->name ?? 'Unknown',
                'submitted_at'    => $f->created_at->format('Y-m-d H:i'),
            ]),
        ]);
    }

    /**
     * Store a newly created user.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => 'required|string|email|max:255|unique:users',
            'password'  => 'required|string|min:8',
            'role'      => 'required|in:super_admin,admin,branch_manager,servicer',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'boolean',
        ]);

        if ($redirect = $this->validateBranchRule($validated)) {
            return $redirect;
        }

        // Check if user can create this type of user
        if ($redirect = $this->canManageUserType($validated)) {
            return $redirect;
        }

        // Global roles must not be tied to a branch
        if (in_array($validated['role'], ['super_admin', 'admin'])) {
            $validated['branch_id'] = null;
        }

        $validated['password'] = Hash::make($validated['password']);

        User::create($validated);

        return redirect()->route('admin.users.index')
            ->with('success', 'User created successfully.');
    }

    /**
     * Update the specified user.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return $redirect;
        }

        $validated = $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password'  => 'nullable|string|min:8',
            'role'      => 'required|in:super_admin,admin,branch_manager,servicer',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'boolean',
        ]);

        if ($redirect = $this->validateBranchRule($validated)) {
            return $redirect;
        }

        // Check if user can update to this role and branch
        if ($redirect = $this->canManageUserType($validated)) {
            return $redirect;
        }

        if (in_array($validated['role'], ['super_admin', 'admin'])) {
            $validated['branch_id'] = null;
        }

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return redirect()->route('admin.users.index')
            ->with('success', 'User updated successfully.');
    }

    /**
     * Toggle the active status of the user.
     */
    public function toggle(User $user): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return $redirect;
        }

        $user->update(['is_active' => ! $user->is_active]);

        $status = $user->is_active ? 'activated' : 'deactivated';

        return redirect()->route('admin.users.index')
            ->with('success', "{$user->name} {$status} successfully.");
    }

    /**
     * Generate (or regenerate) a QR login token for a servicer.
     */
    public function generateQrToken(User $user): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return $redirect;
        }

        if (! $user->isServicer()) {
            return redirect()->route('admin.users.index')
                ->with('error', 'Only servicers can have QR tokens.');
        }

        $user->qrTokens()->update(['is_active' => false]);
        $user->qrTokens()->create([
            'token'     => Str::random(64),
            'is_active' => true,
        ]);

        return redirect()->route('admin.users.index')
            ->with('success', "QR token generated for {$user->name}.");
    }

    /**
     * Revoke the active QR token for a servicer.
     */
    public function revokeQrToken(User $user): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return $redirect;
        }

        if (! $user->isServicer()) {
            return redirect()->route('admin.users.index')
                ->with('error', 'Only servicers can have QR tokens.');
        }

        $user->qrTokens()->update(['is_active' => false]);

        return redirect()->route('admin.users.index')
            ->with('success', "QR token revoked for {$user->name}.");
    }

    /**
     * Send a password reset link to the user.
     */
    public function resetPassword(User $user): RedirectResponse
    {
        try {
            // Use Laravel's built-in password reset broker
            \Password::sendResetLink(['email' => $user->email]);

            return redirect()->route('admin.users.index')
                ->with('success', "Password reset email sent to {$user->email}.");
        } catch (\Exception $e) {
            return redirect()->route('admin.users.index')
                ->with('error', 'Failed to send password reset email.');
        }
    }

    /**
     * Soft-delete the specified user.
     */
    public function destroy(User $user): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeUserAccess($user)) {
            return $redirect;
        }

        if ($user->isCurrentlyActive()) {
            return redirect()->route('admin.users.index')
                ->with('error', 'Cannot delete a user with an active session.');
        }

        $user->delete();

        return redirect()->route('admin.users.index')
            ->with('success', 'User deleted successfully.');
    }
}
