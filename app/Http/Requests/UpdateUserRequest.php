<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAdminAccess();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($this->route('user'))],
            'password' => 'nullable|string|min:8|confirmed',
            'role' => 'required|in:super_admin,admin,branch_manager,servicer',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'password.confirmed' => 'The password confirmation does not match.',
            'role.in' => 'The selected role is invalid.',
        ];
    }
}
