<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Where to send an unauthenticated visitor.
     *
     * Nowhere. This is an API with a React client in front of it and no `login`
     * named route, so the inherited `route('login')` threw
     * RouteNotFoundException, and every unauthenticated request that did not
     * explicitly ask for JSON came back 500 instead of 401 — including the
     * client's own boot-time GET /api/me.
     *
     * Returning null keeps the framework from building that URL at all;
     * App\Exceptions\Handler turns the AuthenticationException into a 401.
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
