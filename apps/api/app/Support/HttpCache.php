<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** JSON responses with a strong ETag, so browsers and CDNs revalidate instead of re-downloading. */
final class HttpCache
{
    /** @param  array<string, mixed>  $body */
    public static function json(Request $request, array $body, int $maxAge): JsonResponse
    {
        $response = response()->json($body);
        $etag = '"'.sha1((string) $response->getContent()).'"';
        $response->setEtag(trim($etag, '"'));
        $response->setPublic()->setMaxAge($maxAge);

        if (in_array($etag, $request->getETags(), true)) {
            $response->setNotModified();
        }

        return $response;
    }
}
