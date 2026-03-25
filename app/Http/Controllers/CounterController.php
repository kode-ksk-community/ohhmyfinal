<?php

namespace App\Http\Controllers;

use App\Models\Counter;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Hash;

class CounterController extends Controller
{
    /**
     * Shared eager-load query for counters.
     */
    private function counterQuery()
    {
        return Counter::with(['branch', 'activeSession.servicer'])
            ->withCount('feedbacks')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Map a Counter model to the shape the frontend expects.
     */
    private function formatCounter(Counter $counter): array
    {
        return [
            'id'               => $counter->id,
            'branch_id'        => $counter->branch_id,
            'branch_name'      => $counter->branch->name,
            'name'             => $counter->name,
            'description'      => $counter->description,
            'is_active'        => (bool) $counter->is_active,
            'is_occupied'      => $counter->isOccupied(),
            'current_servicer' => $counter->currentServicer()?->name,
            'feedback_count'   => $counter->feedbacks_count ?? 0,
            'device_token'     => $counter->device_token,
            'created_at'       => $counter->created_at->format('Y-m-d'),
        ];
    }

    /**
     * Display the admin counters page.
     */
    public function index(): Response
    {
        $counters = $this->counterQuery()
            ->get()
            ->map(fn($c) => $this->formatCounter($c));

        $branches = Branch::active()->select('id', 'name')->get();

        return Inertia::render('admin/counters', [
            'counters' => $counters,
            'branches' => $branches,
        ]);
    }

    /**
     * Store a newly created counter.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'branch_id'   => 'required|exists:branches,id',
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'pin'         => 'required|string|min:4|max:10',
            'is_active'   => 'boolean',
        ]);

        $validated['pin'] = Hash::make($validated['pin']);

        Counter::create($validated);

        return redirect()->route('admin.counters.index')
            ->with('success', 'Counter created successfully.');
    }

    /**
     * Update the specified counter.
     */
    public function update(Request $request, Counter $counter): RedirectResponse
    {
        $validated = $request->validate([
            'branch_id'   => 'required|exists:branches,id',
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'pin'         => 'nullable|string|min:4|max:10',
            'is_active'   => 'boolean',
        ]);

        // Only re-hash if a new PIN was provided
        if (!empty($validated['pin'])) {
            $validated['pin'] = Hash::make($validated['pin']);
        } else {
            unset($validated['pin']);
        }

        $counter->update($validated);

        return redirect()->route('admin.counters.index')
            ->with('success', 'Counter updated successfully.');
    }

    /**
     * Toggle the active status of the counter.
     */
    public function toggle(Counter $counter): RedirectResponse
    {
        $counter->update(['is_active' => ! $counter->is_active]);

        $status = $counter->is_active ? 'activated' : 'deactivated';

        return redirect()->route('admin.counters.index')
            ->with('success', "Counter {$status} successfully.");
    }

    /**
     * Force-end the active session on a counter.
     */
    public function forceEndSession(Counter $counter): RedirectResponse
    {
        if ($counter->activeSession) {
            $counter->activeSession->update(['ended_at' => now()]);
        }

        return redirect()->route('admin.counters.index')
            ->with('success', 'Session ended successfully.');
    }

    /**
     * Soft-delete the specified counter.
     * Guards against deletion while a session is active.
     */
    public function destroy(Counter $counter): RedirectResponse
    {
        if ($counter->isOccupied()) {
            return redirect()->route('admin.counters.index')
                ->with('error', 'Cannot delete a counter with an active session. Please end the session first.');
        }

        $counter->delete();

        return redirect()->route('admin.counters.index')
            ->with('success', 'Counter deleted successfully.');
    }
}