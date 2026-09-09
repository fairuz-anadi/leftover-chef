<?php

namespace App\Http\Services;

use App\Models\FridgeSession;
use App\Models\Ingredient;
use App\Models\Recipe;
use App\Models\User;
use App\Support\DishArtwork;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;

/**
 * Writes a recipe for the fridge in front of it.
 *
 * The seeded library is forty dishes somebody wrote down. That is plenty when
 * your fridge looks like a normal fridge, and useless the moment it does not:
 * photograph four things nobody thought to write a recipe around and the list
 * comes back thin, or full of dishes you are three shopping trips away from.
 *
 * So this composes one. Not from a language model — there is no internet at
 * the venue and a 7B checkpoint is not going onto a demo laptop — but from
 * cooking grammar, which is the part of a recipe that actually generalises.
 * A bhorta is *a soft vegetable, mashed, with raw allium and heat through it*.
 * A jhol is *a protein and a potato in a thin turmeric gravy*. Those are
 * templates with holes in them, and a fridge is a bag of things to put in the
 * holes.
 *
 * Two properties make this worth having rather than a gimmick:
 *
 *   It prefers what is dying. Where two ingredients could fill a slot, the one
 *   with less time left wins, so a composed dish is pointed at the same
 *   problem the rest of the app is.
 *
 *   It produces a real recipe row. A composed dish is scored by the same
 *   engine, opened by the same reveal, and cooking it takes the same
 *   ingredients off the shelf. Nothing downstream knows the difference — which
 *   is why `generated_at` exists, so the card can say so out loud.
 */
class RecipeComposer
{
    /**
     * The slot vocabulary. Each list is in preference order, used to break
     * ties when two candidates are equally urgent.
     *
     * @var array<string, array<int, string>>
     */
    private const SLOTS = [
        'protein' => [
            'chicken-thigh', 'chicken-breast', 'beef-mince', 'lamb', 'prawn',
            'hilsa', 'rohu', 'white-fish', 'salmon', 'tuna', 'egg', 'tofu',
            'chickpea', 'black-bean',
        ],
        'soft-veg' => [
            'aubergine', 'potato', 'sweet-potato', 'pumpkin', 'bottle-gourd',
            'tomato', 'cauliflower', 'courgette', 'bitter-gourd', 'pointed-gourd',
        ],
        'quick-veg' => [
            'spinach', 'cabbage', 'okra', 'green-bean', 'pea', 'carrot',
            'bell-pepper', 'cauliflower', 'courgette', 'mushroom', 'broccoli',
        ],
        'allium' => ['onion', 'spring-onion', 'garlic'],
        'garlic' => ['garlic', 'ginger'],
        'heat' => ['green-chilli', 'chilli-powder', 'paprika'],
        'warm-spice' => [
            'turmeric', 'cumin', 'coriander-powder', 'garam-masala',
            'curry-powder', 'panch-phoron',
        ],
        'fat' => ['mustard-oil', 'vegetable-oil', 'olive-oil', 'butter'],
        'herb' => ['coriander', 'parsley', 'basil'],
        'acid' => ['lemon', 'lime', 'tomato', 'vinegar'],
        'potato' => ['potato', 'sweet-potato'],
        'tomato' => ['tomato', 'chopped-tomato', 'tomato-paste'],
        'egg' => ['egg'],
        'rice' => ['rice'],
        'lentil' => ['lentil', 'chickpea'],
        'dairy' => ['yoghurt', 'milk', 'cream', 'coconut-milk'],
        'salt' => ['salt'],
    ];

    /** Rough amounts per slot, so the written list reads like a recipe. */
    private const AMOUNTS = [
        'protein' => '400 g',
        'soft-veg' => '500 g',
        'quick-veg' => '300 g',
        'potato' => '400 g',
        'tomato' => '2',
        'allium' => '1 large',
        'garlic' => '3 cloves',
        'heat' => '2',
        'warm-spice' => '1 tsp',
        'fat' => '2 tbsp',
        'herb' => '2 tbsp',
        'acid' => '1',
        'egg' => '4',
        'rice' => '200 g',
        'lentil' => '150 g',
        'dairy' => '100 ml',
        'salt' => '1 tsp',
    ];

