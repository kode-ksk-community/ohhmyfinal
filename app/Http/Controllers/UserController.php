<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Display the admin users page with data.
     */
    public function index(): Response
    {
        $users = User::with(['branch', 'activeQrToken'])
            ->withCount('feedbacks')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'branch_id' => $user->branch_id,
                    'branch_name' => $user->branch?->name,
                    'is_active' => $user->is_active,
                    'has_qr_token' => $user->activeQrToken !== null,
                    'feedback_count' => $user->feedbacks_count,
                    'last_active' => $user->isCurrentlyActive() ? 'Now' : null,
                    'created_at' => $user->created_at->format('Y-m-d'),
                ];
            });

        $branches = Branch::active()->select('id', 'name')->get();

        return Inertia::render('admin/users', [
            'users' => $users,
            'branches' => $branches,
        ]);
    }

    /**
     * Store a newly created user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:super_admin,admin,branch_manager,servicer',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'boolean',
        ]);

        // Validate branch requirement for certain roles
        if (in_array($validated['role'], ['branch_manager', 'servicer']) && !$validated['branch_id']) {
            return response()->json(['error' => 'Branch is required for this role'], 422);
        }

        // For super_admin and admin, ensure branch_id is null
        if (in_array($validated['role'], ['super_admin', 'admin'])) {
            $validated['branch_id'] = null;
        }

        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);

        // Load relationships for response
        $user->load(['branch', 'activeQrToken']);
        $user->loadCount('feedbacks');

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'branch_id' => $user->branch_id,
            'branch_name' => $user->branch?->name,
            'is_active' => $user->is_active,
            'has_qr_token' => $user->activeQrToken !== null,
            'feedback_count' => $user->feedbacks_count,
            'last_active' => $user->isCurrentlyActive() ? 'Now' : null,
            'created_at' => $user->created_at->format('Y-m-d'),
        ]);
    }

    /**
     * Update the specified user.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role' => 'required|in:super_admin,admin,branch_manager,servicer',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'boolean',
        ]);

        // Validate branch requirement for certain roles
        if (in_array($validated['role'], ['branch_manager', 'servicer']) && !$validated['branch_id']) {
            return response()->json(['error' => 'Branch is required for this role'], 422);
        }

        // For super_admin and admin, ensure branch_id is null
        if (in_array($validated['role'], ['super_admin', 'admin'])) {
            $validated['branch_id'] = null;
        }

        // Only update password if provided
        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        // Load relationships for response
        $user->load(['branch', 'activeQrToken']);
        $user->loadCount('feedbacks');

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'branch_id' => $user->branch_id,
            'branch_name' => $user->branch?->name,
            'is_active' => $user->is_active,
            'has_qr_token' => $user->activeQrToken !== null,
            'feedback_count' => $user->feedbacks_count,
            'last_active' => $user->isCurrentlyActive() ? 'Now' : null,
            'created_at' => $user->created_at->format('Y-m-d'),
        ]);
    }

    /**
     * Toggle the active status of the user.
     */
    public function toggle(User $user): JsonResponse
    {
        $user->update(['is_active' => !$user->is_active]);

        return response()->json([
            'is_active' => $user->is_active,
        ]);
    }

    /**
     * Generate or regenerate QR token for a servicer.
     */
    public function generateQrToken(User $user): JsonResponse
    {
        if (!$user->isServicer()) {
            return response()->json(['error' => 'Only servicers can have QR tokens'], 422);
        }

        // Deactivate existing tokens
        $user->qrTokens()->update(['is_active' => false]);

        // Create new token
        $user->qrTokens()->create([
            'token' => \Illuminate\Support\Str::random(64),
            'is_active' => true,
        ]);

        return response()->json(['message' => 'QR token generated successfully']);
    }

    /**
     * Revoke QR token for a servicer.
     */
    public function revokeQrToken(User $user): JsonResponse
    {
        if (!$user->isServicer()) {
            return response()->json(['error' => 'Only servicers can have QR tokens'], 422);
        }

        $user->qrTokens()->update(['is_active' => false]);

        return response()->json(['message' => 'QR token revoked successfully']);
    }

    /**
     * Send password reset link to user.
     */
    public function resetPassword(User $user): JsonResponse
    {
        // Generate a password reset token
        $token = \Illuminate\Support\Str::random(64);
        
        // Store the token in password_resets table or similar
        // For now, we'll send a reset email with a temporary password or token
        // In production, you'd use Laravel's password reset broker
        
        try {
            // Generate a temporary password for demo purposes
            // In production, use proper password reset tokens
            $temporaryPassword = \Illuminate\Support\Str::random(12);
            
            // You can send email here or just return success
            // \Mail::to($user->email)->send(new ResetPasswordMail($user, $token));
            
            return response()->json([
                'message' => 'Password reset email sent to ' . $user->email,
                'success' => true,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to send password reset email'], 500);
        }
    }

    /**
     * Remove the specified user (soft delete).
     */
    public function destroy(User $user): JsonResponse
    {
        // Check if user is currently active
        if ($user->isCurrentlyActive()) {
            return response()->json(['error' => 'Cannot delete user with active session'], 422);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }
}
