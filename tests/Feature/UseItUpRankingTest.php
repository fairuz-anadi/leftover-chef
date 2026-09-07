<?php

namespace Tests\Feature;

use App\Http\Services\PantryMatchService;
use App\Http\Services\UseItUpService;
use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\User;
use Database\Seeders\IngredientSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The expiry half of the pitch: recipes that use up food about to go off
 * should outrank recipes that do not, without the ranking becoming a black box.
 */
class UseItUpRankingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(IngredientSeeder::class);
    }

    private function cookWithFridge(array $items): User
    {
        $user = User::factory()->create();

        foreach ($items as $name => $daysLeft) {
            PantryItem::create([
                'user_id' => $user->id,
                'ingredient_id' => Ingredient::lookup($name)->id,
                'expires_on' => $daysLeft === null ? null : now()->addDays($daysLeft),
            ]);
        }

        return $user;
    }

    public function test_urgency_falls_off_over_the_horizon(): void
    {
        $service = new UseItUpService();

        $user = $this->cookWithFridge([
            'Spinach' => -1,   // already past it
            'Milk' => 0,       // today
            'Tomato' => 3,
            'Onion' => 30,     // beyond the horizon
            'Rice' => null,    // no date at all
        ]);

        $urgency = $service->urgencyFor($user)->keyBy('name');

        $this->assertSame(1.0, $urgency['Spinach']['urgency']);
        $this->assertSame('expired', $urgency['Spinach']['state']);
        $this->assertSame(1.0, $urgency['Milk']['urgency']);
        $this->assertSame('today', $urgency['Milk']['state']);
        $this->assertGreaterThan(0, $urgency['Tomato']['urgency']);
        $this->assertLessThan(1, $urgency['Tomato']['urgency']);
        $this->assertSame(0.0, $urgency['Onion']['urgency']);
        $this->assertArrayNotHasKey('Rice', $urgency->all(), 'undated items are not urgent, they are just there');
    }

    public function test_the_expiring_shelf_lists_soonest_first(): void
    {
        $user = $this->cookWithFridge([
            'Tomato' => 3,
            'Spinach' => 1,
            'Milk' => 2,
            'Onion' => 20,
        ]);

        $shelf = (new UseItUpService())->expiringSoon($user);

        $this->assertSame(['Spinach', 'Milk', 'Tomato'], $shelf->pluck('name')->all());
    }

    public function test_only_ingredients_with_time_running_out_count_as_a_rescue(): void
    {
        $service = new UseItUpService();
        $user = $this->cookWithFridge(['Spinach' => 1, 'Onion' => 30]);

        $urgency = $service->urgencyFor($user);
        $ids = $urgency->keys();

        $scored = $service->score($ids, $urgency);

        $this->assertCount(1, $scored['rescues'], 'an onion a month out is not being rescued from anything');
        $this->assertSame('Spinach', $scored['rescues'][0]['name']);
        $this->assertGreaterThan(0, $scored['score']);
    }

    public function test_more_urgent_items_score_higher_but_with_diminishing_returns(): void
    {
        $service = new UseItUpService();
        $user = $this->cookWithFridge(['Spinach' => 1, 'Milk' => 1, 'Tomato' => 1]);
        $urgency = $service->urgencyFor($user);

        $one = $service->score([$urgency->keys()[0]], $urgency)['score'];
        $three = $service->score($urgency->keys(), $urgency)['score'];

        $this->assertGreaterThanOrEqual($one, $three);
        $this->assertLessThan($one * 3, $three, 'a kitchen-sink recipe should not win on volume alone');
    }

    public function test_priority_collapses_to_match_percentage_when_nothing_is_expiring(): void
    {
        // A cook who never sets a date should see exactly the ranking the app
        // had before this feature existed.
        $matcher = app(PantryMatchService::class);

        $this->assertSame(70, $matcher->priority(1.0, 0));
        $this->assertSame(56, $matcher->priority(0.8, 0));
        $this->assertGreaterThan(
            $matcher->priority(0.8, 0),
            $matcher->priority(0.8, 100),
            'rescuing food has to move a recipe up'
        );
    }

    public function test_a_recipe_that_rescues_food_can_outrank_a_better_match(): void
    {
        $matcher = app(PantryMatchService::class);

        // 77% match that saves the spinach beats an 80% match that saves nothing.
        $this->assertGreaterThan(
            $matcher->priority(0.80, 0),
            $matcher->priority(0.77, 44),
        );
    }

    public function test_search_reports_the_expiring_shelf_and_the_rescue_reasons(): void
    {
        $user = $this->cookWithFridge([
            'Onion' => null,
            'Garlic' => null,
            'Tomato' => 1,
            'Olive Oil' => null,
        ]);

        $this->seed(\Database\Seeders\RecipeSeeder::class);

        $response = $this->actingAs($user)->postJson('/api/pantry/search', [
            'use_pantry' => true,
            'max_missing' => 5,
        ]);

        $response->assertOk()
            ->assertJsonPath('meta.expiring_soon.0.name', 'Tomato')
            ->assertJsonStructure([
                'data' => [['use_it_up_score', 'priority_score', 'rescues']],
                'meta' => ['cook_now', 'expiring_soon', 'rescues_waste'],
            ]);

        // Whatever ranks first must be sorted by the score we publish, so the
        // number on screen and the running order cannot drift apart.
        $scores = collect($response->json('data'))->pluck('priority_score')->all();
        $this->assertSame($scores, collect($scores)->sortDesc()->values()->all());
    }
}
