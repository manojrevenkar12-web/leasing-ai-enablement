<?php

namespace App\Support;

use Illuminate\Contracts\Cache\Repository;

/**
 * The version of the offer catalogue. Search results are cached under a key that contains it, so
 * a write anywhere invalidates every cached search at once, on any cache store (no tags needed).
 */
final readonly class OfferCatalog
{
    private const KEY = 'offers:catalog-version';

    public function __construct(private Repository $cache) {}

    public function version(): int
    {
        return (int) $this->cache->rememberForever(self::KEY, fn () => 1);
    }

    public function changed(): void
    {
        if (! $this->cache->has(self::KEY)) {
            $this->cache->forever(self::KEY, 1);
        }
        $this->cache->increment(self::KEY);
    }

    /** @param  array<string, scalar|null>  $filters */
    public function key(string $kind, array $filters): string
    {
        ksort($filters);

        return sprintf('offers:v%d:%s:%s', $this->version(), $kind, sha1((string) json_encode($filters)));
    }
}
