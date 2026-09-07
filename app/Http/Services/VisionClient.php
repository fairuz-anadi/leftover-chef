<?php

namespace App\Http\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Talks to the local vision sidecar (vision/app.py).
 *
 * The sidecar is a separate process on 127.0.0.1 rather than a hosted API on
 * purpose: the exhibition hall has no internet, so inference has to happen on
 * the laptop we carry in. Everything here is loopback traffic.
 */
class VisionClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly int $timeout,
    ) {
    }

    public static function fromConfig(): self
    {
        return new self(
            rtrim((string) config('services.vision.url'), '/'),
            (int) config('services.vision.timeout'),
        );
    }

    /**
     * Is the sidecar up and holding usable weights?
     *
     * @return array{online: bool, status: string, detector: array<string, mixed>, error: string|null}
     */
    public function health(): array
    {
        try {
            $response = Http::timeout(3)->get($this->baseUrl . '/health');

            if (!$response->successful()) {
                return $this->offline("vision service replied {$response->status()}");
            }

            $body = $response->json();

            return [
                'online' => true,
                'status' => (string) ($body['status'] ?? 'unknown'),
                'detector' => (array) ($body['detector'] ?? []),
                'error' => null,
            ];
        } catch (\Throwable $exception) {
            return $this->offline($exception->getMessage());
        }
    }

    /**
     * Run detection on an uploaded photo.
     *
     * @return array{detections: array<int, array<string, mixed>>, image: array<string, int>, meta: array<string, mixed>}
     *
     * @throws RuntimeException when the sidecar is unreachable or refuses the image.
     */
    public function detect(UploadedFile $image, float $confidence): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->attach(
                    'image',
                    file_get_contents($image->getRealPath()),
                    $image->getClientOriginalName() ?: 'fridge.jpg',
                    ['Content-Type' => $image->getMimeType()],
                )
                ->post($this->baseUrl . '/detect', [
                    ['name' => 'confidence', 'contents' => (string) $confidence],
                ]);
        } catch (\Throwable $exception) {
            Log::warning('vision sidecar unreachable', ['error' => $exception->getMessage()]);

            throw new RuntimeException(
                'The vision service is not running. Start it with scripts/start-demo.ps1, '
                . 'or add ingredients by hand while it comes up.',
                503,
                $exception,
            );
        }

        if (!$response->successful()) {
            $detail = $response->json('detail') ?? $response->body();

            Log::warning('vision sidecar rejected an image', [
                'status' => $response->status(),
                'detail' => $detail,
            ]);

            throw new RuntimeException(
                is_string($detail) && $detail !== ''
                    ? $detail
                    : 'The vision service could not read that photo.',
                $response->status() >= 500 ? 502 : 422,
            );
        }

        $body = $response->json();

        return [
            'detections' => (array) ($body['detections'] ?? []),
            'image' => (array) ($body['image'] ?? []),
            'meta' => (array) ($body['meta'] ?? []),
        ];
    }

    /** @return array{online: bool, status: string, detector: array<string, mixed>, error: string} */
    private function offline(string $error): array
    {
        return [
            'online' => false,
            'status' => 'offline',
            'detector' => [],
            'error' => $error,
        ];
    }
}
