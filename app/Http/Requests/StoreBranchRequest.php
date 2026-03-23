<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAdminAccess();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255|unique:branches',
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'A branch with this name already exists.',
        ];
    }
}
