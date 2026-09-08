<?php

namespace App\Http\Services;

use App\Models\FridgeSession;
use App\Models\PantryItem;
use Illuminate\Support\Collection;

/**
 * How close everything in the fridge is to being thrown away.
 *
 * Three tiers, and only three, because the whole point is that a person
 * glancing at a shelf can sort it instantly:
 *
 *   🟢 Fresh      four days or more
 *   🟡 Use soon   one to three days
 *   🔴 Use today  today, or already past it
 *
 * Everything downstream — the badges, the countdown bars, the health chart,
 * the notification, the recipe ranking — reads its tiers from here, so there is
 * one definition of "at risk" in the app rather than four that drift apart.
 *
 * Every date comparison goes through `$session->today()`, never
 * `Carbon::today()`. That indirection is what makes the fast-forward button
 * move the entire screen at once instead of half of it.
 */
class FreshnessService
{
    /** Past this many days out, nothing is urgent. Also the countdown bar's full width. */
    public const HORIZON_DAYS = 7;

    /** At or inside this, an item is 🟡 or worse and shows up as at-risk. */
    public const SOON_DAYS = 3;

    public const FRESH = 'fresh';
    public const SOON = 'soon';
    public const TODAY = 'today';

    /**
     * Every dated item in the fridge, keyed by ingredient id.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function statuses(FridgeSession $session): Collection
    {
        return $session->pantryItems()
            ->with('ingredient:id,name,name_bn,slug,aisle,is_staple')
            ->whereNotNull('expires_on')
            ->get()
            ->filter(fn (PantryItem $item) => $item->ingredient !== null)
            ->mapWithKeys(fn (PantryItem $item) => [
                $item->ingredient_id => $this->describe($item, $session),
            ]);
    }

    /**
     * The 🔴/🟡 shelf, most urgent first — what the notification and the
     * "cook this tonight" prompt are both built on.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function atRisk(FridgeSession $session): Collection
    {
        return $this->statuses($session)
            ->filter(fn (array $row) => $row['tier'] !== self::FRESH)
            ->sortBy('days_left')
            ->values();
    }

    /**
     * The fridge health dashboard: how much of what you own is still good.
     *
     * Counts items, not weight or money, because that is the only quantity the
     * app actually knows and inventing the others would be theatre.
     *
     * @return array<string, mixed>
     */
    public function health(FridgeSession $session): array
    {
        $total = $session->pantryItems()->count();
        $statuses = $this->statuses($session);

        $today = $statuses->where('tier', self::TODAY)->count();
        $soon = $statuses->where('tier', self::SOON)->count();
        $fresh = $statuses->where('tier', self::FRESH)->count();
        // Salt, rice, oil: real things on the shelf with no meaningful date.
        $undated = max(0, $total - $statuses->count());

        $tracked = max(1, $today + $soon + $fresh);

        return [
            'total' => $total,
            'fresh' => $fresh,
            'soon' => $soon,
            'today' => $today,
            'at_risk' => $soon + $today,
            'undated' => $undated,
            'percent_fresh' => (int) round($fresh / $tracked * 100),
            'percent_soon' => (int) round($soon / $tracked * 100),
            'percent_today' => (int) round($today / $tracked * 100),
            // One number for the radial dial. 100 is a fridge with nothing in
            // trouble; it falls as things approach their date.
            'score' => (int) round($fresh / $tracked * 100),
        ];
    }

    /** Urgency 0..1 for the recipe ranking. */
    public function urgency(int $daysLeft): float
    {
        if ($daysLeft <= 0) {
            return 1.0;
        }

        if ($daysLeft >= self::HORIZON_DAYS) {
            return 0.0;
        }

        return round(1 - ($daysLeft / self::HORIZON_DAYS), 4);
    }

    public function tier(int $daysLeft): string
    {
        return match (true) {
            $daysLeft <= 0 => self::TODAY,
            $daysLeft <= self::SOON_DAYS => self::SOON,
            default => self::FRESH,
        };
    }

    /** @return array<string, mixed> */
    private function describe(PantryItem $item, FridgeSession $session): array
    {
        $daysLeft = (int) $session->today()->diffInDays($item->expires_on, false);
        $tier = $this->tier($daysLeft);

        return [
            'ingredient_id' => (int) $item->ingredient_id,
            'pantry_item_id' => (int) $item->id,
            'name' => (string) $item->ingredient->name,
            'name_bn' => $item->ingredient->name_bn,
            'aisle' => (string) $item->ingredient->aisle,
            'is_staple' => (bool) $item->ingredient->is_staple,
            'expires_on' => $item->expires_on->toDateString(),
            'estimated' => (bool) $item->expiry_estimated,
            'days_left' => $daysLeft,
            'tier' => $tier,
            'label' => $this->label($daysLeft),
            'urgency' => $this->urgency($daysLeft),
            // How much of the countdown bar is still filled, 0..1. Kept on the
            // server so the bar and the badge can never disagree.
            'life_remaining' => round(max(0, min(1, $daysLeft / self::HORIZON_DAYS)), 3),
        ];
    }

    private function label(int $daysLeft): string
    {
        return match (true) {
            $daysLeft < -1 => abs($daysLeft) . ' days over',
            $daysLeft === -1 => '1 day over',
            $daysLeft === 0 => 'Use today',
            $daysLeft === 1 => '1 day left',
            default => $daysLeft . ' days left',
        };
    }
}
