<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One browser, one fridge.
 *
 * There are no accounts. The client generates an id, keeps it in localStorage
 * and sends it on every request; this row is everything the server knows about
 * that visitor. Every new fridge opens on the demo contents, whoever it belongs
 * to — a freshness dashboard with nothing in it teaches nobody anything — and
 * `stocked_at` records that it happened, so emptying the shelf on purpose is
 * not undone by the next page load.
 *
 * `day_offset` is the demo clock. Read "today" from here rather than from
 * Carbon::today() anywhere expiry is involved, or the fast-forward button will
 * move half the screen and leave the rest behind.
 */
class FridgeSession extends Model
{
    /** How far the fast-forward button is allowed to run. */
    public const MAX_OFFSET = 30;

    protected $fillable = ['session_id', 'day_offset', 'stocked_at'];

    protected $casts = [
        'day_offset' => 'integer',
        'stocked_at' => 'datetime',
    ];

    public function pantryItems()
    {
        return $this->hasMany(PantryItem::class, 'session_id', 'session_id');
    }

    public function wasteEvents()
    {
        return $this->hasMany(WasteEvent::class, 'session_id', 'session_id');
    }

    /** Today, as this session sees it. */
    public function today(): Carbon
    {
        return Carbon::today()->addDays($this->day_offset);
    }

    /** Move the clock on, and report the new offset. */
    public function fastForward(int $days = 1): int
    {
        $this->day_offset = min(self::MAX_OFFSET, max(0, $this->day_offset + $days));
        $this->save();

        return $this->day_offset;
    }

    public static function forId(string $sessionId): self
    {
        return static::firstOrCreate(['session_id' => $sessionId], ['day_offset' => 0]);
    }
}
