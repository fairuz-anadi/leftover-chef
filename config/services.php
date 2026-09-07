<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'google' => [
        // The browser is the OAuth client for Google Identity Services. Prefer
        // its public Vite ID so token audience validation cannot drift from the
        // client that initiated the sign-in flow.
        'client_id'     => env('VITE_GOOGLE_CLIENT_ID', env('GOOGLE_CLIENT_ID')),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect_uri'  => env('APP_URL', 'http://localhost:8000') . '/api/auth/google/callback',
    ],

    /*
     | Fridge Scan. The vision sidecar (vision/app.py) runs on the same laptop
     | as the API, so this is loopback only — the venue has no internet and the
     | detector must never need it.
     */
    'vision' => [
        'url' => env('VISION_URL', 'http://127.0.0.1:8001'),
        'timeout' => (int) env('VISION_TIMEOUT', 30),
        'confidence' => (float) env('VISION_CONFIDENCE', 0.12),
    ],

    /*
     | Nutrition Insights. `local` uses the bundled per-ingredient table and
     | needs no credentials; `spoonacular` and `edamam` call out to the
     | third-party APIs named in the project proposal and fall back to the
     | local estimate if the request fails.
     */
    'nutrition' => [
        'provider' => env('NUTRITION_PROVIDER', 'local'),
        'spoonacular_key' => env('SPOONACULAR_KEY'),
        'edamam_app_id' => env('EDAMAM_APP_ID'),
        'edamam_app_key' => env('EDAMAM_APP_KEY'),
    ],

];