    /**
     * The dishes it knows how to write.
     *
     * `needs` must all be fillable or the template is skipped. `wants` are
     * taken when the fridge has them and silently dropped when it does not,
     * which is what keeps a composed recipe from ever listing something you
     * would have to go and buy — salt included, which is why it is a slot
     * rather than a line appended to every recipe. The method still says "a
     * pinch of salt" as prose; only the shopping-relevant list is strict.
     *
     * Method lines name the slots they depend on, so a line about coriander
     * disappears along with the coriander rather than reading "finish with .".
     */
    private const TEMPLATES = [
        [
            'key' => 'bhorta',
            'title' => '{soft-veg} Bhorta',
            'country' => 'BD',
            'difficulty' => 'beginner',
            'prep' => 5, 'cook' => 20, 'servings' => 3,
            'needs' => ['soft-veg', 'allium'],
            'wants' => ['heat', 'fat', 'herb', 'salt'],
            'description' => 'A bhorta made from what was on the shelf: {soft-veg} boiled soft and mashed with raw {allium}. The dish a Bangladeshi kitchen produces from an almost empty fridge.',
            'method' => [
                ['Boil the {soft-veg} whole until a knife slides through with no resistance, then drain and let it steam dry.', ['soft-veg']],
                ['Mash it while still warm. Keep some texture — a bhorta is not a puree.', []],
                ['Work the {allium} through with your fingers, which bruises it and takes the raw edge off.', ['allium']],
                ['Add the {heat} and a good pinch of salt, and keep working until the colour is even.', ['heat']],
                ['Pour over the raw {fat} and mix until it smells sharp.', ['fat']],
                ['Fold through the {herb} at the very end so it stays green.', ['herb']],
                ['Serve at room temperature with hot rice.', []],
            ],
        ],
        [
            'key' => 'bhuna',
            'title' => '{protein} Bhuna',
            'country' => 'BD',
            'difficulty' => 'intermediate',
            'prep' => 10, 'cook' => 35, 'servings' => 4,
            'needs' => ['protein', 'allium', 'warm-spice', 'fat'],
            'wants' => ['tomato', 'garlic', 'heat', 'herb', 'salt'],
            'description' => 'A dry bhuna built around the {protein} that needed using, cooked down until the oil separates from the masala.',
            'method' => [
                ['Heat the {fat} in a heavy pan until it shimmers.', ['fat']],
                ['Cook the {allium} slowly for 12 minutes, until it collapses and turns properly brown. This is the whole dish — do not rush it.', ['allium']],
                ['Stir in the {garlic} and cook for another minute, until it stops smelling raw.', ['garlic']],
                ['Add the {warm-spice} with a splash of water so the spices bloom rather than burn.', ['warm-spice']],
                ['Stir in the {tomato} and cook until the oil separates out at the edges.', ['tomato']],
                ['Add the {protein} and turn it in the masala until every piece is coated.', ['protein']],
                ['Add the {heat}, cover, and cook on a low heat for 20 minutes, stirring now and then.', ['heat']],
                ['Uncover and cook off any remaining liquid — a bhuna should cling, not pool.', []],
                ['Scatter over the {herb} and take it off the heat.', ['herb']],
            ],
        ],
        [
            'key' => 'jhol',
            'title' => '{protein} Jhol',
            'country' => 'BD',
            'difficulty' => 'beginner',
            'prep' => 10, 'cook' => 30, 'servings' => 4,
            'needs' => ['protein', 'potato', 'allium', 'warm-spice'],
            'wants' => ['fat', 'heat', 'herb', 'salt'],
            'description' => 'A thin, light jhol — {protein} and {potato} in a turmeric gravy you can drink. Weeknight food.',
            'method' => [
                ['Warm the {fat} and soften the {allium} for 6 minutes without letting it colour much.', ['fat', 'allium']],
                ['Add the {warm-spice} and stir for thirty seconds.', ['warm-spice']],
                ['Add the {potato}, cut into large chunks, and turn it in the spices.', ['potato']],
                ['Add the {protein} and enough water to just cover everything.', ['protein']],
                ['Add the {heat} whole, so they season the broth without shredding it.', ['heat']],
                ['Simmer uncovered for 20 minutes, until the potato is soft and the broth has thinned into a gravy.', []],
                ['Check the salt, add the {herb}, and serve in bowls with rice.', ['herb']],
            ],
        ],
        [
            'key' => 'bhaji',
            'title' => '{quick-veg} Bhaji',
            'country' => 'BD',
            'difficulty' => 'beginner',
            'prep' => 5, 'cook' => 12, 'servings' => 3,
            'needs' => ['quick-veg', 'allium', 'fat'],
            'wants' => ['heat', 'warm-spice', 'garlic', 'salt'],
            'description' => 'Twelve minutes: {quick-veg} fried hard and fast with {allium}. The dish for the vegetable that has one day left.',
            'method' => [
                ['Get the {fat} properly hot — a bhaji is fried, not stewed.', ['fat']],
                ['Add the {allium} and cook for 4 minutes until the edges catch.', ['allium']],
                ['Add the {garlic} and stir for a few seconds.', ['garlic']],
                ['Add the {warm-spice} and let it toast in the oil.', ['warm-spice']],
                ['Add the {quick-veg}, turn the heat to high, and stir-fry for 6 minutes. Keep it moving.', ['quick-veg']],
                ['Add the {heat} and salt, cook one minute more, and serve straight away.', ['heat']],
            ],
        ],
        [
            'key' => 'dim',
            'title' => 'Dim Bhuna with {allium}',
            'country' => 'BD',
            'difficulty' => 'beginner',
            'prep' => 5, 'cook' => 25, 'servings' => 3,
            'needs' => ['egg', 'allium', 'fat'],
            'wants' => ['tomato', 'warm-spice', 'heat', 'herb', 'salt'],
            'description' => 'Eggs, blistered in hot oil and finished in an onion masala. The cheapest dinner in this app.',
            'method' => [
                ['Boil the {egg} for 9 minutes, cool them under the tap and peel.', ['egg']],
                ['Prick each egg a few times, rub with salt, and fry in the hot {fat} until blistered. Set aside.', ['fat']],
                ['In the same oil, cook the {allium} for 12 minutes until it collapses and browns.', ['allium']],
                ['Add the {warm-spice} with a splash of water.', ['warm-spice']],
                ['Stir in the {tomato} and cook for 6 minutes, until the oil separates.', ['tomato']],
                ['Return the eggs, coat them, add the {heat} and a little water, and simmer for 5 minutes.', ['heat']],
                ['Finish with the {herb}.', ['herb']],
            ],
        ],
        [
            'key' => 'khichuri',
            'title' => 'Khichuri with {quick-veg}',
            'country' => 'BD',
            'difficulty' => 'beginner',
            'prep' => 10, 'cook' => 30, 'servings' => 4,
            'needs' => ['rice', 'lentil', 'warm-spice'],
            'wants' => ['quick-veg', 'allium', 'fat', 'heat', 'potato', 'salt'],
            'description' => 'Rice and lentils cooked down together until they stop being two things. Everything else in the fridge goes in with them.',
            'method' => [
                ['Rinse the {rice} and {lentil} together until the water runs clear.', ['rice', 'lentil']],
                ['Warm the {fat} and soften the {allium} for 5 minutes.', ['fat', 'allium']],
                ['Add the {warm-spice} and stir until it smells toasted.', ['warm-spice']],
                ['Add the {potato} in chunks and turn it through.', ['potato']],
                ['Add the drained rice and lentils, then four times their volume in water.', []],
                ['Bring to the boil, then simmer covered for 25 minutes, stirring occasionally so it does not catch.', []],
                ['Stir in the {quick-veg} for the last 8 minutes.', ['quick-veg']],
                ['Add the {heat} and salt to taste. It should be soft and loose, not separate grains.', ['heat']],
            ],
        ],
    ];

