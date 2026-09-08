<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One browser, one fridge.
 *
 * There are no accounts. The client generates an id, keeps it in localStorage
 * and sends it on every request; this row is everything the server knows about
 * that visitor. A judge who picks up the laptop gets the demo fridge; a judge
 * who opens it on their own phone gets an empty one, and neither has to sign in.
 *
 * `day_offset` is the demo clock. Read "today" from here rather than from
 * Carbon::today() anywhere expiry is involved, or the fast-forward button will
 * move half the screen and leave the rest behind.
 */
class FridgeSession extends Model
{
    /** How far the fast-forward button is allowed to run. */
    public const MAX_OFFSET = 30;

    protected $fillable = ['session_id', 'day_offset'];

    protected $casts = ['day_offset' => 'integer'];

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
