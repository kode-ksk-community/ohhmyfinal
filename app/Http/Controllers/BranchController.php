<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    use AuthorizesRequests;

    /**
     * Check if user has permission to manage branches.
     * Only super_admin and admin can manage branches.
     */
    private function checkBranchManagementAccess(): ?RedirectResponse
    {
        $user = auth()->user();
        if ($user && !in_array($user->role, ['super_admin', 'admin'])) {
            return redirect()->back()
                ->with('error', 'You do not have permission to manage branches.');
        }
        return null;
    }

    /**
     * Shared query: always include counts and format dates consistently.
     */
    private function branchQuery()
    {
        return Branch::withCount(['counters', 'feedbacks'])
            ->orderBy('created_at', 'desc');
    }

    /**
     * Map a Branch model to the shape the frontend expects.
     */
    private function formatBranch(Branch $branch): array
    {
        return [
            'id'             => $branch->id,
            'name'           => $branch->name,
            'address'        => $branch->address,
            'phone'          => $branch->phone,
            'is_active'      => (bool) $branch->is_active,
            'counters_count' => $branch->counters_count ?? 0,
            'feedback_count' => $branch->feedbacks_count ?? 0,
            'created_at'     => $branch->created_at->format('Y-m-d'),
        ];
    }

    /**
     * Display the admin branches page.
     */
    public function index(): Response
    {
        $user = auth()->user();

        $query = $this->branchQuery();

        // Branch managers can only see their own branch
        if ($user && $user->role === 'branch_manager') {
            $query->where('id', $user->branch_id);
        }

        $branches = $query->get()
            ->map(fn($b) => $this->formatBranch($b));

        return Inertia::render('admin/branches', [
            'branches' => $branches,
        ]);
    }

    /**
     * Store a newly created branch.
     */
    public function store(Request $request): RedirectResponse
    {
        if ($redirect = $this->checkBranchManagementAccess()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name'      => 'required|string|max:255',
            'address'   => 'nullable|string|max:500',
            'phone'     => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        Branch::create($validated);

        return redirect()->route('admin.branches.index')
            ->with('success', 'Branch created successfully.');
    }

    /**
     * Update the specified branch.
     */
    public function update(Request $request, Branch $branch): RedirectResponse
    {
        if ($redirect = $this->checkBranchManagementAccess()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name'      => 'required|string|max:255',
            'address'   => 'nullable|string|max:500',
            'phone'     => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        $branch->update($validated);

        return redirect()->route('admin.branches.index')
            ->with('success', 'Branch updated successfully.');
    }

    /**
     * Toggle the active status of the branch.
     */
    public function toggle(Branch $branch): RedirectResponse
    {
        if ($redirect = $this->checkBranchManagementAccess()) {
            return $redirect;
        }

        $branch->update(['is_active' => ! $branch->is_active]);

        $status = $branch->is_active ? 'activated' : 'deactivated';

        return redirect()->route('admin.branches.index')
            ->with('success', "Branch {$status} successfully.");
    }

    /**
     * Soft-delete the specified branch.
     */
    public function destroy(Branch $branch): RedirectResponse
    {
        if ($redirect = $this->checkBranchManagementAccess()) {
            return $redirect;
        }

        $branch->delete();

        return redirect()->route('admin.branches.index')
            ->with('success', 'Branch deleted successfully.');
    }
}