    public function __construct(private readonly FreshnessService $freshness = new FreshnessService())
    {
    }

    /**
     * Compose up to `$limit` dishes for this fridge.
     *
     * @return Collection<int, Recipe>
     */
    public function compose(FridgeSession $session, int $limit = 2): Collection
    {
        $shelf = $this->shelf($session);

        if ($shelf->isEmpty()) {
            return collect();
        }

        $candidates = collect(self::TEMPLATES)
            ->map(fn (array $template) => $this->fill($template, $shelf))
            ->filter()
            // Most at-risk food used wins; a fuller dish breaks the tie.
            ->sortByDesc(fn (array $c) => [$c['rescues'], count($c['filled'])])
            ->take($limit)
            ->values();

        return $candidates->map(fn (array $c) => $this->persist($c));
    }

    /**
     * What is on the shelf, keyed by slug, carrying how urgent each thing is.
     *
     * @return Collection<string, array{ingredient: Ingredient, urgency: float}>
     */
    private function shelf(FridgeSession $session): Collection
    {
        $statuses = $this->freshness->statuses($session);

        return $session->pantryItems()
            ->with('ingredient')
            ->get()
            ->filter(fn ($item) => $item->ingredient !== null)
            ->mapWithKeys(fn ($item) => [
                $item->ingredient->slug => [
                    'ingredient' => $item->ingredient,
                    'urgency' => (float) ($statuses->get($item->ingredient_id)['urgency'] ?? 0),
                ],
            ]);
    }

