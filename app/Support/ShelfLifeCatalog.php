<?php

namespace App\Support;

/**
 * How long food lasts once it is in the fridge.
 *
 * This exists so that Use It Up works without anybody typing a date. Scanning
 * a fridge adds a dozen ingredients in one tap; asking the cook to then set
 * twelve use-by dates by hand is how a feature gets ignored, and an ignored
 * expiry field means the whole waste-ranking half of the app does nothing.
 *
 * Figures are typical refrigerated household shelf life from the point of
 * purchase, rounded to something a person would actually say. They are a
 * starting guess the cook can correct, not a food-safety authority — anything
 * added this way is marked as estimated, and the UI says so.
 *
 * `null` means "no meaningful use-by date": salt, rice, oil, spices, tinned
 * goods. A cupboard staple with a countdown on it is noise, and noise here is
 * expensive, because it dilutes the shelf that is supposed to mean "cook this
 * tonight".
 */
class ShelfLifeCatalog
{
    /**
     * Fallback by aisle, for ingredients that have no entry of their own —
     * including rows created on the fly when a cook types a name the pantry
     * vocabulary has never seen.
     *
     * @var array<string, int|null>
     */
    private const AISLE_DEFAULTS = [
        'produce' => 7,
        'dairy' => 10,
        'meat' => 3,
        'seafood' => 2,
        'bakery' => 5,
        'pantry' => null,
        'spices' => null,
        'other' => null,
    ];

    /**
     * Days from today, keyed by ingredient slug. Overrides the aisle default.
     *
     * @var array<string, int|null>
     */
    private const BY_SLUG = [
        // Produce — the spread here is the whole point. Herbs and leaves are
        // the things that actually get thrown away; onions and garlic never do.
        'spinach' => 3,
        'basil' => 3,
        'coriander' => 4,
        'parsley' => 4,
        'avocado' => 4,
        'mushroom' => 5,
        'banana' => 5,
        'mango' => 5,
        'pea' => 5,
        'sweetcorn' => 5,
        'broccoli' => 6,
        'cauliflower' => 6,
        'cucumber' => 6,
        'spring-onion' => 6,
        'tomato' => 6,
        'aubergine' => 7,
        'courgette' => 7,
        'bell-pepper' => 8,
        'green-chilli' => 8,
        'cabbage' => 10,
        'orange' => 14,
        'apple' => 21,
        'carrot' => 21,
        'ginger' => 21,
        'lemon' => 21,
        'lime' => 21,
        'sweet-potato' => 25,
        'onion' => 30,
        'potato' => 30,
        'garlic' => 60,

        // Dairy and eggs
        'cream' => 7,
        'milk' => 7,
        'mozzarella' => 10,
        'yoghurt' => 14,
        'cheddar-cheese' => 21,
        'egg' => 21,
        'butter' => 30,
        'parmesan' => 60,

        // Meat and fish — the short end of the scale, and the expensive end to
        // get wrong in both directions.
        'chicken-breast' => 2,
        'chicken-thigh' => 2,
        'beef-mince' => 2,
        'prawn' => 2,
        'salmon' => 2,
        'white-fish' => 2,
        'lamb' => 3,
        'hilsa' => 2,
        'rohu' => 2,
        'pork' => 3,
        'bacon' => 7,
        // This row is seeded with a "canned tuna" alias, so a tin is at least
        // as likely as a fresh steak. No guess is better than a wrong one.
        'tuna' => null,

        // Bakery
        'bread' => 5,
        'tortilla' => 10,

        // Pantry — shelf-stable by default, so only the exceptions are listed.
        'tofu' => 7,
        'mustard-paste' => 14,

        // ── Added with the wider detector vocabulary ─────────────────
        'strawberry' => 3,
        'blueberry' => 7,
        'grape' => 7,
        'watermelon' => 7,
        'pineapple' => 5,
        'papaya' => 5,
        'guava' => 5,
        'pear' => 10,
        'peach' => 5,
        'kiwi' => 10,
        'coconut' => 14,
        'okra' => 5,
        'bottle-gourd' => 10,
        'bitter-gourd' => 7,
        'pointed-gourd' => 6,
        'pumpkin' => 21,
        'radish' => 10,
        'beetroot' => 14,
        'celery' => 10,
        'green-bean' => 6,
        'lettuce' => 6,
        'sausage' => 7,
        'ham' => 7,
        'duck' => 3,
        'crab' => 2,
        'sour-cream' => 10,
        'cream-cheese' => 14,
        'jam' => null,
        'ketchup' => null,
        'mayonnaise' => 30,
        'orange-juice' => 5,
        'walnut' => null,
        'pistachio' => null,
        'raisin' => null,
        'date' => null,
    ];

    /** Days of shelf life for an ingredient, or null if it does not meaningfully expire. */
    public static function daysFor(string $slug, ?string $aisle = null): ?int
    {
        if (array_key_exists($slug, self::BY_SLUG)) {
            return self::BY_SLUG[$slug];
        }

        return self::AISLE_DEFAULTS[$aisle] ?? null;
    }

    /** @return array<string, int|null> */
    public static function aisleDefaults(): array
    {
        return self::AISLE_DEFAULTS;
    }
}
