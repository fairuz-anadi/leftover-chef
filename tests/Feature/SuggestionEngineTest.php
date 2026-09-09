<?php

namespace Tests\Feature;

use App\Http\Services\DetectionMapper;
use App\Http\Services\RecipeSuggestionService;
use App\Models\FridgeSession;
use App\Models\Ingredient;
use App\Models\PantryItem;
use Database\Seeders\IngredientSeeder;
use Database\Seeders\RecipeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The recipe engine, and the detector labels that feed it.
 *
 * Covers the two core features the loop hangs off: turning a photo's labels
 * into real ingredients, and ranking recipes by overlap weighted by urgency —
 * plus the two stretch features, local-cuisine bias and "what am I missing?".
 */
class SuggestionEngineTest extends TestCase
{
    use RefreshDatabase;

    private const SESSION = 'test-suggestions-01';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(IngredientSeeder::class);
        $this->seed(RecipeSeeder::class);
    }

    private function stock(array $items): FridgeSession
    {
        $fridge = FridgeSession::forId(self::SESSION);

        foreach ($items as $name => $daysLeft) {
            PantryItem::create([
                'session_id' => $fridge->session_id,
                'ingredient_id' => Ingredient::lookup($name)->id,
                'expires_on' => $daysLeft === null ? null : $fridge->today()->copy()->addDays($daysLeft),
            ]);
        }

        return $fridge;
    }

    private function suggestions(): RecipeSuggestionService
    {
        return app(RecipeSuggestionService::class);
    }

    /** A request carrying a fridge, which is this app's whole identity model. */
    private function fridge(string $session = self::SESSION)
    {
        return $this->withHeader('X-Fridge-Session', $session);
    }

    // -- detector labels become real ingredients --------------------------

    public function test_detector_labels_resolve_through_the_alias_table(): void
    {
        // None of these are spelled the way the ingredients table spells them.
        // If the alias lookup regresses, every scan quietly loses ingredients.
        $mapped = (new DetectionMapper())->map([
            ['label' => 'capsicum', 'ingredient' => 'capsicum', 'confidence' => 0.7, 'box' => [0, 0, 9, 9]],
            ['label' => 'tin of tomatoes', 'ingredient' => 'tin of tomatoes', 'confidence' => 0.6, 'box' => [1, 1, 9, 9]],
            ['label' => 'carton of milk', 'ingredient' => 'carton of milk', 'confidence' => 0.5, 'box' => [2, 2, 9, 9]],
        ]);

        $this->assertSame(
            ['Bell Pepper', 'Chopped Tomatoes', 'Milk'],
            collect($mapped['items'])->pluck('name')->sort()->values()->all()
        );
    }

    public function test_repeat_sightings_become_one_chip_but_keep_every_box(): void
    {
        $mapped = (new DetectionMapper())->map([
            ['label' => 'tomato', 'ingredient' => 'Tomato', 'confidence' => 0.4, 'box' => [0, 0, 50, 50]],
            ['label' => 'tomato', 'ingredient' => 'Tomato', 'confidence' => 0.9, 'box' => [200, 0, 250, 50]],
        ]);

        $this->assertCount(1, $mapped['items']);
        $this->assertSame(2, $mapped['items'][0]['count']);
        $this->assertSame(0.9, $mapped['items'][0]['confidence'], 'the chip shows the best sighting');
    }

    public function test_something_the_vocabulary_does_not_know_is_surfaced_not_dropped(): void
    {
        $mapped = (new DetectionMapper())->map([
            ['label' => 'dragonfruit', 'ingredient' => 'Dragonfruit', 'confidence' => 0.5, 'box' => [0, 0, 9, 9]],
        ]);

        $this->assertSame([], $mapped['items']);
        $this->assertSame('Dragonfruit', $mapped['unmatched'][0]['name']);
    }

    public function test_confirming_a_scan_dates_the_perishables_and_leaves_staples_alone(): void
    {
        $this->withHeader('X-Fridge-Session', self::SESSION)
            ->postJson('/api/fridge/scan/confirm', [
                'items' => [
                    ['name' => 'Spinach', 'confidence' => 0.8],
                    ['name' => 'Salt', 'confidence' => 0.4],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('dated', 1);

        $items = collect(
            $this->withHeader('X-Fridge-Session', self::SESSION)->getJson('/api/fridge')->json('items')
        )->keyBy('name');

        $this->assertSame(3, $items['Spinach']['freshness']['days_left']);
        $this->assertNull($items['Salt']['freshness'], 'a countdown on the salt would be noise');
    }

    // -- ranking -----------------------------------------------------------

    public function test_urgent_food_pulls_its_recipes_up_the_list(): void
    {
        // Same fridge twice, the only difference being how urgent it is.
        $fridge = $this->stock(['Onion' => 20, 'Garlic' => 20, 'Tomato' => 20, 'Olive Oil' => null]);
        $wide = ['max_missing' => 20];
        $relaxed = $this->suggestions()->suggest($fridge, $wide)->firstWhere('recipe.title', 'Shakshuka');

        PantryItem::where('session_id', $fridge->session_id)
            ->update(['expires_on' => $fridge->today()->copy()->addDay()]);

        $urgent = $this->suggestions()->suggest($fridge->fresh(), $wide)->firstWhere('recipe.title', 'Shakshuka');

        $this->assertSame($relaxed['match_percent'], $urgent['match_percent'], 'the fridge contents did not change');
        $this->assertGreaterThan($relaxed['urgency_score'], $urgent['urgency_score']);
        $this->assertGreaterThan($relaxed['priority_score'], $urgent['priority_score']);
    }

    public function test_only_food_you_hold_with_time_left_counts_as_a_rescue(): void
    {
        $fridge = $this->stock(['Onion' => 30, 'Garlic' => 30, 'Tomato' => 1, 'Olive Oil' => null]);

        $match = $this->suggestions()->suggest($fridge, ['max_missing' => 20])
            ->firstWhere('recipe.title', 'Shakshuka');
        $this->assertNotNull($match, 'Shakshuka should be scored even if it needs shopping');
        $names = collect($match['rescues'])->pluck('name');

        $this->assertTrue($names->contains('Tomato'));
        $this->assertFalse($names->contains('Onion'), 'an onion a month out is not being rescued');
    }

    public function test_a_kitchen_sink_recipe_cannot_win_on_volume_alone(): void
    {
        // Enough to actually cook with, because a suggestion now has to be
        // mostly satisfiable — a fridge of four things and a relaxed missing
        // cap no longer returns anything, which is the point of the filter.
        $fridge = $this->stock([
            'Spinach' => 1, 'Milk' => 1, 'Tomato' => 1, 'Onion' => 1,
            'Egg' => 1, 'Garlic' => 1, 'Olive Oil' => 1, 'Bell Pepper' => 1,
            'Cumin' => 1, 'Paprika' => 1,
        ]);

        $scores = $this->suggestions()->suggest($fridge, ['max_missing' => 20])->pluck('urgency_score');

        $this->assertNotEmpty($scores, 'ten urgent ingredients should suggest something');

        // Everything is equally urgent, so no score may exceed the ceiling —
        // a recipe listing ten of them cannot outrank one listing three by
        // simply naming more.
        $this->assertLessThanOrEqual(100, $scores->max());
        $this->assertGreaterThan(0, $scores->max());
    }

    // -- local cuisine bias (stretch feature) -------------------------------

    public function test_bangladeshi_cooking_gets_a_nudge_up_the_list(): void
    {
        $fridge = $this->stock([
            'Onion' => 5, 'Garlic' => 5, 'Ginger' => 5, 'Turmeric' => null,
            'Chilli Powder' => null, 'Cumin' => null, 'Lentils' => null,
            'Vegetable Oil' => null, 'Tomato' => 5, 'Green Chilli' => 5,
        ]);

        $biased = $this->suggestions()->suggest($fridge, ['local_bias' => true, 'max_missing' => 20]);
        $dal = $biased->firstWhere('recipe.title', 'Red Lentil Dal');

        $this->assertSame('Bangladesh', $dal['recipe']['cuisine_country']);
        $this->assertSame(8, $dal['local_bonus']);

        $plain = $this->suggestions()->suggest($fridge, ['local_bias' => false, 'max_missing' => 20])
            ->firstWhere('recipe.title', 'Red Lentil Dal');

        $this->assertSame(0, $plain['local_bonus']);
        $this->assertSame(
            $plain['priority_score'] + 8,
            $dal['priority_score'],
            'the bonus is exactly the nudge, not a hidden reshuffle',
        );
    }

    public function test_a_recipe_needing_too_much_shopping_is_not_suggested(): void
    {
        $fridge = $this->stock(['Onion' => 5]);

        $suggestions = $this->suggestions()->suggest($fridge, ['max_missing' => 1]);

        $this->assertTrue(
            $suggestions->every(fn (array $row) => count($row['missing']) <= 1),
            'nothing more than one shop away should be on the list',
        );
    }

    public function test_an_empty_fridge_suggests_nothing_rather_than_everything(): void
    {
        $fridge = FridgeSession::forId('empty-session');

        $this->assertTrue($this->suggestions()->suggest($fridge)->isEmpty());
        $this->assertSame([], $this->suggestions()->missingLinks($fridge));
    }

    // -- "what am I missing?" (stretch feature) -----------------------------

    public function test_it_names_the_ingredient_that_unlocks_the_most_cooking(): void
    {
        $fridge = $this->stock([
            'Onion' => 5, 'Garlic' => 5, 'Tomato' => 5, 'Egg' => 5,
            'Olive Oil' => null, 'Salt' => null, 'Black Pepper' => null,
        ]);

        $links = $this->suggestions()->missingLinks($fridge);

        $this->assertNotEmpty($links);
        $this->assertGreaterThanOrEqual(1, $links[0]['unlocks']);
        $this->assertNotEmpty($links[0]['recipes'], 'it should name what it would unlock');

        // Sorted by how much each one opens up.
        $unlocks = collect($links)->pluck('unlocks')->all();
        $this->assertSame($unlocks, collect($unlocks)->sortDesc()->values()->all());
    }

    public function test_it_never_suggests_something_already_on_the_shelf(): void
    {
        $fridge = $this->stock(['Onion' => 5, 'Garlic' => 5, 'Tomato' => 5, 'Olive Oil' => null]);

        $held = collect(['Onion', 'Garlic', 'Tomato', 'Olive Oil']);
        $suggested = collect($this->suggestions()->missingLinks($fridge))->pluck('name');

        $this->assertTrue($suggested->intersect($held)->isEmpty());
    }

    /**
     * The bug this was written for: photograph a handful of things and dishes
     * you own none of were still offered. A three-ingredient recipe missing all
     * three is only "3 missing", which cleared the cap, scored zero for match
     * and zero for urgency — and then the local-cuisine bonus, a tie-break, put
     * it on screen unaccompanied.
     */
    public function test_it_never_suggests_a_recipe_you_own_nothing_for(): void
    {
        $this->stockOnly(['Tomato', 'Onion', 'Egg', 'Green Chilli', 'Coriander', 'Potato']);

        $suggestions = $this->fridge()->getJson('/api/fridge')->assertOk()->json('suggestions');

        $this->assertNotEmpty($suggestions, 'six usable ingredients should suggest something');

        foreach ($suggestions as $suggestion) {
            $this->assertGreaterThan(
                0,
                $suggestion['have_count'],
                "{$suggestion['recipe']['title']} was suggested using nothing on the shelf",
            );
        }
    }

    public function test_a_suggestion_must_be_mostly_satisfiable(): void
    {
        $this->stockOnly(['Tomato', 'Onion', 'Egg', 'Green Chilli', 'Coriander', 'Potato']);

        foreach ($this->fridge()->getJson('/api/fridge')->json('suggestions') as $suggestion) {
            $this->assertGreaterThanOrEqual(
                40,
                $suggestion['match_percent'],
                "{$suggestion['recipe']['title']} is mostly a shopping list",
            );
        }
    }

    public function test_the_local_bonus_cannot_put_a_recipe_on_screen_by_itself(): void
    {
        // Mishti Doi is Bangladeshi — it collects the bonus — and needs milk,
        // sugar and yoghurt, none of which are here.
        $this->stockOnly(['Tomato', 'Onion', 'Potato']);

        $titles = collect($this->fridge()->getJson('/api/fridge')->json('suggestions'))
            ->pluck('recipe.title');

        $this->assertNotContains('Mishti Doi', $titles->all());
    }

    public function test_it_writes_a_recipe_for_a_shelf_the_library_does_not_cover(): void
    {
        $this->stockOnly(['Potato', 'Onion', 'Green Chilli', 'Coriander']);

        $suggestions = $this->fridge()->getJson('/api/fridge')->assertOk()->json('suggestions');
        $composed = collect($suggestions)->filter(fn ($s) => $s['recipe']['generated'] ?? false);

        $this->assertNotEmpty($composed, 'nothing was composed for a shelf with four usable things on it');

        $first = $composed->first();

        // A composed dish is built from the shelf, so it must not send you
        // shopping for anything.
        $this->assertGreaterThan(0, $first['have_count']);
        $this->assertSame(100, $first['match_percent'], 'a composed dish should need nothing you lack');

        // And it must be a real recipe: openable, with method steps.
        $detail = $this->fridge()
            ->getJson("/api/recipes/{$first['recipe']['id']}")
            ->assertOk()
            ->json('data');

        $this->assertTrue($detail['generated']);
        $this->assertNotEmpty($detail['steps']);
        $this->assertNotEmpty($detail['ingredients']);
    }

    public function test_a_dish_composed_for_one_fridge_is_not_offered_to_another(): void
    {
        $this->stockOnly(['Potato', 'Onion', 'Green Chilli', 'Coriander']);
        $mine = collect($this->fridge()->getJson('/api/fridge')->json('suggestions'))
            ->filter(fn ($s) => $s['recipe']['generated'] ?? false)
            ->pluck('recipe.title');

        $this->assertNotEmpty($mine);

        // A different browser, with a different shelf.
        $this->stockOnly(['Milk', 'Yoghurt', 'Sugar'], 'someone-elses-fridge');
        $theirs = collect(
            $this->fridge('someone-elses-fridge')->getJson('/api/fridge')->json('suggestions')
        )->pluck('recipe.title');

        foreach ($mine as $title) {
            $this->assertNotContains(
                $title,
                $theirs->all(),
                "{$title} was written for another fridge and turned up in this one",
            );
        }
    }

    /**
     * Empty the demo contents and put back only what is named, dated from the
     * shelf-life table exactly as a confirmed scan would.
     *
     * @param  array<int, string>  $names
     */
    private function stockOnly(array $names, string $session = self::SESSION): void
    {
        $fridge = FridgeSession::forId($session);
        $fridge->pantryItems()->delete();
        $fridge->forceFill(['stocked_at' => now()])->save();

        // Confirming a scan reports 201: these rows are newly created.
        $this->fridge($session)
            ->postJson('/api/fridge/scan/confirm', [
                'items' => collect($names)->map(fn (string $name) => ['name' => $name])->all(),
            ])
            ->assertSuccessful();
    }

}
