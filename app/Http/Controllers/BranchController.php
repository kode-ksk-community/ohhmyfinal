<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    /**
     * Display the admin branches page with data.
     */
    public function index(): Response
    {
        $branches = Branch::withCount(['counters', 'feedbacks'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($branch) {
                return [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'address' => $branch->address,
                    'phone' => $branch->phone,
                    'is_active' => $branch->is_active,
                    'counters_count' => $branch->counters_count,
                    'feedback_count' => $branch->feedbacks_count,
                    'created_at' => $branch->created_at->format('Y-m-d'),
                ];
            });

        return Inertia::render('admin/branches', [
            'branches' => $branches,
        ]);
    }

    /**
     * Store a newly created branch.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        $branch = Branch::create($validated);

        // Load counts for response
        $branch->loadCount(['counters', 'feedbacks']);

        return back();
    }

    /**
     * Update the specified branch.
     */
    public function update(Request $request, Branch $branch): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        $branch->update($validated);

        // Load counts for response
        $branch->loadCount(['counters', 'feedbacks']);

        return response()->json([
            'id' => $branch->id,
            'name' => $branch->name,
            'address' => $branch->address,
            'phone' => $branch->phone,
            'is_active' => $branch->is_active,
            'counters_count' => $branch->counters_count,
            'feedback_count' => $branch->feedbacks_count,
            'created_at' => $branch->created_at->format('Y-m-d'),
        ]);
    }

    /**
     * Toggle the active status of the branch.
     */
    public function toggle(Branch $branch): JsonResponse
    {
        $branch->update(['is_active' => !$branch->is_active]);

        return response()->json([
            'is_active' => $branch->is_active,
        ]);
    }

    /**
     * Remove the specified branch (soft delete).
     */
    public function destroy(Branch $branch): JsonResponse
    {
        $branch->delete();

        return response()->json(['message' => 'Branch deleted successfully']);
    }
}
