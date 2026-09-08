<?php

namespace App\Console\Commands;

use App\Models\Ingredient;
use App\Support\BengaliNames;
use Illuminate\Console\Command;

/**
 * Does the ingredients table understand what the detector is going to say?
 *
 * This is the seam where the two halves of the project meet, and it fails
 * quietly: a label the table cannot resolve does not error, it simply becomes
 * an ingredient that never appears. Running the model's class list through here
 * turns that into a list you can act on.
 *
 *   php artisan detector:check strawberries heavy_cream ground_beef
 *   php artisan detector:check --file=classes.txt
 *   php artisan detector:check --vocabulary
 */
class CheckDetectorLabels extends Command
{
    protected $signature = 'detector:check
        {labels?* : Class names, as the model emits them}
        {--file= : A file with one class name per line, or a JSON array}
        {--vocabulary : Check every prompt in vision/vocabulary.json instead}';

    protected $description = 'Check which detector class names resolve to ingredients';

    public function handle(): int
    {
        $labels = $this->gatherLabels();

        if ($labels === []) {
            $this->error('Nothing to check. Pass labels, --file, or --vocabulary.');

            return self::FAILURE;
        }

        $resolved = [];
        $missing = [];

        foreach ($labels as $label) {
            // Mirror what the sidecar does to a raw class name before it
            // travels, so this checks the string Laravel will really see.
            $cleaned = trim(str_replace(['_', '-'], ' ', $label));
            $ingredient = Ingredient::lookup($cleaned);

            if ($ingredient) {
                $resolved[] = [$label, $ingredient->name, $ingredient->name_bn ?? '—'];
            } else {
                $missing[] = $label;
            }
        }

        $this->newLine();
        $this->line(sprintf(
            '  <fg=white>%d of %d class names resolve</> (%d%%)',
            count($resolved),
            count($labels),
            (int) round(count($resolved) / max(1, count($labels)) * 100),
        ));
        $this->newLine();

        if ($resolved !== []) {
            $this->table(['detector says', 'resolves to', 'Bengali'], $resolved);
        }

        if ($missing === []) {
            $this->info('  Every class name resolves. Nothing to do.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->error('  ' . count($missing) . ' will be dropped:');

        foreach ($missing as $label) {
            $slug = Ingredient::slugify(str_replace(['_', '-'], ' ', $label));
            $bengali = BengaliNames::for($slug);

            $this->line(sprintf(
                '    <fg=red>%s</>  (slug would be <fg=yellow>%s</>)%s',
                $label,
                $slug,
                $bengali ? "  — Bengali name already known: {$bengali}" : '',
            ));
        }

        $this->newLine();
        $this->line('  Fix by adding either:');
        $this->line('    · an <fg=cyan>alias</> on an existing row in database/seeders/IngredientSeeder.php');
        $this->line('    · a new <fg=cyan>ingredient</> there, plus a Bengali name in app/Support/BengaliNames.php');
        $this->line('      and a shelf life in app/Support/ShelfLifeCatalog.php');
        $this->line('  Then: <fg=cyan>php artisan migrate:fresh --seed</>');
        $this->newLine();

        // Non-zero so this can gate a build if anyone ever wires it into CI.
        return self::FAILURE;
    }

    /** @return array<int, string> */
    private function gatherLabels(): array
    {
        if ($this->option('vocabulary')) {
            $path = base_path('vision/vocabulary.json');

            if (!is_file($path)) {
                $this->error("vision/vocabulary.json not found at {$path}");

                return [];
            }

            $raw = json_decode((string) file_get_contents($path), true);

            return collect($raw['classes'] ?? [])->pluck('ingredient')->filter()->unique()->values()->all();
        }

        if ($file = $this->option('file')) {
            if (!is_file($file)) {
                $this->error("File not found: {$file}");

                return [];
            }

            $contents = (string) file_get_contents($file);

            // Accept a plain list or the JSON array people paste out of a
            // training script — both are things a teammate will actually hand you.
            $decoded = json_decode($contents, true);

            if (is_array($decoded)) {
                return collect($decoded)->flatten()->filter(fn ($v) => is_string($v))->values()->all();
            }

            return collect(preg_split('/[\r\n,]+/', $contents))
                ->map(fn ($line) => trim($line, " \t\"'"))
                ->filter()
                ->values()
                ->all();
        }

        return $this->argument('labels');
    }
}
