<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Per-request measurements: request id, database queries and their time, cache hit or miss.
 * Written as one JSON log line per request and as response headers; never request bodies or
 * personal data.
 */
final class Telemetry
{
    public string $requestId;

    public int $queries = 0;

    public float $queryMs = 0.0;

    public ?string $cache = null;

    private float $startedAt;

    public function __construct()
    {
        $this->requestId = (string) Str::uuid();
        $this->startedAt = microtime(true);
    }

    public function start(?string $incomingId): void
    {
        $this->startedAt = microtime(true);
        $this->queries = 0;
        $this->queryMs = 0.0;
        $this->cache = null;
        // Accept the caller's id only if it looks like one, so logs cannot be injected into.
        $this->requestId = $incomingId !== null && preg_match('/^[A-Za-z0-9-]{8,64}$/', $incomingId) === 1
            ? $incomingId
            : (string) Str::uuid();
    }

    public function query(float $ms): void
    {
        $this->queries++;
        $this->queryMs += $ms;
    }

    public function cache(string $status): void
    {
        $this->cache = $status;
    }

    public function elapsedMs(): float
    {
        return (microtime(true) - $this->startedAt) * 1000;
    }
}
