<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Everything under /api answers in JSON, whatever the caller asked for.
     *
     * Keying this off Accept alone was a trap. A request without an explicit
     * `Accept: application/json` fell through to the framework handler, which
     * redirects unauthenticated callers to `route('login')` - a route this app
     * does not have, because the front end is a React client. The result was a
     * 500 where a 401 belonged, on the client's own boot-time GET /api/me, and
     * a 302 where a 422 belonged on any multipart POST.
     *
     * The path is the honest signal: /api is an API and has no HTML to serve.
     */
    public function render($request, Throwable $exception)
    {
        if (!$request->expectsJson() && !$request->is('api/*')) {
            return parent::render($request, $exception);
        }

        if ($exception instanceof ValidationException) {
            return response()->json([
                'message' => 'The submitted data is invalid.',
                'errors' => $exception->errors(),
            ], $exception->status);
        }

        if ($exception instanceof AuthenticationException) {
            return response()->json([
                'message' => 'Authentication is required for this action.',
            ], 401);
        }

        if ($exception instanceof ThrottleRequestsException) {
            return response()->json([
                'message' => 'Too many requests. Please try again later.',
            ], 429);
        }

        if ($exception instanceof HttpExceptionInterface) {
            return response()->json([
                'message' => $exception->getMessage() ?: 'The request could not be completed.',
            ], $exception->getStatusCode());
        }

        return response()->json([
            'message' => app()->hasDebugModeEnabled()
                ? $exception->getMessage()
                : 'Server error. Please try again later.',
        ], 500);
    }
}
