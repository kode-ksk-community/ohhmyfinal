<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCounterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAdminAccess();
    }

    public function rules(): array
    {
        return [
            'branch_id' => 'required|exists:branches,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'pin' => 'required|string|min:4|max:10|regex:/^\d+$/',
            'is_active' => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'pin.regex' => 'The PIN must contain only digits.',
        ];
    }
}
