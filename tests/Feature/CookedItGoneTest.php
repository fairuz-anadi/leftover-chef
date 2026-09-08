<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\Recipe;
use App\Models\User;
use Database\Seeders\IngredientSeeder;
use Database\Seeders\RecipeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "I cooked this" — the step that closes the loop.
 *
 * Scan puts food in, the ranking says what to cook, and this takes it back out.
 * Without it the shelf keeps insisting you own spinach you ate on Tuesday, and
 * the expiry ranking spends the rest of the week recommending a rescue that
 * already happened.
 */
class CookedItGoneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(IngredientSeeder::class);
        $this->seed(RecipeSeeder::class);
    }

    private function cookWith(array $names): User
    {
        $user = User::factory()->create();

        foreach ($names as $name => $daysLeft) {
            PantryItem::create([
                'user_id' => $user->id,
                'ingredient_id' => Ingredient::lookup($name)->id,
                'expires_on' => $daysLeft === null ? null : now()->addDays($daysLeft),
            ]);
        }

        return $user;
    }

    /** A recipe whose required ingredients we know, so assertions can be exact. */
    private function recipe(): Recipe
    {
        return Recipe::where('title', 'Spaghetti Aglio e Olio')->firstOrFail();
    }

    private function requiredNames(Recipe $recipe): array
    {
        return $recipe->ingredientRecords
            ->reject(fn ($i) => (bool) $i->pivot->is_optional)
            ->pluck('name')
            ->all();
    }

    // -- the plan -------------------------------------------------------

    public function test_cook_mode_lists_what_this_recipe_would_take_from_the_fridge(): void
    {
        $recipe = $this->recipe();
        $names = $this->requiredNames($recipe);

        $user = $this->cookWith(array_fill_keys($names, 4) + ['Mango' => 2]);

        $usage = $this->actingAs($user)
            ->getJson("/api/recipes/{$recipe->id}/cook")
            ->assertOk()
            ->json('data.pantry_usage');

        $listed = collect($usage)->pluck('name');

        foreach ($names as $name) {
            $this->assertTrue($listed->contains($name), "{$name} should be offered for removal");
        }

        // A mango in the fridge has nothing to do with this recipe.
        $this->assertFalse($listed->contains('Mango'));
    }

    public function test_staples_are_offered_but_not_ticked(): void
    {
        $recipe = $this->recipe();
        $user = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 4));

        $usage = collect(
            $this->actingAs($user)->getJson("/api/recipes/{$recipe->id}/cook")->json('data.pantry_usage')
        );

        $staples = $usage->where('is_staple', true);
        $this->assertNotEmpty($staples, 'this recipe should involve at least one staple');

        // You do not run out of salt because you cooked one dish.
        $this->assertTrue($staples->every(fn ($row) => $row['consume_by_default'] === false));
        $this->assertTrue($usage->where('is_staple', false)->every(fn ($row) => $row['consume_by_default'] === true));
    }

    public function test_a_signed_out_cook_gets_an_empty_plan_rather_than_an_error(): void
    {
        $recipe = $this->recipe();

        $this->getJson("/api/recipes/{$recipe->id}/cook")
            ->assertOk()
            ->assertJsonPath('data.pantry_usage', []);
    }

    // -- consuming ------------------------------------------------------

    public function test_cooking_removes_the_perishables_and_keeps_the_staples(): void
    {
        $recipe = $this->recipe();
        $user = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 4) + ['Mango' => 2]);

        $before = $user->pantryItems()->count();

        $this->actingAs($user)
            ->postJson("/api/recipes/{$recipe->id}/cooked")
            ->assertOk();

        $remaining = $user->pantryItems()->with('ingredient')->get();

        // Staples survive, and so does the unrelated mango.
        $this->assertTrue($remaining->contains(fn ($item) => $item->ingredient->name === 'Mango'));
        $this->assertTrue(
            $remaining->every(fn ($item) => $item->ingredient->is_staple || $item->ingredient->name === 'Mango'),
            'everything left should be a staple or unrelated to the recipe',
        );
        $this->assertLessThan($before, $remaining->count());
    }

    public function test_only_the_ticked_items_are_removed(): void
    {
        $recipe = $this->recipe();
        $user = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 4));

        $usage = collect(
            $this->actingAs($user)->getJson("/api/recipes/{$recipe->id}/cook")->json('data.pantry_usage')
        );
        $one = $usage->first();

        // Everything in this fridge is four days out, so the message also
        // carries a rescue line — the count is what this test is about.
        $this->actingAs($user)
            ->postJson("/api/recipes/{$recipe->id}/cooked", ['pantry_item_ids' => [$one['pantry_item_id']]])
            ->assertOk()
            ->assertJsonCount(1, 'removed');

        $this->assertDatabaseMissing('pantry_items', ['id' => $one['pantry_item_id']]);
        $this->assertSame(
            $usage->count() - 1,
            $user->pantryItems()->count(),
            'everything the cook left ticked off should still be there',
        );
    }

    public function test_an_empty_selection_removes_nothing(): void
    {
        $recipe = $this->recipe();
        $user = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 4));
        $before = $user->pantryItems()->count();

        $this->actingAs($user)
            ->postJson("/api/recipes/{$recipe->id}/cooked", ['pantry_item_ids' => []])
            ->assertOk()
            ->assertJsonPath('removed', []);

        $this->assertSame($before, $user->pantryItems()->count());
    }

    public function test_a_cook_cannot_consume_somebody_elses_fridge(): void
    {
        $recipe = $this->recipe();
        $victim = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 4));
        $intruder = User::factory()->create();

        $stolen = $victim->pantryItems()->pluck('id')->all();

        $this->actingAs($intruder)
            ->postJson("/api/recipes/{$recipe->id}/cooked", ['pantry_item_ids' => $stolen])
            ->assertOk()
            ->assertJsonPath('removed', []);

        $this->assertSame(count($stolen), $victim->pantryItems()->count());
    }

    // -- the payoff -----------------------------------------------------

    public function test_it_reports_what_was_saved_from_the_bin(): void
    {
        $recipe = $this->recipe();
        $names = $this->requiredNames($recipe);

        // Everything a month out except one thing dying tomorrow.
        $fridge = array_fill_keys($names, 30);
        $doomed = collect($names)->first(fn ($name) => !Ingredient::lookup($name)->is_staple);
        $fridge[$doomed] = 1;

        $response = $this->actingAs($this->cookWith($fridge))
            ->postJson("/api/recipes/{$recipe->id}/cooked")
            ->assertOk();

        $this->assertSame([$doomed], collect($response->json('rescued'))->pluck('name')->all());
        $this->assertStringContainsString("You used up {$doomed} before it went off.", $response->json('message'));
    }

    public function test_food_that_was_not_going_off_is_not_claimed_as_a_rescue(): void
    {
        $recipe = $this->recipe();
        $user = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 30));

        $this->actingAs($user)
            ->postJson("/api/recipes/{$recipe->id}/cooked")
            ->assertOk()
            ->assertJsonPath('rescued', []);
    }

    public function test_the_expiring_shelf_shrinks_once_the_food_is_eaten(): void
    {
        $recipe = $this->recipe();
        $names = $this->requiredNames($recipe);

        $fridge = array_fill_keys($names, 30);
        $doomed = collect($names)->first(fn ($name) => !Ingredient::lookup($name)->is_staple);
        $fridge[$doomed] = 1;

        $user = $this->cookWith($fridge);

        $this->assertCount(1, $this->actingAs($user)->getJson('/api/pantry/expiring')->json('data'));

        $this->actingAs($user)->postJson("/api/recipes/{$recipe->id}/cooked")->assertOk();

        $this->assertCount(0, $this->actingAs($user)->getJson('/api/pantry/expiring')->json('data'));
    }

    // -- undo -----------------------------------------------------------

    public function test_undo_puts_everything_back_exactly_as_it_was(): void
    {
        $recipe = $this->recipe();
        $user = $this->cookWith(array_fill_keys($this->requiredNames($recipe), 4));

        $spinachLike = $user->pantryItems()->with('ingredient')->get()
            ->first(fn ($item) => !$item->ingredient->is_staple);
        $name = $spinachLike->ingredient->name;
        $date = $spinachLike->expires_on->toDateString();

        $removed = $this->actingAs($user)
            ->postJson("/api/recipes/{$recipe->id}/cooked")
            ->json('removed');

        $this->assertDatabaseMissing('pantry_items', ['id' => $spinachLike->id]);

        $this->actingAs($user)
            ->postJson('/api/pantry/restore', ['items' => $removed])
            ->assertOk();

        $back = $user->pantryItems()->with('ingredient')->get()
            ->first(fn ($item) => $item->ingredient->name === $name);

        $this->assertNotNull($back, 'the ingredient should be back on the shelf');
        $this->assertSame($date, $back->expires_on->toDateString(), 'and with the date it had');
    }

    public function test_cooking_requires_signing_in(): void
    {
        $this->postJson("/api/recipes/{$this->recipe()->id}/cooked")->assertStatus(401);
        $this->postJson('/api/pantry/restore', ['items' => [['name' => 'Onion']]])->assertStatus(401);
    }
}
