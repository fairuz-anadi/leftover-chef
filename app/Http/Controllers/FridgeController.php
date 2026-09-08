<?php

namespace App\Http\Controllers;

use App\Http\Services\DemoFridge;
use App\Http\Services\FreshnessService;
use App\Http\Services\RecipeSuggestionService;
use App\Http\Services\WasteLedger;
use App\Models\FridgeSession;
use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\WasteEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Everything on the one screen this app has.
 *
 * `index` returns the whole state in a single call — shelf, freshness, health
 * dial, waste counter, leaderboard, suggestions — because it is one screen and
 * six round trips to draw it would be six chances to render half of it.
 */
class FridgeController extends Controller
{
    public function __construct(
        private FreshnessService $freshness,
        private RecipeSuggestionService $suggestions,
        private WasteLedger $ledger,
        private DemoFridge $demo,
    ) {
    }

    public function index(Request $request)
    {
        $session = $this->fridge($request);

        // A brand-new visitor opens on the demo fridge rather than an empty
        // one: a freshness dashboard with nothing in it teaches nobody
        // anything, and the judge has ninety seconds.
        //
        // Keyed off the column rather than wasRecentlyCreated, which is only
        // true on the request that created the row. The Android app checks the
        // connection before it fetches anything, so by the time it asks for
        // the fridge the session already exists and nothing would stock.
        //
        // Both halves matter. The column is what stops a fridge somebody
        // emptied on purpose refilling itself on the next page load; the
        // emptiness check is what stops the demo contents landing on top of a
        // fridge that was filled some other way — by a test, or by a scan
        // confirmed before the shelf was ever fetched.
        if ($session->stocked_at === null && $session->pantryItems()->doesntExist()) {
            $this->demo->stock($session);
            $session->forceFill(['stocked_at' => now()])->save();
        }

        return response()->json($this->state($session));
    }

    /** Add one ingredient by name — the picker, and the "it missed the eggs" case. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'expires_on' => 'sometimes|nullable|date',
        ]);

        $session = $this->fridge($request);
        $ingredient = Ingredient::resolve($validated['name']);

        $given = $validated['expires_on'] ?? null;
        $estimate = $given === null ? $this->estimateFor($ingredient, $session) : null;

        PantryItem::updateOrCreate(
            ['session_id' => $session->session_id, 'ingredient_id' => $ingredient->id],
            [
                'expires_on' => $given ?? $estimate,
                'expiry_estimated' => $given === null && $estimate !== null,
                'source' => 'manual',
            ]
        );

        return response()->json(
            ['message' => $ingredient->name . ' added.'] + $this->state($session),
            Response::HTTP_CREATED
        );
    }

    /** Correct a date the app guessed, or set one it could not. */
    public function update(Request $request, PantryItem $pantryItem)
    {
        $session = $this->fridge($request);

        if ($pantryItem->session_id !== $session->session_id) {
            return response()->json(['message' => 'That is not in your fridge.'], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate(['expires_on' => 'present|nullable|date']);

        $pantryItem->expires_on = $validated['expires_on'];
        // A date somebody typed is not a guess any more, including clearing it.
        $pantryItem->expiry_estimated = false;
        $pantryItem->save();

        return response()->json(['message' => 'Date updated.'] + $this->state($session));
    }

    /**
     * Take something off the shelf.
     *
     * `binned` is the honest half of the counter: food that went in the bin is
     * recorded as lost, so the save rate means something. Without it the
     * counter would only ever go up, which would make it a decoration.
     */
    public function destroy(Request $request, PantryItem $pantryItem)
    {
        $session = $this->fridge($request);

        if ($pantryItem->session_id !== $session->session_id) {
            return response()->json(['message' => 'That is not in your fridge.'], Response::HTTP_FORBIDDEN);
        }

        $name = $pantryItem->ingredient?->name ?? 'Item';

        if ($request->boolean('binned')) {
            $status = $this->freshness->statuses($session)->get($pantryItem->ingredient_id);
            $this->ledger->record($session, $name, WasteEvent::LOST, $status['days_left'] ?? null);
        }

        $pantryItem->delete();

        return response()->json(
            ['message' => $request->boolean('binned') ? "{$name} binned." : "{$name} removed."]
            + $this->state($session)
        );
    }

    /**
     * The fast-forward button.
     *
     * Moves the session's clock on a day and reports anything that crossed
     * into 🔴 as a result — which is the simulated push notification. Doing it
     * this way rather than scheduling a real OS notification is a demo
     * decision, disclosed in the report: nobody is waiting until tomorrow to
     * see the feature work.
     */
    public function fastForward(Request $request)
    {
        $session = $this->fridge($request);

        $before = $this->freshness->statuses($session)
            ->mapWithKeys(fn (array $row) => [$row['ingredient_id'] => $row['tier']]);

        $session->fastForward((int) $request->integer('days', 1));

        $after = $this->freshness->statuses($session);

        // Only things that just turned red are worth interrupting for. An item
        // that was already red yesterday is not news.
        $alerts = $after
            ->filter(fn (array $row) => $row['tier'] === FreshnessService::TODAY
                && ($before[$row['ingredient_id']] ?? null) !== FreshnessService::TODAY)
            ->sortBy('days_left')
            ->values()
            ->all();

        return response()->json([
            'message' => 'A day passes…',
            'alerts' => $alerts,
        ] + $this->state($session));
    }

    /** Put the demo back how it started — between judges. */
    public function reset(Request $request)
    {
        $session = $this->fridge($request);
        $this->demo->reset($session);

        return response()->json(['message' => 'Demo fridge reset.'] + $this->state($session->fresh()));
    }

    /**
     * The whole screen, in one payload.
     *
     * @return array<string, mixed>
     */
    private function state(FridgeSession $session): array
    {
        $statuses = $this->freshness->statuses($session);

        $items = $session->pantryItems()
            ->with('ingredient:id,name,name_bn,slug,aisle,is_staple')
            ->get()
            ->filter(fn (PantryItem $item) => $item->ingredient !== null)
            ->map(fn (PantryItem $item) => [
                'id' => $item->id,
                'ingredient_id' => $item->ingredient_id,
                'name' => $item->ingredient->name,
                'name_bn' => $item->ingredient->name_bn,
                'aisle' => $item->ingredient->aisle,
                'is_staple' => (bool) $item->ingredient->is_staple,
                'source' => $item->source,
                'confidence' => $item->confidence,
                'expires_on' => $item->expires_on?->toDateString(),
                'freshness' => $statuses->get($item->ingredient_id),
            ])
            ->sortBy([
                // Trouble first: that is the order a person wants to read a
                // fridge in, and it puts the demo's point at the top.
                fn (array $a, array $b) => ($a['freshness']['days_left'] ?? 9999) <=> ($b['freshness']['days_left'] ?? 9999),
                fn (array $a, array $b) => strcmp($a['name'], $b['name']),
            ])
            ->values()
            ->all();

        return [
            'session' => [
                'day_offset' => $session->day_offset,
                'today' => $session->today()->toDateString(),
            ],
            'items' => $items,
            'at_risk' => $this->freshness->atRisk($session)->all(),
            'health' => $this->freshness->health($session),
            'waste' => $this->ledger->summary($session),
            'leaderboard' => $this->ledger->leaderboard($session),
            'suggestions' => $this->suggestions->suggest($session)->all(),
            'missing_links' => $this->suggestions->missingLinks($session),
        ];
    }

    private function estimateFor(Ingredient $ingredient, FridgeSession $session)
    {
        $days = $ingredient->shelfLifeDays();

        return $days === null ? null : $session->today()->copy()->addDays($days);
    }
}
