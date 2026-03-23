<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAdminAccess();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255|unique:branches,name,' . $this->route('branch')->id,
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ];
    }
}
