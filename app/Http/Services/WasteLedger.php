<?php

namespace App\Http\Services;

use App\Models\FridgeSession;
use App\Models\WasteEvent;
use Illuminate\Support\Collection;

/**
 * The food-waste-saved counter, and the leaderboard around it.
 *
 * This is the number that turns SDG 12 from a claim into a measurement, so it
 * is worth being careful about what it actually counts: **ingredients used
 * while they were still good**. Not meals cooked, not recipes viewed. One row
 * per ingredient rescued, and one per ingredient lost, both recorded as they
 * happen.
 *
 * The rival households are openly fabricated — they exist so the number has a
 * scale to be read against, the way a step counter is meaningless until it
 * sits next to a goal. The API marks them `is_you = false` and the UI says
 * "sample households"; nothing here pretends they are real users.
 */
class WasteLedger
{
    /**
     * Fixed so the leaderboard does not reshuffle between two judges looking
     * at it, and pitched so a decent demo session lands mid-table and can
     * climb — a board you cannot move is not worth showing.
     *
     * @var array<int, array{name: string, rescued: int}>
     */
    private const HOUSEHOLDS = [
        ['name' => 'The Rahman family', 'rescued' => 34],
        ['name' => 'Flat 4B, Tejgaon', 'rescued' => 21],
        ['name' => 'Nusrat & Arif', 'rescued' => 12],
        ['name' => 'Hall 3, Room 210', 'rescued' => 6],
        ['name' => 'Shanto (first week)', 'rescued' => 2],
    ];

    public function record(FridgeSession $session, string $name, string $kind, ?int $daysLeft): WasteEvent
    {
        return WasteEvent::create([
            'session_id' => $session->session_id,
            'ingredient_name' => $name,
            'kind' => $kind,
            'days_left' => $daysLeft,
        ]);
    }

    /** @param Collection<int, array<string, mixed>>|array<int, array<string, mixed>> $items */
    public function recordRescues(FridgeSession $session, $items): int
    {
        $recorded = 0;

        foreach ($items as $item) {
            $this->record($session, $item['name'], WasteEvent::RESCUED, $item['days_left'] ?? null);
            $recorded++;
        }

        return $recorded;
    }

    /** @return array<string, mixed> */
    public function summary(FridgeSession $session): array
    {
        $events = $session->wasteEvents()->get();

        $rescued = $events->where('kind', WasteEvent::RESCUED);
        $lost = $events->where('kind', WasteEvent::LOST);
        $handled = $rescued->count() + $lost->count();

        return [
            'rescued' => $rescued->count(),
            'lost' => $lost->count(),
            // Of everything that reached a decision point, how much was saved.
            'save_rate' => $handled === 0 ? null : (int) round($rescued->count() / $handled * 100),
            'recent' => $rescued->sortByDesc('id')->take(5)->map(fn (WasteEvent $event) => [
                'name' => $event->ingredient_name,
                'days_left' => $event->days_left,
            ])->values()->all(),
        ];
    }

    /**
     * This session against the sample households, highest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function leaderboard(FridgeSession $session): array
    {
        $yours = $session->wasteEvents()->rescued()->count();

        $rows = collect(self::HOUSEHOLDS)
            ->map(fn (array $row) => $row + ['is_you' => false])
            ->push(['name' => 'You, right now', 'rescued' => $yours, 'is_you' => true])
            ->sortByDesc('rescued')
            ->values();

        return $rows
            ->map(fn (array $row, int $index) => $row + ['position' => $index + 1])
            ->all();
    }
}
