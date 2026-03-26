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
        $tags = $this->tagQuery()
            ->get()
            ->map(fn($t) => $this->formatTag($t));

        $branches = Branch::active()
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/tags', [
            'tags'     => $tags,
            'branches' => $branches,
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

        Tag::create($validated);

        return redirect()->route('admin.tags.index')
            ->with('success', 'Tag created successfully.');
    }

    /**
     * Update the specified tag.
     */
    public function update(Request $request, Tag $tag): RedirectResponse
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

        $tag->update($validated);

        return redirect()->route('admin.tags.index')
            ->with('success', 'Tag updated successfully.');
    }

    /**
     * Toggle the active status of a tag.
     */
    public function toggle(Tag $tag): RedirectResponse
    {
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
        $name = $tag->name;
        $tag->delete();

        return redirect()->route('admin.tags.index')
            ->with('success', "\"{$name}\" deleted successfully.");
    }
}