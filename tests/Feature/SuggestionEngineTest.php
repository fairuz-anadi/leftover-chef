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
        $fridge = $this->stock(['Spinach' => 1, 'Milk' => 1, 'Tomato' => 1, 'Onion' => 1]);
        $service = $this->suggestions();

        $scores = $service->suggest($fridge, ['max_missing' => 20])->pluck('urgency_score');

        // Everything is equally urgent, so no score may exceed the ceiling.
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
}
