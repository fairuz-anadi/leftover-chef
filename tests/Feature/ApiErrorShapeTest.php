<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The API answers in JSON status codes, never in redirects.
 *
 * There is no `login` named route here — the client is a React app — so the
 * inherited Authenticate middleware used to throw RouteNotFoundException on
 * any unauthenticated request that did not explicitly ask for JSON. It
 * surfaced as a 500 on the client's own boot-time GET /api/me: harmless in
 * the UI, because the boot code catches everything, and very much not
 * harmless in a network tab with a judge reading it.
 */
class ApiErrorShapeTest extends TestCase
{
    use RefreshDatabase;

    public static function protectedEndpoints(): array
    {
        return [
            'me' => ['GET', '/api/me'],
            'pantry' => ['GET', '/api/pantry'],
            'expiring shelf' => ['GET', '/api/pantry/expiring'],
            'meal plan' => ['GET', '/api/meal-plan'],
            'shopping list' => ['GET', '/api/shopping-list'],
            'confirm scan' => ['POST', '/api/pantry/scan/confirm'],
        ];
    }

    /** @dataProvider protectedEndpoints */
    public function test_protected_endpoints_401_without_an_accept_header(string $method, string $uri): void
    {
        // Deliberately no Accept header — this is the case that used to 500.
        $this->call($method, $uri)->assertStatus(401);
    }

    /** @dataProvider protectedEndpoints */
    public function test_protected_endpoints_401_with_a_json_accept_header(string $method, string $uri): void
    {
        $this->call($method, $uri, [], [], [], ['HTTP_ACCEPT' => 'application/json'])
            ->assertStatus(401)
            ->assertJsonStructure(['message']);
    }

    public function test_public_endpoints_still_answer_without_an_accept_header(): void
    {
        $this->call('GET', '/api/categories')->assertOk();
        $this->call('GET', '/api/ingredients')->assertOk();
        $this->call('GET', '/api/pantry/scan/status')->assertOk();
    }
}
