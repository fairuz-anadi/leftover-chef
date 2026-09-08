<?php

namespace Tests\Feature;

use App\Http\Services\FreshnessService;
use App\Models\FridgeSession;
use App\Models\Ingredient;
use App\Models\PantryItem;
use Database\Seeders\IngredientSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The loop the proposal describes: detect → track → warn → cook → measure.
 *
 * These cover the five core features that are not the detector: shelf-life
 * tracking, the three freshness tiers, the health dashboard, the simulated
 * notification behind the fast-forward button, and the waste counter.
 */
class FridgeLoopTest extends TestCase
{
    use RefreshDatabase;

    private const SESSION = 'test-fridge-session-01';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(IngredientSeeder::class);
    }

    private function fridge(string $session = self::SESSION)
    {
        return $this->withHeader('X-Fridge-Session', $session);
    }

    private function fridgeFor(string $session = self::SESSION): FridgeSession
    {
        return FridgeSession::forId($session);
    }

    private function stock(array $items, string $session = self::SESSION): void
    {
        $fridge = $this->fridgeFor($session);

        foreach ($items as $name => $daysLeft) {
            PantryItem::create([
                'session_id' => $fridge->session_id,
                'ingredient_id' => Ingredient::lookup($name)->id,
                'expires_on' => $daysLeft === null ? null : $fridge->today()->copy()->addDays($daysLeft),
            ]);
        }
    }

    // -- no accounts ----------------------------------------------------

    public function test_the_app_opens_without_signing_in_and_stocks_a_demo_fridge(): void
    {
        $response = $this->fridge()->getJson('/api/fridge')->assertOk();

        $this->assertGreaterThan(10, count($response->json('items')));
        $this->assertSame(0, $response->json('session.day_offset'));
    }

    public function test_two_browsers_do_not_share_a_fridge(): void
    {
        $this->fridge('session-a')->getJson('/api/fridge')->assertOk();
        $this->fridge('session-a')->postJson('/api/fridge/items', ['name' => 'Mango'])->assertCreated();

        $names = collect($this->fridge('session-b')->getJson('/api/fridge')->json('items'))->pluck('name');

        $this->assertFalse($names->contains('Mango'), 'one session must not see another session\'s shelf');
    }

    // -- tiered freshness ------------------------------------------------

    public function test_the_three_tiers_land_on_the_right_days(): void
    {
        $this->stock([
            'Spinach' => -2,   // overdue
            'Milk' => 0,       // today
            'Yoghurt' => 1,
            'Tomato' => 3,     // last amber day
            'Bell Pepper' => 4, // first green day
            'Rice' => null,
        ]);

        $items = collect($this->fridge()->getJson('/api/fridge')->json('items'))->keyBy('name');

        $this->assertSame('today', $items['Spinach']['freshness']['tier']);
        $this->assertSame('today', $items['Milk']['freshness']['tier']);
        $this->assertSame('soon', $items['Yoghurt']['freshness']['tier']);
        $this->assertSame('soon', $items['Tomato']['freshness']['tier']);
        $this->assertSame('fresh', $items['Bell Pepper']['freshness']['tier']);
        // Salt and rice do not expire; a countdown on them would be noise.
        $this->assertNull($items['Rice']['freshness']);
    }

    public function test_overdue_food_is_labelled_honestly_rather_than_hidden(): void
    {
        $this->stock(['Spinach' => -3]);

        $spinach = collect($this->fridge()->getJson('/api/fridge')->json('items'))
            ->firstWhere('name', 'Spinach');

        $this->assertSame('3 days over', $spinach['freshness']['label']);
        // JSON hands 0.0 back as an int, so compare loosely on the value.
        $this->assertEquals(0, $spinach['freshness']['life_remaining'], 'an empty bar, not a negative one');
    }

    public function test_the_worst_thing_in_the_fridge_is_listed_first(): void
    {
        $this->stock(['Onion' => 20, 'Spinach' => 1, 'Milk' => -1, 'Tomato' => 5]);

        $names = collect($this->fridge()->getJson('/api/fridge')->json('items'))->pluck('name');

        $this->assertSame(['Milk', 'Spinach', 'Tomato', 'Onion'], $names->all());
    }

    // -- fridge health dashboard -----------------------------------------

    public function test_the_health_dial_counts_each_tier(): void
    {
        $this->stock([
            'Spinach' => 0,
            'Milk' => 2,
            'Yoghurt' => 2,
            'Tomato' => 10,
            'Onion' => 20,
            'Rice' => null,
        ]);

        $health = $this->fridge()->getJson('/api/fridge')->json('health');

        $this->assertSame(6, $health['total']);
        $this->assertSame(1, $health['today']);
        $this->assertSame(2, $health['soon']);
        $this->assertSame(2, $health['fresh']);
        $this->assertSame(3, $health['at_risk']);
        $this->assertSame(1, $health['undated'], 'staples are counted separately, not as fresh');
        $this->assertSame(40, $health['score'], '2 of 5 dated items are fresh');
    }

    // -- the fast-forward clock and its notification ----------------------

    public function test_fast_forward_moves_every_countdown_at_once(): void
    {
        $this->stock(['Tomato' => 5]);

        $before = collect($this->fridge()->getJson('/api/fridge')->json('items'))->firstWhere('name', 'Tomato');
        $this->assertSame(5, $before['freshness']['days_left']);

        $this->fridge()->postJson('/api/fridge/fast-forward', ['days' => 2])->assertOk();

        $after = collect($this->fridge()->getJson('/api/fridge')->json('items'))->firstWhere('name', 'Tomato');
        $this->assertSame(3, $after['freshness']['days_left']);
        $this->assertSame(2, $this->fridgeFor()->fresh()->day_offset);
    }

    public function test_only_things_that_just_turned_red_raise_a_notification(): void
    {
        // Milk is already red and stays red; the chicken crosses over today.
        $this->stock(['Milk' => 0, 'Chicken Breast' => 1, 'Onion' => 20]);

        $alerts = $this->fridge()->postJson('/api/fridge/fast-forward', ['days' => 1])->json('alerts');

        $this->assertSame(['Chicken Breast'], collect($alerts)->pluck('name')->all(),
            'an item that was already red yesterday is not news');
    }

    public function test_a_quiet_day_raises_nothing(): void
    {
        $this->stock(['Onion' => 20]);

        $this->fridge()->postJson('/api/fridge/fast-forward', ['days' => 1])
            ->assertOk()
            ->assertJsonPath('alerts', []);
    }

    public function test_the_clock_does_not_run_past_the_horizon(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $this->fridge()->postJson('/api/fridge/fast-forward', ['days' => 10])->assertOk();
        }

        $this->assertSame(FridgeSession::MAX_OFFSET, $this->fridgeFor()->fresh()->day_offset);
    }

    // -- the waste counter ------------------------------------------------

    public function test_cooking_records_what_was_saved_and_moves_the_counter(): void
    {
        $this->seed(\Database\Seeders\RecipeSeeder::class);

        $recipe = \App\Models\Recipe::where('title', 'Spaghetti Aglio e Olio')->firstOrFail();
        $required = $recipe->ingredientRecords->reject(fn ($i) => (bool) $i->pivot->is_optional);

        $this->stock(array_fill_keys($required->pluck('name')->all(), 2));

        $response = $this->fridge()->postJson("/api/recipes/{$recipe->id}/cooked")->assertOk();

        $this->assertGreaterThan(0, $response->json('waste.rescued'));
        $this->assertSame(0, $response->json('waste.lost'));
        $this->assertSame(100, $response->json('waste.save_rate'));

        // The cupboard survives: you do not run out of salt by cooking once.
        $left = collect($this->fridge()->getJson('/api/fridge')->json('items'))->pluck('name');
        $this->assertTrue($left->contains('Salt'));
        $this->assertTrue($left->contains('Olive Oil'));
        // …but the perishables it actually used are gone.
        $this->assertFalse($left->contains('Green Chilli'));
    }

    public function test_binning_something_counts_against_the_save_rate(): void
    {
        $this->stock(['Spinach' => -1, 'Onion' => 20]);

        $spinach = collect($this->fridge()->getJson('/api/fridge')->json('items'))
            ->firstWhere('name', 'Spinach');

        $response = $this->fridge()
            ->deleteJson("/api/fridge/items/{$spinach['id']}?binned=1")
            ->assertOk();

        $this->assertSame(1, $response->json('waste.lost'));
        $this->assertSame(0, $response->json('waste.save_rate'), 'nothing saved, one lost');
    }

    public function test_removing_something_by_mistake_is_not_counted_as_waste(): void
    {
        $this->stock(['Onion' => 20]);
        $onion = collect($this->fridge()->getJson('/api/fridge')->json('items'))->firstWhere('name', 'Onion');

        $response = $this->fridge()->deleteJson("/api/fridge/items/{$onion['id']}")->assertOk();

        $this->assertSame(0, $response->json('waste.lost'));
    }

    public function test_you_appear_on_the_leaderboard_against_the_sample_households(): void
    {
        $board = $this->fridge()->getJson('/api/fridge')->json('leaderboard');
        $you = collect($board)->firstWhere('is_you', true);

        $this->assertNotNull($you);
        $this->assertSame(0, $you['rescued']);
        $this->assertCount(6, $board, 'five sample households plus you');
    }

    public function test_you_cannot_touch_another_sessions_fridge(): void
    {
        $this->stock(['Onion' => 20], 'session-a');
        $item = PantryItem::where('session_id', 'session-a')->firstOrFail();

        $this->fridge('session-b')
            ->deleteJson("/api/fridge/items/{$item->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('pantry_items', ['id' => $item->id]);
    }

    // -- shelf-life estimation --------------------------------------------

    public function test_adding_something_by_hand_dates_it_from_its_shelf_life(): void
    {
        $response = $this->fridge()->postJson('/api/fridge/items', ['name' => 'Spinach'])->assertCreated();

        $spinach = collect($response->json('items'))->firstWhere('name', 'Spinach');

        $this->assertSame(3, $spinach['freshness']['days_left'], 'spinach keeps about three days');
        $this->assertTrue($spinach['freshness']['estimated']);
    }

    public function test_a_correction_stops_the_date_being_a_guess(): void
    {
        $this->fridge()->postJson('/api/fridge/items', ['name' => 'Spinach'])->assertCreated();
        $spinach = collect($this->fridge()->getJson('/api/fridge')->json('items'))->firstWhere('name', 'Spinach');

        $response = $this->fridge()->patchJson("/api/fridge/items/{$spinach['id']}", [
            'expires_on' => $this->fridgeFor()->today()->copy()->addDay()->toDateString(),
        ])->assertOk();

        $updated = collect($response->json('items'))->firstWhere('name', 'Spinach');

        $this->assertSame(1, $updated['freshness']['days_left']);
        $this->assertFalse($updated['freshness']['estimated']);
    }

    public function test_reset_puts_the_demo_back_for_the_next_judge(): void
    {
        $this->fridge()->getJson('/api/fridge');
        $this->fridge()->postJson('/api/fridge/fast-forward', ['days' => 5]);

        $item = PantryItem::where('session_id', self::SESSION)->firstOrFail();
        $this->fridge()->deleteJson("/api/fridge/items/{$item->id}?binned=1");

        $response = $this->fridge()->postJson('/api/fridge/reset')->assertOk();

        $this->assertSame(0, $response->json('session.day_offset'));
        $this->assertSame(0, $response->json('waste.lost'));
        $this->assertGreaterThan(10, count($response->json('items')));
    }

    /**
     * Carried forward from Tahmid's hardening of the previous build: cooking
     * one dish must not become a way to empty the whole shelf, however the id
     * list was assembled.
     */
    public function test_cooking_cannot_remove_things_the_recipe_does_not_use(): void
    {
        $this->seed(\Database\Seeders\RecipeSeeder::class);

        $recipe = \App\Models\Recipe::where('title', 'Spaghetti Aglio e Olio')->firstOrFail();
        $required = $recipe->ingredientRecords->reject(fn ($i) => (bool) $i->pivot->is_optional);

        $this->stock(array_fill_keys($required->pluck('name')->all(), 5) + ['Mango' => 5]);

        $everything = PantryItem::where('session_id', self::SESSION)->pluck('id')->all();

        $this->fridge()
            ->postJson("/api/recipes/{$recipe->id}/cooked", ['pantry_item_ids' => $everything])
            ->assertOk();

        $left = collect($this->fridge()->getJson('/api/fridge')->json('items'))->pluck('name');

        $this->assertTrue($left->contains('Mango'), 'a mango has nothing to do with aglio e olio');
    }

    /** Undo must not launder a camera-added item into a hand-typed one. */
    public function test_undo_puts_back_the_scan_provenance_too(): void
    {
        $this->seed(\Database\Seeders\RecipeSeeder::class);

        $this->fridge()->postJson('/api/fridge/scan/confirm', [
            'items' => [['name' => 'Green Chilli', 'detected_as' => 'green chilli pepper', 'confidence' => 0.77]],
        ])->assertCreated();

        $recipe = \App\Models\Recipe::where('title', 'Spaghetti Aglio e Olio')->firstOrFail();
        $removed = $this->fridge()->postJson("/api/recipes/{$recipe->id}/cooked")->json('removed');

        $this->assertSame('green chilli pepper', $removed[0]['detected_as']);

        $this->fridge()->postJson('/api/fridge/restore', ['items' => $removed])->assertOk();

        $back = PantryItem::where('session_id', self::SESSION)
            ->whereHas('ingredient', fn ($q) => $q->where('name', 'Green Chilli'))
            ->firstOrFail();

        $this->assertSame('scan', $back->source);
        $this->assertSame('green chilli pepper', $back->detected_as);
        $this->assertEqualsWithDelta(0.77, $back->confidence, 0.0001);
    }

    public function test_the_freshness_service_agrees_with_itself_about_the_tiers(): void
    {
        $freshness = new FreshnessService();

        $this->assertSame('today', $freshness->tier(-5));
        $this->assertSame('today', $freshness->tier(0));
        $this->assertSame('soon', $freshness->tier(1));
        $this->assertSame('soon', $freshness->tier(FreshnessService::SOON_DAYS));
        $this->assertSame('fresh', $freshness->tier(FreshnessService::SOON_DAYS + 1));

        $this->assertSame(1.0, $freshness->urgency(0));
        $this->assertSame(0.0, $freshness->urgency(FreshnessService::HORIZON_DAYS));
    }

    /**
     * The Android app asks the detector whether it is alive before it saves
     * the laptop's address, and that call creates the session. Stocking used
     * to key off `wasRecentlyCreated`, so by the time the fridge was fetched
     * the row was no longer new and the judge opened on an empty shelf.
     */
    public function test_a_fridge_stocks_even_when_another_endpoint_saw_the_session_first(): void
    {
        $this->fridge('apk-first-run')->getJson('/api/fridge/scan/status')->assertOk();

        $response = $this->fridge('apk-first-run')->getJson('/api/fridge')->assertOk();

        $this->assertNotEmpty(
            $response->json('items'),
            'the fridge opened empty because something touched the session first',
        );
    }

    public function test_an_emptied_fridge_stays_empty_across_a_reload(): void
    {
        $first = $this->fridge('empties-on-purpose')->getJson('/api/fridge')->assertOk();
        $this->assertNotEmpty($first->json('items'));

        foreach ($first->json('items') as $item) {
            $this->fridge('empties-on-purpose')->deleteJson("/api/fridge/items/{$item['id']}")->assertOk();
        }

        // Re-stocking here would undo somebody's deliberate work every time
        // the page reloaded.
        $again = $this->fridge('empties-on-purpose')->getJson('/api/fridge')->assertOk();
        $this->assertSame([], $again->json('items'));
    }

}
