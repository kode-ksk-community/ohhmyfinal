<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class TagController extends Controller
{
    /**
     * Authorize tag access - checks if user can access this tag.
     */
    private function authorizeTagAccess(Tag $tag): ?RedirectResponse
    {
        $user = auth()->user();
        if ($user && $user->role === 'branch_manager' && $tag->branch_id !== $user->branch_id) {
            return redirect()->back()
                ->with('error', 'You do not have permission to access this tag.');
        }
        return null;
    }

    /**
     * Check if user can only manage their branch's tags.
     */
    private function canCreateTag(?int $branchId): ?RedirectResponse
    {
        $user = auth()->user();
        if ($user && $user->role === 'branch_manager' && $branchId !== $user->branch_id) {
            return redirect()->back()
                ->with('error', 'You can only manage tags for your own branch.');
        }
        return null;
    }

    /**
     * Shared eager-load query for tags.
     */
    private function tagQuery()
    {
        return Tag::with('branch')
            ->withCount('feedbacks')
            ->orderBy('sort_order', 'asc');
    }

    /**
     * Map a Tag model to the shape the frontend expects.
     */
    private function formatTag(Tag $tag): array
    {
        return [
            'id'           => $tag->id,
            'branch_id'    => $tag->branch_id,
            'branch_name'  => $tag->branch?->name,
            'name'         => $tag->name,
            'name_kh'      => $tag->name_kh,
            'color'        => $tag->color,
            'icon'         => $tag->icon,
            'emoji_levels' => $tag->emoji_levels,
            'sentiment'    => $tag->sentiment,
            'sort_order'   => $tag->sort_order,
            'is_active'    => (bool) $tag->is_active,
            'usage_count'  => $tag->feedbacks_count ?? 0,
        ];
    }

    /**
     * Display the admin tags page.
     */
    public function index(): Response
    {
        $user = auth()->user();

        $query = $this->tagQuery();

        // Branch managers can only see tags for their branch
        if ($user && $user->role === 'branch_manager') {
            $query->where('branch_id', $user->branch_id);
        }

        $tags = $query->get()
            ->map(fn($t) => $this->formatTag($t));

        $branchesQuery = Branch::active()
            ->select('id', 'name')
            ->orderBy('name');

        // Branch managers can only see their own branch
        if ($user && $user->role === 'branch_manager') {
            $branchesQuery->where('id', $user->branch_id);
        }

        return Inertia::render('admin/tags', [
            'tags'     => $tags,
            'branches' => $branchesQuery->get(),
        ]);
    }

    /**
     * Store a newly created tag.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'       => 'required|string|max:255',
            'name_kh'    => 'nullable|string|max:255',
            'color'      => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon'       => 'nullable|string|max:4',
            'sentiment'  => 'required|in:very_positive,positive,neutral,negative,very_negative',
            'branch_id'  => 'nullable|exists:branches,id',
            'sort_order' => 'integer|min:0|max:9999',
            'is_active'  => 'boolean',
        ]);

        // Check if user can create tag in this branch
        if ($redirect = $this->canCreateTag($validated['branch_id'])) {
            return $redirect;
        }

        Tag::create($validated);

        return redirect()->route('admin.tags.index')
            ->with('success', 'Tag created successfully.');
    }

    /**
     * Update the specified tag.
     */
    public function update(Request $request, Tag $tag): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeTagAccess($tag)) {
            return $redirect;
        }

        $validated = $request->validate([
            'name'       => 'required|string|max:255',
            'name_kh'    => 'nullable|string|max:255',
            'color'      => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon'       => 'nullable|string|max:4',
            'sentiment'  => 'required|in:very_positive,positive,neutral,negative,very_negative',
            'branch_id'  => 'nullable|exists:branches,id',
            'sort_order' => 'integer|min:0|max:9999',
            'is_active'  => 'boolean',
        ]);

        // Check if user can update to this branch
        if ($redirect = $this->canCreateTag($validated['branch_id'])) {
            return $redirect;
        }

        $tag->update($validated);

        return redirect()->route('admin.tags.index')
            ->with('success', 'Tag updated successfully.');
    }

    /**
     * Toggle the active status of a tag.
     */
    public function toggle(Tag $tag): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeTagAccess($tag)) {
            return $redirect;
        }

        $tag->update(['is_active' => ! $tag->is_active]);

        $status = $tag->is_active ? 'activated' : 'deactivated';

        return redirect()->route('admin.tags.index')
            ->with('success', "\"{$tag->name}\" {$status} successfully.");
    }

    /**
     * Soft-delete the specified tag.
     */
    public function destroy(Tag $tag): RedirectResponse
    {
        // Check authorization
        if ($redirect = $this->authorizeTagAccess($tag)) {
            return $redirect;
        }

        $name = $tag->name;
        $tag->delete();

        return redirect()->route('admin.tags.index')
            ->with('success', "\"{$name}\" deleted successfully.");
    }
}
