<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
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
        $branches = $this->branchQuery()
            ->get()
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
        $branch->delete();

        return redirect()->route('admin.branches.index')
            ->with('success', 'Branch deleted successfully.');
    }
}