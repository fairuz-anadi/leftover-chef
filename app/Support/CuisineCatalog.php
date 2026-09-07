<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * The country list behind the Cuisine Map Explorer.
 *
 * Every entry carries an ISO 3166-1 alpha-2 code (the key the front-end map
 * uses to highlight a country), a display name, a region bucket, and the
 * approximate lat/lng the map drops its marker on.
 */
class CuisineCatalog
{
    /** @var array<string, array{name: string, region: string, lat: float, lng: float}> */
    public const COUNTRIES = [
        'IT' => ['name' => 'Italy',        'region' => 'Europe',        'lat' => 41.87,  'lng' => 12.57],
        'FR' => ['name' => 'France',       'region' => 'Europe',        'lat' => 46.23,  'lng' => 2.21],
        'ES' => ['name' => 'Spain',        'region' => 'Europe',        'lat' => 40.46,  'lng' => -3.75],
        'GR' => ['name' => 'Greece',       'region' => 'Europe',        'lat' => 39.07,  'lng' => 21.82],
        'GB' => ['name' => 'United Kingdom', 'region' => 'Europe',      'lat' => 55.38,  'lng' => -3.44],
        'DE' => ['name' => 'Germany',      'region' => 'Europe',        'lat' => 51.17,  'lng' => 10.45],
        'PL' => ['name' => 'Poland',       'region' => 'Europe',        'lat' => 51.92,  'lng' => 19.15],
        'RU' => ['name' => 'Russia',       'region' => 'Europe',        'lat' => 61.52,  'lng' => 105.32],
        'TR' => ['name' => 'Turkey',       'region' => 'Middle East',   'lat' => 38.96,  'lng' => 35.24],
        'LB' => ['name' => 'Lebanon',      'region' => 'Middle East',   'lat' => 33.85,  'lng' => 35.86],
        'IR' => ['name' => 'Iran',         'region' => 'Middle East',   'lat' => 32.43,  'lng' => 53.69],
        'IL' => ['name' => 'Israel',       'region' => 'Middle East',   'lat' => 31.05,  'lng' => 34.85],
        'MA' => ['name' => 'Morocco',      'region' => 'Africa',        'lat' => 31.79,  'lng' => -7.09],
        'EG' => ['name' => 'Egypt',        'region' => 'Africa',        'lat' => 26.82,  'lng' => 30.80],
        'ET' => ['name' => 'Ethiopia',     'region' => 'Africa',        'lat' => 9.15,   'lng' => 40.49],
        'NG' => ['name' => 'Nigeria',      'region' => 'Africa',        'lat' => 9.08,   'lng' => 8.68],
        'ZA' => ['name' => 'South Africa', 'region' => 'Africa',        'lat' => -30.56, 'lng' => 22.94],
        'IN' => ['name' => 'India',        'region' => 'South Asia',    'lat' => 20.59,  'lng' => 78.96],
        'BD' => ['name' => 'Bangladesh',   'region' => 'South Asia',    'lat' => 23.68,  'lng' => 90.36],
        'PK' => ['name' => 'Pakistan',     'region' => 'South Asia',    'lat' => 30.38,  'lng' => 69.35],
        'LK' => ['name' => 'Sri Lanka',    'region' => 'South Asia',    'lat' => 7.87,   'lng' => 80.77],
        'NP' => ['name' => 'Nepal',        'region' => 'South Asia',    'lat' => 28.39,  'lng' => 84.12],
        'CN' => ['name' => 'China',        'region' => 'East Asia',     'lat' => 35.86,  'lng' => 104.20],
        'JP' => ['name' => 'Japan',        'region' => 'East Asia',     'lat' => 36.20,  'lng' => 138.25],
        'KR' => ['name' => 'South Korea',  'region' => 'East Asia',     'lat' => 35.91,  'lng' => 127.77],
        'TH' => ['name' => 'Thailand',     'region' => 'Southeast Asia', 'lat' => 15.87, 'lng' => 100.99],
        'VN' => ['name' => 'Vietnam',      'region' => 'Southeast Asia', 'lat' => 14.06, 'lng' => 108.28],
        'ID' => ['name' => 'Indonesia',    'region' => 'Southeast Asia', 'lat' => -0.79, 'lng' => 113.92],
        'MY' => ['name' => 'Malaysia',     'region' => 'Southeast Asia', 'lat' => 4.21,  'lng' => 101.98],
        'PH' => ['name' => 'Philippines',  'region' => 'Southeast Asia', 'lat' => 12.88, 'lng' => 121.77],
        'MX' => ['name' => 'Mexico',       'region' => 'Latin America', 'lat' => 23.63,  'lng' => -102.55],
        'BR' => ['name' => 'Brazil',       'region' => 'Latin America', 'lat' => -14.24, 'lng' => -51.93],
        'PE' => ['name' => 'Peru',         'region' => 'Latin America', 'lat' => -9.19,  'lng' => -75.02],
        'AR' => ['name' => 'Argentina',    'region' => 'Latin America', 'lat' => -38.42, 'lng' => -63.62],
        'US' => ['name' => 'United States', 'region' => 'North America', 'lat' => 37.09, 'lng' => -95.71],
        'CA' => ['name' => 'Canada',       'region' => 'North America', 'lat' => 56.13,  'lng' => -106.35],
        'AU' => ['name' => 'Australia',    'region' => 'Oceania',       'lat' => -25.27, 'lng' => 133.78],
        'NZ' => ['name' => 'New Zealand',  'region' => 'Oceania',       'lat' => -40.90, 'lng' => 174.89],
    ];

