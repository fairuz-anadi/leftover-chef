<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | There are none. The app talks to exactly one thing that is not itself:
    | the vision sidecar, on loopback, on this laptop. That is the point — the
    | venue has no internet, so a dependency on a hosted service would be a
    | dependency on the demo failing.
    |
    */

    'vision' => [
        'url' => env('VISION_URL', 'http://127.0.0.1:8001'),
        'timeout' => (int) env('VISION_TIMEOUT', 30),
        'confidence' => (float) env('VISION_CONFIDENCE', 0.10),
        'image_size' => (int) env('VISION_IMAGE_SIZE', 800),
    ],

];
