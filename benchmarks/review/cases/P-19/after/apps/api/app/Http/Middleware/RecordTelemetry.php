<?php

namespace App\Http\Middleware;

use App\Support\Telemetry;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RecordTelemetry
{
    public function __construct(private readonly Telemetry $telemetry) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->telemetry->start($request->headers->get('X-Request-Id'));

        /** @var Response $response */
        $response = $next($request);

        $t = $this->telemetry;
        $total = $t->elapsedMs();
        $response->headers->set('X-Request-Id', $t->requestId);
        $timing = sprintf('app;dur=%.1f, db;desc="%d queries";dur=%.1f', $total, $t->queries, $t->queryMs);
        if ($t->cache !== null) {
            $response->headers->set('X-Cache', $t->cache);
            $timing .= sprintf(', cache;desc="%s"', $t->cache);
        }
        $response->headers->set('Server-Timing', $timing);

        Log::channel('telemetry')->info('request', [
            'request_id' => $t->requestId,
            'route' => $request->route()?->getName() ?? 'unmatched',
            'method' => $request->method(),
            'status' => $response->getStatusCode(),
            'duration_ms' => round($total, 1),
            'db_queries' => $t->queries,
            'db_ms' => round($t->queryMs, 1),
            'cache' => $t->cache,
            // size of the body we sent (0 for 304s and streamed responses), to size the CDN tier
            'response_bytes' => strlen((string) $response->getContent()),
        ]);

        return $response;
    }
}
