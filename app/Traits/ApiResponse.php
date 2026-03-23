<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

/**
 * ApiResponse Trait
 *
 * Provides standardized JSON response methods for API controllers.
 * Helps maintain consistency and reduces boilerplate code.
 */
trait ApiResponse
{
    /**
     * Return a success response.
     *
     * @param  mixed  $data
     * @param  int    $statusCode
     * @param  string $message
     * @return JsonResponse
     */
    protected function success(mixed $data = null, int $statusCode = 200, string $message = ''): JsonResponse
    {
        $response = [];

        if ($message) {
            $response['message'] = $message;
        }

        if ($data !== null) {
            if (is_array($data)) {
                $response = array_merge($response, $data);
            } else {
                $response['data'] = $data;
            }
        }

        return response()->json($response, $statusCode);
    }

    /**
     * Return an error response.
     *
     * @param  string $message
     * @param  int    $statusCode
     * @param  array  $errors
     * @return JsonResponse
     */
    protected function error(string $message, int $statusCode = 400, array $errors = []): JsonResponse
    {
        $response = ['message' => $message];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $statusCode);
    }

    /**
     * Return a validation error response.
     *
     * @param  array $errors
     * @return JsonResponse
     */
    protected function validationError(array $errors): JsonResponse
    {
        return response()->json([
            'message' => 'Validation failed.',
            'errors'  => $errors,
        ], 422);
    }
}
