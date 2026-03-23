<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Any device with valid token can submit feedback
        return true;
    }

    public function rules(): array
    {
        return [
            'rating' => 'required|integer|min:1|max:5',
            'tag_ids' => 'nullable|array',
            'tag_ids.*' => 'integer|exists:tags,id',
            'comment' => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'rating.required' => 'Please select a rating.',
            'rating.between' => 'Rating must be between 1 and 5.',
        ];
    }
}
