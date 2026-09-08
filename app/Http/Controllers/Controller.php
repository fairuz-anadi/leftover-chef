<?php

namespace App\Http\Controllers;

use App\Models\FridgeSession;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Str;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /**
     * The fridge this request belongs to.
     *
     * Put there by ResolveFridgeSession. The fallback only fires for requests
     * that skipped the api middleware group, which in practice means a test
     * calling a controller directly.
     */
    protected function fridge(Request $request): FridgeSession
    {
        return $request->attributes->get('fridge')
            ?? FridgeSession::forId((string) Str::uuid());
    }
}