    /**
     * Try to fill a template from the shelf. Null when a required slot is
     * empty — the dish simply is not available today.
     *
     * @param  Collection<string, array{ingredient: Ingredient, urgency: float}>  $shelf
     * @return array<string, mixed>|null
     */
    private function fill(array $template, Collection $shelf): ?array
    {
        $filled = [];
        $used = [];

        foreach (array_merge($template['needs'], $template['wants']) as $slot) {
            $pick = $this->pick($slot, $shelf, $used);

            if ($pick === null) {
                // A missing required slot kills the template; a missing
                // optional one just means that line never gets written.
                if (in_array($slot, $template['needs'], true)) {
                    return null;
                }

                continue;
            }

            $filled[$slot] = $pick;
            $used[] = $pick['ingredient']->slug;
        }

        $rescues = collect($filled)->filter(fn (array $p) => $p['urgency'] > 0)->count();

        return [
            'template' => $template,
            'filled' => $filled,
            'rescues' => $rescues,
        ];
    }

    /**
     * The best thing on the shelf for one slot: whatever is closest to the
     * bin, and where nothing is urgent, whatever the slot prefers.
     *
     * @param  Collection<string, array{ingredient: Ingredient, urgency: float}>  $shelf
     * @param  array<int, string>  $used
     * @return array{ingredient: Ingredient, urgency: float}|null
     */
    private function pick(string $slot, Collection $shelf, array $used): ?array
    {
        $best = null;
        $bestScore = null;

        foreach (self::SLOTS[$slot] ?? [] as $rank => $slug) {
            if (in_array($slug, $used, true) || !$shelf->has($slug)) {
                continue;
            }

            $candidate = $shelf->get($slug);
            // Urgency first, preference order second.
            $score = [$candidate['urgency'], -$rank];

            if ($bestScore === null || $score > $bestScore) {
                $best = $candidate;
                $bestScore = $score;
            }
        }

        return $best;
    }

    /**
     * Turn a filled template into a recipe row.
     *
     * `firstOrCreate` on the title, so the same dish composed by two different
     * fridges is one row rather than two, and so a recipe a judge is currently
     * looking at is never rewritten underneath them.
     *
     * @param  array<string, mixed>  $candidate
     */
    private function persist(array $candidate): Recipe
    {
        $template = $candidate['template'];
        $filled = $candidate['filled'];

        // Titles keep the ingredient's own capitals — "Chicken Breast Jhol",
        // not "Chicken breast Jhol". Only prose lowercases them.
        $title = $this->interpolate($template['title'], $filled, lower: false);

        $existing = Recipe::where('title', $title)->first();

        if ($existing) {
            return $existing;
        }

        $lines = [];

        foreach ($filled as $slot => $pick) {
            $amount = self::AMOUNTS[$slot] ?? '';
            $suffix = $slot === 'herb' ? ', chopped' : '';
            $lines[] = trim($amount . ' ' . strtolower($pick['ingredient']->name)) . $suffix;
        }

        $instructions = [];

        foreach ($template['method'] as [$text, $needs]) {
            if (array_diff($needs, array_keys($filled)) !== []) {
                continue;
            }

            $instructions[] = $this->interpolate($text, $filled);
        }

        $recipe = Recipe::create([
            'user_id' => $this->author()->id,
            'title' => $title,
            'description' => $this->interpolate($template['description'], $filled),
            'ingredients' => $lines,
            'instructions' => $instructions,
            'cuisine_code' => $template['country'],
            'difficulty' => $template['difficulty'],
            'prep_minutes' => $template['prep'],
            'cook_minutes' => $template['cook'],
            'servings' => $template['servings'],
            'diet_tags' => [],
            'generated_at' => now(),
        ]);

        // The same two passes every seeded recipe gets: fill the ingredient
        // pivot the matcher reads, and draw it a picture.
        app(RecipeIngredientSync::class)->sync($recipe);
        DishArtwork::attach($recipe->load('categories'));

        return $recipe->refresh();
    }

    /**
     * Who a composed recipe is by.
     *
     * Its own account rather than one of the seeded cooks, because the byline
     * on a dish nobody wrote should not be a person's name. There is no login
     * in this app, so the row exists only to satisfy the foreign key and to
     * keep the authorship legible if anyone looks.
     */
    private function author(): User
    {
        return User::firstOrCreate(
            ['email' => 'kitchen@fridgemama.local'],
            [
                'name' => 'FridgeMama',
                'username' => 'fridgemama',
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => now(),
            ],
        );
    }

    /** @param  array<string, array{ingredient: Ingredient, urgency: float}>  $filled */
    private function interpolate(string $text, array $filled, bool $lower = true): string
    {
        foreach ($filled as $slot => $pick) {
            $name = $lower ? strtolower($pick['ingredient']->name) : $pick['ingredient']->name;
            $text = str_replace('{' . $slot . '}', $name, $text);
        }

        // A title keeps its capital even though the ingredient name is lowered
        // for the middle of a sentence.
        return preg_replace_callback('/^\p{Ll}/u', fn ($m) => mb_strtoupper($m[0]), $text) ?? $text;
    }
}
