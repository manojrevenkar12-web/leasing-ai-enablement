<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchOffersRequest;
use App\Http\Resources\OfferResource;
use App\Models\Offer;
use App\Support\HttpCache;
use App\Support\OfferCatalog;
use App\Support\Telemetry;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfferSearchController
{
    private const ORDER = [
        'factor' => ['offers.leasing_factor', 'asc'],
        'rate' => ['offers.monthly_rate_cents', 'asc'],
        'total' => ['offers.total_cost_factor', 'asc'],
        'newest' => ['offers.created_at', 'desc'],
    ];

    public function __construct(
        private readonly Repository $cache,
        private readonly OfferCatalog $catalog,
        private readonly Telemetry $telemetry,
    ) {}

    public function index(SearchOffersRequest $request): JsonResponse
    {
        $filters = $request->filters();
        $key = $this->catalog->key('search', $filters);
        $hit = $this->cache->has($key);
        $this->telemetry->cache($hit ? 'hit' : 'miss');

        /** @var array<string, mixed> $body */
        $body = $this->cache->remember($key, (int) config('leasing.search.cache_seconds'), fn () => $this->search($filters));

        return HttpCache::json($request, $body, maxAge: 60);
    }

    /** Makes with the number of active offers, for the filter list. */
    public function makes(Request $request): JsonResponse
    {
        $type = $request->query('customer_type') === 'business' ? 'business' : 'private';
        $key = $this->catalog->key('makes', ['customer_type' => $type]);
        $this->telemetry->cache($this->cache->has($key) ? 'hit' : 'miss');

        $body = $this->cache->remember($key, (int) config('leasing.search.cache_seconds'), fn () => [
            'data' => Offer::query()->active()
                ->where('offers.customer_type', $type)
                ->join('vehicles', 'vehicles.id', '=', 'offers.vehicle_id')
                ->groupBy('vehicles.make')
                ->orderBy('vehicles.make')
                ->select('vehicles.make', DB::raw('count(*) as offers'))
                ->get()
                ->map(fn ($row) => ['make' => $row->getAttribute('make'), 'offers' => (int) $row->getAttribute('offers')])
                ->all(),
        ]);

        return HttpCache::json($request, $body, maxAge: 300);
    }

    public function show(Request $request, Offer $offer): JsonResponse
    {
        abort_unless($offer->status === Offer::ACTIVE, 404);
        $offer->load(['vehicle', 'dealer']);

        return HttpCache::json($request, ['data' => (new OfferResource($offer))->resolve($request)], maxAge: 60);
    }

    /**
     * @param  array{make: ?string, model: ?string, fuel: ?string, customer_type: string, max_rate_eur: ?int, term: ?int, max_term: ?int, km: ?int, sort: string, page: int, per_page: int}  $f
     * @return array<string, mixed>
     */
    private function search(array $f): array
    {
        $query = Offer::query()->active()
            ->select('offers.*')
            ->join('vehicles', 'vehicles.id', '=', 'offers.vehicle_id')
            ->where('offers.customer_type', $f['customer_type'])
            ->when($f['make'], fn (Builder $q, string $make) => $q->whereRaw('lower(vehicles.make) = ?', [$make]))
            ->when($f['model'], fn (Builder $q, string $model) => $q->whereRaw('lower(vehicles.model) = ?', [$model]))
            ->when($f['fuel'], fn (Builder $q, string $fuel) => $q->where('vehicles.fuel', $fuel))
            ->when($f['max_rate_eur'], fn (Builder $q, int $max) => $q->where('offers.monthly_rate_cents', '<=', $max * 100))
            ->when($f['term'], fn (Builder $q, int $term) => $q->where('offers.term_months', $term))
            // "at most N months", for customers who do not want to commit for longer
            ->when($f['max_term'], fn (Builder $q, int $max) => $q->where('offers.term_months', '<', $max))
            ->when($f['km'], fn (Builder $q, int $km) => $q->where('offers.km_per_year', $km));

        [$column, $direction] = self::ORDER[$f['sort']];
        $page = $query->orderBy($column, $direction)->orderBy('offers.id')
            ->with(['vehicle', 'dealer'])
            ->paginate(perPage: $f['per_page'], page: $f['page']);

        return [
            'data' => OfferResource::collection($page->getCollection())->resolve(),
            'meta' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
                'filters' => $f,
            ],
        ];
    }
}