    /** Common cuisine adjectives that users type instead of a country name. */
    private const ADJECTIVES = [
        'italian' => 'IT', 'french' => 'FR', 'spanish' => 'ES', 'greek' => 'GR',
        'british' => 'GB', 'english' => 'GB', 'german' => 'DE', 'polish' => 'PL',
        'russian' => 'RU', 'turkish' => 'TR', 'lebanese' => 'LB', 'persian' => 'IR',
        'iranian' => 'IR', 'israeli' => 'IL', 'moroccan' => 'MA', 'egyptian' => 'EG',
        'ethiopian' => 'ET', 'nigerian' => 'NG', 'indian' => 'IN', 'bengali' => 'BD',
        'bangladeshi' => 'BD', 'pakistani' => 'PK', 'sri-lankan' => 'LK', 'nepali' => 'NP',
        'chinese' => 'CN', 'japanese' => 'JP', 'korean' => 'KR', 'thai' => 'TH',
        'vietnamese' => 'VN', 'indonesian' => 'ID', 'malaysian' => 'MY', 'filipino' => 'PH',
        'mexican' => 'MX', 'brazilian' => 'BR', 'peruvian' => 'PE', 'argentinian' => 'AR',
        'american' => 'US', 'canadian' => 'CA', 'australian' => 'AU',
    ];

    public static function codes(): array
    {
        return array_keys(self::COUNTRIES);
    }

    public static function find(?string $code): ?array
    {
        if (!$code) {
            return null;
        }

        $code = Str::upper(trim($code));

        return self::COUNTRIES[$code] ?? null;
    }

    /**
     * Turn whatever the user typed — "Italy", "italian", "IT" — into a country
     * code, or null when nothing matches.
     */
    public static function resolveCode(?string $value): ?string
    {
        if (!$value) {
            return null;
        }

        $needle = Str::of($value)->squish()->lower()->toString();

        if (isset(self::COUNTRIES[Str::upper($needle)])) {
            return Str::upper($needle);
        }

        foreach (self::COUNTRIES as $code => $meta) {
            if (Str::lower($meta['name']) === $needle) {
                return $code;
            }
        }

        return self::ADJECTIVES[Str::slug($needle)] ?? self::ADJECTIVES[$needle] ?? null;
    }

    public static function regionFor(?string $code): ?string
    {
        return self::find($code)['region'] ?? null;
    }

    public static function nameFor(?string $code): ?string
    {
        return self::find($code)['name'] ?? null;
    }

    /** Every country as a flat list, ready to hand to the front-end map. */
    public static function all(): array
    {
        return collect(self::COUNTRIES)
            ->map(fn (array $meta, string $code) => array_merge($meta, ['code' => $code]))
            ->values()
            ->all();
    }
}
