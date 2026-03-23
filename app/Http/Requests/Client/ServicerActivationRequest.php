<?php

namespace App\Http\Requests\Client;

use Illuminate\Foundation\Http\FormRequest;

/**
 * ServicerActivationRequest
 *
 * Validates servicer activation requests for counter login.
 * Supports both authenticated (PATH A) and guest (PATH B) flows.
 *
 * PATH A (already logged in):
 *   - counter_token: required
 *
 * PATH B (guest login):
 *   - counter_token: required
 *   - email: nullable but required when not authenticated
 *   - password: nullable but required when not authenticated
 */
class ServicerActivationRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public endpoint — no authorization check needed
        return true;
    }

    public function rules(): array
    {
        $isAuthenticated = auth()->check();

        return [
            'counter_token' => ['required', 'string', 'size:64'],
            'email'         => [
                $isAuthenticated ? 'nullable' : 'required',
                'email',
            ],
            'password'      => [
                $isAuthenticated ? 'nullable' : 'required',
                'string',
                'min:6',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'counter_token.required' => 'Counter token is required.',
            'counter_token.size'     => 'Invalid counter token format.',
            'email.required'         => 'Email address is required.',
            'email.email'            => 'Email must be a valid email address.',
            'password.required'      => 'Password is required.',
            'password.min'           => 'Password must be at least 6 characters.',
        ];
    }
}
