<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTagRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAdminAccess();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'name_kh' => 'nullable|string|max:255',
            'color' => 'required|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'icon' => 'nullable|string|max:4',
            'sentiment' => 'required|in:very_positive,positive,neutral,negative,very_negative',
            'branch_id' => 'nullable|exists:branches,id',
            'sort_order' => 'integer|min:0|max:9999',
            'is_active' => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'color.regex' => 'Color must be a valid hex format (#RRGGBB).',
            'sentiment.in' => 'The sentiment value is invalid.',
        ];
    }
}
