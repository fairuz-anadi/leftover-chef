<?php

namespace App\Http\Controllers;

use App\Http\Services\DetectionMapper;
use App\Http\Services\VisionClient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

/**
 * Fridge Scan — photo in, candidate ingredients out.
 *
 * This endpoint deliberately does not touch the cook's fridge. It answers
 * "here is what the camera thinks it saw, with boxes and confidences"; the
 * cook confirms the chips in the UI and a separate call writes them. A 70%
 * accurate model behind a confirm step is a 100% reliable demo, and it is
 * also just the honest interaction — nobody wants a computer silently
 * deciding what is in their kitchen.
 */
class FridgeScanController extends Controller
{
    public function __construct(private DetectionMapper $mapper)
    {
    }

    /** GET /api/pantry/scan/status — is the detector up? Used to pick the UI copy. */
    public function status()
    {
        return response()->json(VisionClient::fromConfig()->health());
    }

    /** POST /api/pantry/scan — multipart photo. Works signed out, same as ingredient search. */
    public function scan(Request $request)
    {
        $validated = $request->validate([
            'photo' => 'required|image|mimes:jpeg,jpg,png,webp,bmp|max:12288',
            'confidence' => 'sometimes|numeric|min:0.01|max:0.95',
        ]);

        $confidence = (float) ($validated['confidence'] ?? config('services.vision.confidence'));

        try {
            $result = VisionClient::fromConfig()->detect($request->file('photo'), $confidence);
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'vision_offline' => $exception->getCode() === 503,
            ], $exception->getCode() >= 400 ? $exception->getCode() : Response::HTTP_BAD_GATEWAY);
        }

        $mapped = $this->mapper->map($result['detections']);

        return response()->json([
            'data' => $mapped['items'],
            'unmatched' => $mapped['unmatched'],
            'image' => $result['image'],
            'meta' => array_merge($result['meta'], [
                'detection_count' => count($result['detections']),
                'ingredient_count' => count($mapped['items']),
            ]),
        ]);
    }
}
