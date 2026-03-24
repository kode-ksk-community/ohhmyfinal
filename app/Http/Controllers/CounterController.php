<?php

namespace App\Http\Controllers;

use App\Models\Counter;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Hash;

class CounterController extends Controller
{
    /**
     * Display the admin counters page with data.
     */
    public function index(): Response
    {
        $counters = Counter::with(['branch', 'activeSession.servicer'])
            ->withCount('feedbacks')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($counter) {
                return [
                    'id' => $counter->id,
                    'branch_id' => $counter->branch_id,
                    'branch_name' => $counter->branch->name,
                    'name' => $counter->name,
                    'description' => $counter->description,
                    'is_active' => $counter->is_active,
                    'device_token' => $counter->device_token,
                    'is_occupied' => $counter->isOccupied(),
                    'current_servicer' => $counter->currentServicer()?->name,
                    'feedback_count' => $counter->feedbacks_count,
                    'created_at' => $counter->created_at->format('Y-m-d'),
                ];
            });

        $branches = Branch::active()->select('id', 'name')->get();

        return Inertia::render('admin/counters', [
            'counters' => $counters,
            'branches' => $branches,
        ]);
    }

    /**
     * Store a newly created counter.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'pin' => 'required|string|min:4|max:10',
            'is_active' => 'boolean',
        ]);

        $validated['pin'] = Hash::make($validated['pin']);

        $counter = Counter::create($validated);

        // Load relationships for response
        $counter->load(['branch', 'activeSession.servicer']);
        $counter->loadCount('feedbacks');

        return back()->with('success', 'Counter created successfully');
        // return response()->json([
        //     'id' => $counter->id,
        //     'branch_id' => $counter->branch_id,
        //     'branch_name' => $counter->branch->name,
        //     'name' => $counter->name,
        //     'description' => $counter->description,
        //     'is_active' => $counter->is_active,
        //     'is_occupied' => $counter->isOccupied(),
        //     'current_servicer' => $counter->currentServicer()?->name,
        //     'feedback_count' => $counter->feedbacks_count,
        //     'created_at' => $counter->created_at->format('Y-m-d'),
        // ]);
    }

    /**
     * Update the specified counter.
     */
    public function update(Request $request, Counter $counter): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'pin' => 'nullable|string|min:4|max:10', // PIN optional on update
            'is_active' => 'boolean',
        ]);

        if (!empty($validated['pin'])) {
            $validated['pin'] = Hash::make($validated['pin']);
        } else {
            unset($validated['pin']); // Don't update PIN if not provided
        }

        $counter->update($validated);

        // Load relationships for response
        $counter->load(['branch', 'activeSession.servicer']);
        $counter->loadCount('feedbacks');

        return response()->json([
            'id' => $counter->id,
            'branch_id' => $counter->branch_id,
            'branch_name' => $counter->branch->name,
            'name' => $counter->name,
            'description' => $counter->description,
            'is_active' => $counter->is_active,
            'is_occupied' => $counter->isOccupied(),
            'current_servicer' => $counter->currentServicer()?->name,
            'feedback_count' => $counter->feedbacks_count,
            'created_at' => $counter->created_at->format('Y-m-d'),
        ]);
    }

    /**
     * Toggle the active status of the counter.
     */
    public function toggle(Counter $counter): JsonResponse
    {
        $counter->update(['is_active' => !$counter->is_active]);

        return response()->json([
            'is_active' => $counter->is_active,
        ]);
    }

    /**
     * Force end the active session on the counter.
     */
    public function forceEndSession(Counter $counter): JsonResponse
    {
        if ($counter->activeSession) {
            $counter->activeSession->update(['ended_at' => now()]);
        }

        return response()->json(['message' => 'Session ended successfully']);
    }

    /**
     * Remove the specified counter (soft delete).
     */
    public function destroy(Counter $counter): JsonResponse
    {
        // Check if counter has active session
        if ($counter->isOccupied()) {
            return response()->json(['error' => 'Cannot delete counter with active session'], 422);
        }

        $counter->delete();

        return response()->json(['message' => 'Counter deleted successfully']);
    }
}
