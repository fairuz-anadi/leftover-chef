<?php

namespace Tests\Unit;

use App\Http\Services\GuidedCookService;
use App\Models\Recipe;
use Tests\TestCase;

class GuidedCookServiceTest extends TestCase
{
    private GuidedCookService $guide;

    protected function setUp(): void
    {
        parent::setUp();
        $this->guide = new GuidedCookService();
    }

    public function test_it_reads_durations_out_of_step_text(): void
    {
        $this->assertSame(600, $this->guide->detectSeconds('Simmer for 10 minutes.'));
        $this->assertSame(30, $this->guide->detectSeconds('Fry for 30 seconds.'));
        $this->assertSame(3600, $this->guide->detectSeconds('Rest the dough for 1 hour.'));
        $this->assertNull($this->guide->detectSeconds('Season to taste.'));
    }

    public function test_a_range_uses_the_upper_bound_so_the_timer_never_rings_early(): void
    {
        $this->assertSame(720, $this->guide->detectSeconds('Bake for 10-12 minutes.'));
    }

    public function test_steps_carry_numbers_and_detected_timers(): void
    {
        $recipe = new Recipe([
            'instructions' => ['Chop the onion.', 'Fry for 5 minutes.'],
        ]);

        $steps = $this->guide->steps($recipe);

        $this->assertCount(2, $steps);
        $this->assertSame(1, $steps[0]['number']);
        $this->assertNull($steps[0]['timer_seconds']);
        $this->assertSame(300, $steps[1]['timer_seconds']);
    }

    public function test_an_explicit_step_timer_overrides_the_detected_one(): void
    {
        $recipe = new Recipe([
            'instructions' => ['Fry for 5 minutes.'],
            'step_timers' => [420],
        ]);

        $this->assertSame(420, $this->guide->steps($recipe)[0]['timer_seconds']);
    }
}
