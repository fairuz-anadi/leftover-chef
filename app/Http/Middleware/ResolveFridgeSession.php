<?php

namespace App\Http\Middleware;

use App\Models\FridgeSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Attaches the caller's fridge to the request.
 *
 * The client sends `X-Fridge-Session`, an id it generated once and keeps in
 * localStorage. Nothing about it is a credential — it identifies a fridge, not
 * a person, and there is nothing behind it worth stealing. It exists so that
 * two browsers on the same laptop do not share a shelf, and so the demo fridge
 * survives a page reload.
 *
 * A request without the header still works: it gets a throwaway session. That
 * keeps curl and the offline-check script usable without ceremony.
 */
class ResolveFridgeSession
{
    public const HEADER = 'X-Fridge-Session';

    public function handle(Request $request, Closure $next)
    {
        $id = (string) $request->header(self::HEADER, '');

        // Anything unrecognisable becomes a fresh id rather than an error —
        // there is no attack worth defending against here, only a fridge to
        // find, and a 400 in the middle of a demo helps nobody.
        if (!preg_match('/^[A-Za-z0-9_-]{8,64}$/', $id)) {
            $id = (string) Str::uuid();
        }

        $request->attributes->set('fridge', FridgeSession::forId($id));

        return $next($request);
    }
}
