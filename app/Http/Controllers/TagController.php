<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class TagController extends Controller
{
    /**
     * Display the admin tags page with all tags data.
     */
    public function index(): Response
    {
        $tags = Tag::with(['branch'])
            ->withCount('feedbacks')
            ->orderBy('sort_order', 'asc')
            ->get()
            ->map(function ($tag) {
                return [
                    'id' => $tag->id,
                    'branch_id' => $tag->branch_id,
                    'branch_name' => $tag->branch?->name,
                    'name' => $tag->name,
                    'name_kh' => $tag->name_kh,
                    'color' => $tag->color,
                    'icon' => $tag->icon,
                    'emoji_levels' => $tag->emoji_levels,
                    'sentiment' => $tag->sentiment,
                    'sort_order' => $tag->sort_order,
                    'is_active' => $tag->is_active,
                    'usage_count' => $tag->feedbacks_count,
                ];
            });

        $branches = Branch::active()
            ->select('id', 'name')
            ->orderBy('name', 'asc')
            ->get();

        return Inertia::render('admin/tags', [
            'tags' => $tags,
            'branches' => $branches,
        ]);
    }

    /**
     * Store a newly created tag.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_kh' => 'nullable|string|max:255',
            'color' => 'required|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'icon' => 'nullable|string|max:4',
            'sentiment' => 'required|in:very_positive,positive,neutral,negative,very_negative',
            'branch_id' => 'nullable|exists:branches,id',
            'sort_order' => 'integer|min:0|max:9999',
            'is_active' => 'boolean',
        ]);

        $tag = Tag::create($validated);

        // Load relationships for response
        $tag->load('branch');
        $tag->loadCount('feedbacks');

        return response()->json([
            'id' => $tag->id,
            'branch_id' => $tag->branch_id,
            'branch_name' => $tag->branch?->name,
            'name' => $tag->name,
            'name_kh' => $tag->name_kh,
            'color' => $tag->color,
            'icon' => $tag->icon,
            'sentiment' => $tag->sentiment,
            'sort_order' => $tag->sort_order,
            'is_active' => $tag->is_active,
            'usage_count' => $tag->feedbacks_count,
        ], 201);
    }

    /**
     * Update the specified tag.
     */
    public function update(Request $request, Tag $tag): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_kh' => 'nullable|string|max:255',
            'color' => 'required|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'icon' => 'nullable|string|max:4',
            'sentiment' => 'required|in:very_positive,positive,neutral,negative,very_negative',
            'branch_id' => 'nullable|exists:branches,id',
            'sort_order' => 'integer|min:0|max:9999',
            'is_active' => 'boolean',
        ]);

        $tag->update($validated);

        // Load relationships for response
        $tag->load('branch');
        $tag->loadCount('feedbacks');

        return response()->json([
            'id' => $tag->id,
            'branch_id' => $tag->branch_id,
            'branch_name' => $tag->branch?->name,
            'name' => $tag->name,
            'name_kh' => $tag->name_kh,
            'color' => $tag->color,
            'icon' => $tag->icon,
            'sentiment' => $tag->sentiment,
            'sort_order' => $tag->sort_order,
            'is_active' => $tag->is_active,
            'usage_count' => $tag->feedbacks_count,
        ]);
    }

    /**
     * Toggle the active status of a tag.
     */
    public function toggle(Tag $tag): JsonResponse
    {
        $tag->update(['is_active' => !$tag->is_active]);

        return response()->json([
            'is_active' => $tag->is_active,
            'message' => "Tag {$tag->name} " . ($tag->is_active ? 'activated' : 'deactivated'),
        ]);
    }

    /**
     * Remove (soft delete) the specified tag.
     */
    public function destroy(Tag $tag): JsonResponse
    {
        $tag->delete();

        return response()->json([
            'message' => "Tag '{$tag->name}' deleted successfully",
        ]);
    }
}
