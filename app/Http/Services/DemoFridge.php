<?php

namespace App\Http\Services;

use App\Models\FridgeSession;
use App\Models\Ingredient;
use App\Models\PantryItem;

/**
 * The fridge a new visitor opens on.
 *
 * The proposal calls this out as simulated and it is worth being straight
 * about why: a freshness dashboard is meaningless on an empty shelf, and
 * waiting real days for a realistic mixed state is not something you can do
 * with a judge standing at the desk. So a new session starts with a fridge
 * that already has a story in it — something overdue, something due today,
 * a couple of things a week out, and the usual cupboard staples with no dates
 * at all.
 *
 * Offsets are relative to the session's own clock, so this stays true however
 * many times the fast-forward button has been pressed, and re-seeding on the
 * morning of the exhibition always produces a live "expires today" item.
 */
class DemoFridge
{
    /** [ingredient, days until it expires] — null means it does not expire. */
    private const CONTENTS = [
        ['Spinach', -1],          // 🔴 already over
        ['Milk', 0],              // 🔴 today
        ['Chicken Breast', 1],    // 🟡
        ['Yoghurt', 2],           // 🟡
        ['Tomato', 3],            // 🟡
        ['Bell Pepper', 5],       // 🟢
        ['Green Chilli', 6],
        ['Coriander', 6],
        ['Egg', 9],
        ['Lemon', 12],
        ['Ginger', 14],
        ['Garlic', 21],
        ['Onion', 24],
        ['Potato', 26],
        ['Rice', null],
        ['Lentils', null],
        ['Chopped Tomatoes', null],
        ['Vegetable Oil', null],
        ['Salt', null],
        ['Turmeric', null],
        ['Cumin', null],
        ['Chilli Powder', null],
    ];

    public function stock(FridgeSession $session): int
    {
        $today = $session->today();
        $added = 0;

        foreach (self::CONTENTS as [$name, $daysLeft]) {
            $ingredient = Ingredient::lookup($name);

            if (!$ingredient) {
                continue;
            }

            PantryItem::updateOrCreate(
                ['session_id' => $session->session_id, 'ingredient_id' => $ingredient->id],
                [
                    'expires_on' => $daysLeft === null ? null : $today->copy()->addDays($daysLeft),
                    'expiry_estimated' => false,
                    'source' => 'seed',
                ]
            );

            $added++;
        }

        return $added;
    }

    /** Wipe the session back to the starting fridge — the between-judges reset. */
    public function reset(FridgeSession $session): int
    {
        $session->pantryItems()->delete();
        $session->wasteEvents()->delete();
        $session->update(['day_offset' => 0]);
        $session->refresh();

        return $this->stock($session);
    }
}
