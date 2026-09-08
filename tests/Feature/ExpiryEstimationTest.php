<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\User;
use App\Support\ShelfLifeCatalog;
use Database\Seeders\IngredientSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Expiry estimation on scan.
 *
 * The Use It Up ranking is worth nothing if the dates it reads are never
 * filled in, and nobody is going to date twelve chips by hand after a scan.
 * So food arriving in a fridge without a date gets one proposed from its
 * typical shelf life — clearly marked as a guess, never overwriting a real
 * one, and never invented for things that do not expire.
 */
class ExpiryEstimationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(IngredientSeeder::class);
    }

    private function cook(): User
    {
        return User::factory()->create();
    }

    private function itemFor(User $user, string $name): PantryItem
    {
        return PantryItem::where('user_id', $user->id)
            ->where('ingredient_id', Ingredient::lookup($name)->id)
            ->firstOrFail();
    }

    // -- the catalog ---------------------------------------------------

    public function test_perishables_get_a_shelf_life_and_cupboard_staples_do_not(): void
    {
        $this->assertSame(3, Ingredient::lookup('Spinach')->shelfLifeDays());
        $this->assertSame(2, Ingredient::lookup('Chicken Breast')->shelfLifeDays());
        $this->assertSame(60, Ingredient::lookup('Garlic')->shelfLifeDays());

        // A countdown on the salt is noise, and noise dilutes the shelf that is
        // meant to mean "cook this tonight".
        $this->assertNull(Ingredient::lookup('Salt')->shelfLifeDays());
        $this->assertNull(Ingredient::lookup('Rice')->shelfLifeDays());
        $this->assertNull(Ingredient::lookup('Turmeric')->shelfLifeDays());
        $this->assertNull(Ingredient::lookup('Salt')->suggestedExpiry());
    }

    public function test_leafy_things_expire_sooner_than_root_vegetables(): void
    {
        // The spread is the entire point — if everything got the same number
        // the ranking would have nothing to sort on.
        $this->assertLessThan(
            Ingredient::lookup('Onion')->shelfLifeDays(),
            Ingredient::lookup('Spinach')->shelfLifeDays(),
        );
        $this->assertLessThan(
            Ingredient::lookup('Egg')->shelfLifeDays(),
            Ingredient::lookup('Milk')->shelfLifeDays(),
        );
    }

    public function test_an_unknown_ingredient_falls_back_to_its_aisle(): void
    {
        // Rows created on the fly by resolve() have no shelf life of their own.
        $adhoc = Ingredient::resolve('Dragonfruit');

        $this->assertNull($adhoc->shelf_life_days);
        $this->assertSame(
            ShelfLifeCatalog::aisleDefaults()['other'],
            $adhoc->shelfLifeDays(),
        );
    }

    public function test_the_suggested_date_is_today_plus_the_shelf_life(): void
    {
        $this->assertSame(
            now()->addDays(3)->toDateString(),
            Ingredient::lookup('Spinach')->suggestedExpiry()->toDateString(),
        );
    }

    // -- confirming a scan ---------------------------------------------

    public function test_confirming_a_scan_dates_the_new_items(): void
    {
        $user = $this->cook();

        $response = $this->actingAs($user)->postJson('/api/pantry/scan/confirm', [
            'items' => [
                ['name' => 'Spinach', 'confidence' => 0.8],
                ['name' => 'Chicken Breast', 'confidence' => 0.7],
                ['name' => 'Rice', 'confidence' => 0.6],
            ],
        ]);

        $response->assertCreated();

        $spinach = $this->itemFor($user, 'Spinach');
        $this->assertSame(now()->addDays(3)->toDateString(), $spinach->expires_on->toDateString());
        $this->assertTrue($spinach->expiry_estimated);

        $this->assertSame(
            now()->addDays(2)->toDateString(),
            $this->itemFor($user, 'Chicken Breast')->expires_on->toDateString(),
        );

        // Rice does not expire, so it gets no date rather than a made-up one.
        $rice = $this->itemFor($user, 'Rice');
        $this->assertNull($rice->expires_on);
        $this->assertFalse($rice->expiry_estimated);
    }

    public function test_the_confirmation_message_says_how_many_dates_were_guessed(): void
    {
        $user = $this->cook();

        $this->actingAs($user)
            ->postJson('/api/pantry/scan/confirm', [
                'items' => [['name' => 'Spinach'], ['name' => 'Milk'], ['name' => 'Salt']],
            ])
            ->assertCreated()
            ->assertJsonPath('message', '3 ingredients added to your fridge. 2 use-by dates estimated — tap any to correct.');
    }

    public function test_an_explicit_date_beats_the_estimate(): void
    {
        $user = $this->cook();

        $this->actingAs($user)->postJson('/api/pantry/scan/confirm', [
            'items' => [['name' => 'Spinach', 'expires_on' => now()->addDays(9)->toDateString()]],
        ])->assertCreated();

        $spinach = $this->itemFor($user, 'Spinach');

        $this->assertSame(now()->addDays(9)->toDateString(), $spinach->expires_on->toDateString());
        $this->assertFalse($spinach->expiry_estimated, 'a date the caller supplied is not a guess');
    }

    public function test_a_rescan_never_overwrites_a_date_the_cook_already_set(): void
    {
        $user = $this->cook();
        $realDate = now()->addDays(12)->toDateString();

        PantryItem::create([
            'user_id' => $user->id,
            'ingredient_id' => Ingredient::lookup('Spinach')->id,
            'expires_on' => $realDate,
        ]);

        $this->actingAs($user)
            ->postJson('/api/pantry/scan/confirm', [
                'items' => [['name' => 'Spinach', 'confidence' => 0.9]],
            ])
            ->assertCreated();

        $spinach = $this->itemFor($user, 'Spinach');

        $this->assertSame($realDate, $spinach->expires_on->toDateString());
        $this->assertFalse($spinach->expiry_estimated);
    }

    // -- the other ways food gets in ------------------------------------

    public function test_adding_by_hand_without_a_date_also_estimates_one(): void
    {
        $user = $this->cook();

        $this->actingAs($user)->postJson('/api/pantry', ['name' => 'Milk'])->assertCreated();

        $milk = $this->itemFor($user, 'Milk');

        $this->assertSame(now()->addDays(7)->toDateString(), $milk->expires_on->toDateString());
        $this->assertTrue($milk->expiry_estimated);
    }

    public function test_adding_by_hand_with_a_date_keeps_it(): void
    {
        $user = $this->cook();
        $chosen = now()->addDays(4)->toDateString();

        $this->actingAs($user)
            ->postJson('/api/pantry', ['name' => 'Milk', 'expires_on' => $chosen])
            ->assertCreated();

        $milk = $this->itemFor($user, 'Milk');

        $this->assertSame($chosen, $milk->expires_on->toDateString());
        $this->assertFalse($milk->expiry_estimated);
    }

    // -- correcting a guess ---------------------------------------------

    public function test_correcting_an_estimated_date_stops_it_being_an_estimate(): void
    {
        $user = $this->cook();
        $this->actingAs($user)->postJson('/api/pantry', ['name' => 'Spinach'])->assertCreated();

        $spinach = $this->itemFor($user, 'Spinach');
        $this->assertTrue($spinach->expiry_estimated);

        $this->actingAs($user)
            ->patchJson("/api/pantry/{$spinach->id}", ['expires_on' => now()->addDay()->toDateString()])
            ->assertOk();

        $this->assertFalse($spinach->fresh()->expiry_estimated);
    }

    public function test_clearing_the_date_stops_it_being_an_estimate_too(): void
    {
        // Clearing the field is the cook saying the date does not apply. It
        // must not come back as a guess on the next render.
        $user = $this->cook();
        $this->actingAs($user)->postJson('/api/pantry', ['name' => 'Spinach'])->assertCreated();

        $spinach = $this->itemFor($user, 'Spinach');

        $this->actingAs($user)
            ->patchJson("/api/pantry/{$spinach->id}", ['expires_on' => null])
            ->assertOk();

        $spinach = $spinach->fresh();

        $this->assertNull($spinach->expires_on);
        $this->assertFalse($spinach->expiry_estimated);
    }

    // -- what the client is told ----------------------------------------

    public function test_the_pantry_marks_which_dates_were_guessed(): void
    {
        $user = $this->cook();
        $this->actingAs($user)->postJson('/api/pantry', ['name' => 'Spinach'])->assertCreated();
        $this->actingAs($user)->postJson('/api/pantry', [
            'name' => 'Milk',
            'expires_on' => now()->addDays(2)->toDateString(),
        ])->assertCreated();

        $expiry = collect($this->actingAs($user)->getJson('/api/pantry')->json('data'))
            ->pluck('expiry', 'ingredient.name');

        $this->assertTrue($expiry['Spinach']['estimated']);
        $this->assertFalse($expiry['Milk']['estimated']);
    }

    public function test_estimated_dates_feed_the_expiring_shelf_and_the_ranking(): void
    {
        // The whole reason the feature exists: a scan alone, with nobody typing
        // a date, has to be enough to light up the Use It Up shelf.
        $user = $this->cook();

        $this->actingAs($user)->postJson('/api/pantry/scan/confirm', [
            'items' => [['name' => 'Spinach'], ['name' => 'Chicken Breast'], ['name' => 'Onion']],
        ])->assertCreated();

        $shelf = $this->actingAs($user)->getJson('/api/pantry/expiring')->json('data');

        $this->assertSame(
            ['Chicken Breast', 'Spinach'],
            collect($shelf)->pluck('name')->all(),
            'soonest first, and the onion is a month out so it is not on the shelf',
        );
    }
}
