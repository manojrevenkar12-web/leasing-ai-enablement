---
name: add-search-filter
description: Add a filter to the offer search API (request validation, cache key, query, tests); use when a search parameter is added or changed.
---

# Add a search filter

Search results are cached under a key built from `SearchOffersRequest::filters()`. A filter that is
validated but missing from `filters()` makes two different searches share one cached result, which
customers notice as "wrong offers". Follow every step.

1. `apps/api/app/Http/Requests/SearchOffersRequest.php`
   - add the rule in `rules()`; reject unknown values (`Rule::in`, `Rule::enum`), never default silently;
   - add the normalised value in `filters()` (lower-case strings, cast numbers) and its type in the
     PHPDoc return shape.
2. `apps/api/app/Http/Controllers/OfferSearchController.php`: add a `->when()` in `search()` with a
   bound parameter (no string-built SQL). If it needs a new index, add a migration (expand only).
3. Tests in `apps/api/tests/Feature/OfferSearchTest.php`:
   - the filter narrows results;
   - an invalid value is a 422;
   - two searches that differ only in this filter both miss the cache (`X-Cache: miss`).
4. Run `run_check api-tests` (MCP) or `php artisan test --filter OfferSearchTest`, then `composer stan`.
5. In the PR description, say which index serves the filter.
