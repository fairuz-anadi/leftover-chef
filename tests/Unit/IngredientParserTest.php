<?php

namespace Tests\Unit;

use App\Http\Services\IngredientParser;
use Tests\TestCase;

class IngredientParserTest extends TestCase
{
    private IngredientParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new IngredientParser();
    }

    public function test_it_splits_quantity_unit_and_name(): void
    {
        $parsed = $this->parser->parse('200 g spaghetti');

        $this->assertSame(200.0, $parsed['quantity']);
        $this->assertSame('g', $parsed['unit']);
        $this->assertSame('spaghetti', $parsed['name']);
    }

    public function test_it_understands_mixed_and_vulgar_fractions(): void
    {
        $this->assertSame(2.5, $this->parser->parse('2 1/2 cups flour')['quantity']);
        $this->assertSame(0.5, $this->parser->parse('½ tsp salt')['quantity']);
    }

    public function test_a_range_takes_the_lower_bound(): void
    {
        $this->assertSame(2.0, $this->parser->parse('2-3 tbsp olive oil')['quantity']);
    }

    public function test_it_strips_preparation_notes_and_parentheticals(): void
    {
        $parsed = $this->parser->parse('4 cloves garlic, finely chopped');

        $this->assertSame('garlic', $parsed['name']);
        $this->assertSame('clove', $parsed['unit']);

        $this->assertSame('coriander', $this->parser->parse('2 tbsp coriander (fresh)')['name']);
    }

    public function test_it_flags_optional_ingredients(): void
    {
        $this->assertTrue($this->parser->parse('1 tsp chilli flakes (optional)')['is_optional']);
        $this->assertFalse($this->parser->parse('1 tsp chilli flakes')['is_optional']);
    }

    public function test_unit_aliases_collapse_to_one_canonical_unit(): void
    {
        $this->assertSame('tbsp', $this->parser->parse('2 tablespoons soy sauce')['unit']);
        $this->assertSame('tsp', $this->parser->parse('1 teaspoon cumin')['unit']);
        $this->assertSame('g', $this->parser->parse('500 grams beef')['unit']);
    }

    public function test_of_is_dropped_after_a_unit(): void
    {
        $this->assertSame('milk', $this->parser->parse('1 cup of milk')['name']);
    }

    public function test_gram_conversion(): void
    {
        $this->assertSame(1000.0, $this->parser->toGrams(1, 'kg'));
        $this->assertSame(15.0, $this->parser->toGrams(1, 'tbsp'));
        $this->assertNull($this->parser->toGrams(null, 'g'));

        // A bare count falls back to an average "piece" weight.
        $this->assertSame(120.0, $this->parser->toGrams(2, null));
    }

    public function test_a_line_with_no_quantity_still_yields_a_name(): void
    {
        $parsed = $this->parser->parse('salt to taste');

        $this->assertNull($parsed['quantity']);
        $this->assertSame('salt', $parsed['name']);
    }
}
