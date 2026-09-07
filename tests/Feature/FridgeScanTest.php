<?php

namespace Tests\Feature;

use App\Http\Services\DetectionMapper;
use App\Models\Ingredient;
use App\Models\PantryItem;
use App\Models\User;
use Database\Seeders\IngredientSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Fridge Scan: photo in, candidate ingredients out, nothing written until the
 * cook confirms.
 *
 * The sidecar is faked here. What is worth testing is our half — that detector
 * labels land on the right ingredient rows, that duplicates collapse, that
 * unknown names surface instead of vanishing, and that a scan never silently
 * edits somebody's fridge.
 */
class FridgeScanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(IngredientSeeder::class);
    }

    /** @return array<string, mixed> */
    private function detection(string $ingredient, float $confidence, array $box, ?string $label = null): array
    {
        return [
            'label' => $label ?? strtolower($ingredient),
            'ingredient' => $ingredient,
            'confidence' => $confidence,
            'box' => $box,
        ];
    }

    /**
     * A real (if tiny) PNG.
     *
     * UploadedFile::fake()->image() draws one with GD, and this PHP build has
     * no GD - which is fine for the app, since Laravel only ever forwards the
     * bytes to the sidecar and never decodes them. The validator does call
     * getimagesize(), so the fixture has to be a genuine image rather than
     * random bytes.
     */
    private function fakePhoto(string $name = 'fridge.png'): UploadedFile
    {
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA'
            . 'DUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );

        return UploadedFile::fake()->createWithContent($name, $png);
    }

    private function fakeSidecar(array $detections, array $image = ['width' => 1280, 'height' => 960]): void
    {
        Http::fake([
            '*/detect' => Http::response([
                'detections' => $detections,
                'image' => $image,
                'meta' => ['backend' => 'world', 'weights' => 'yolov8s-worldv2.pt', 'elapsed_ms' => 412.0],
            ]),
            '*/health' => Http::response([
                'status' => 'ok',
                'detector' => ['ready' => true, 'backend' => 'world', 'class_count' => 49],
            ]),
        ]);
    }

    public function test_detector_labels_resolve_through_the_alias_table(): void
    {
        // Nothing in the vocabulary is spelled the way the ingredients table
        // spells it. If the alias lookup regresses, this is what catches it.
        $mapped = (new DetectionMapper())->map([
            $this->detection('capsicum', 0.71, [10, 10, 60, 60]),
            $this->detection('tin of tomatoes', 0.64, [80, 10, 130, 60]),
            $this->detection('carton of milk', 0.55, [10, 80, 60, 130]),
        ]);

        $this->assertSame(
            ['Bell Pepper', 'Chopped Tomatoes', 'Milk'],
            collect($mapped['items'])->pluck('name')->sort()->values()->all()
        );
        $this->assertSame([], $mapped['unmatched']);
    }

    public function test_repeated_sightings_collapse_to_one_chip_but_keep_every_box(): void
    {
        $mapped = (new DetectionMapper())->map([
            $this->detection('Tomato', 0.41, [0, 0, 50, 50]),
            $this->detection('Tomato', 0.88, [200, 0, 250, 50]),
            $this->detection('Tomato', 0.63, [400, 0, 450, 50]),
        ]);

        $this->assertCount(1, $mapped['items']);
        $this->assertSame(3, $mapped['items'][0]['count']);
        $this->assertCount(3, $mapped['items'][0]['boxes']);
        // The chip shows the best sighting, not the last one seen.
        $this->assertSame(0.88, $mapped['items'][0]['confidence']);
    }

    public function test_an_unknown_label_is_surfaced_rather_than_dropped(): void
    {
        $mapped = (new DetectionMapper())->map([
            $this->detection('Tomato', 0.9, [0, 0, 10, 10]),
            $this->detection('Dragonfruit', 0.5, [20, 20, 30, 30]),
        ]);

        $this->assertCount(1, $mapped['items']);
        $this->assertCount(1, $mapped['unmatched']);
        $this->assertSame('Dragonfruit', $mapped['unmatched'][0]['name']);
    }

    public function test_scanning_returns_candidates_without_touching_the_fridge(): void
    {
        $this->fakeSidecar([
            $this->detection('Tomato', 0.82, [10, 10, 90, 90]),
            $this->detection('Egg', 0.64, [120, 10, 200, 90]),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(
            '/api/pantry/scan',
            ['photo' => $this->fakePhoto()],
            ['Accept' => 'application/json'],
        );

        $response->assertOk()
            ->assertJsonPath('meta.ingredient_count', 2)
            ->assertJsonPath('data.0.name', 'Tomato');

        $this->assertSame(0, $user->pantryItems()->count(), 'a scan must not write to the fridge on its own');
    }

    public function test_confirming_a_scan_adds_the_items_with_their_provenance(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/pantry/scan/confirm', [
            'items' => [
                ['name' => 'Tomato', 'detected_as' => 'tomato', 'confidence' => 0.82],
                ['name' => 'Egg', 'detected_as' => 'carton of eggs', 'confidence' => 0.64],
            ],
        ]);

        $response->assertCreated();

        $tomato = PantryItem::where('user_id', $user->id)
            ->where('ingredient_id', Ingredient::lookup('Tomato')->id)
            ->firstOrFail();

        $this->assertSame('scan', $tomato->source);
        $this->assertSame('tomato', $tomato->detected_as);
        $this->assertEqualsWithDelta(0.82, $tomato->confidence, 0.0001);
        $this->assertSame(2, $user->pantryItems()->count());
    }

    public function test_confirming_a_scan_does_not_wipe_what_is_already_on_the_shelf(): void
    {
        // A photo of the top shelf should not delete the rice in the cupboard.
        $user = User::factory()->create();
        $rice = Ingredient::lookup('Rice');

        PantryItem::create([
            'user_id' => $user->id,
            'ingredient_id' => $rice->id,
            'expires_on' => now()->addDays(40),
        ]);

        $this->actingAs($user)
            ->postJson('/api/pantry/scan/confirm', [
                'items' => [['name' => 'Tomato', 'confidence' => 0.9]],
            ])
            ->assertCreated();

        $this->assertSame(2, $user->pantryItems()->count());
        $this->assertNotNull($user->pantryItems()->where('ingredient_id', $rice->id)->first()->expires_on);
    }

    public function test_a_missing_sidecar_reports_itself_instead_of_500ing(): void
    {
        Http::fake(fn (Request $request) => throw new \Illuminate\Http\Client\ConnectionException('connection refused'));

        $response = $this->post(
            '/api/pantry/scan',
            ['photo' => $this->fakePhoto()],
            ['Accept' => 'application/json'],
        );

        $response->assertStatus(503)->assertJsonPath('vision_offline', true);
    }

    public function test_the_scan_endpoint_rejects_things_that_are_not_photos(): void
    {
        $this->post(
            '/api/pantry/scan',
            ['photo' => UploadedFile::fake()->create('recipe.pdf', 40, 'application/pdf')],
            ['Accept' => 'application/json'],
        )->assertStatus(422);
    }
}
