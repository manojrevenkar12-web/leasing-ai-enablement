<?php

namespace App\Http\Controllers;

use App\Http\Requests\DealerOfferRequest;
use App\Http\Resources\OfferResource;
use App\Models\Dealer;
use App\Models\Offer;
use App\Support\HttpCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class DealerOfferController
{
    public function store(DealerOfferRequest $request): JsonResponse
    {
        /** @var Dealer $dealer */
        $dealer = $request->user('dealer');
        $offer = new Offer($request->validated());
        $offer->dealer()->associate($dealer);
        $offer->save();

        return (new OfferResource($offer->load(['vehicle', 'dealer'])))->response()->setStatusCode(201);
    }

    /**
     * One of the dealer's own offers, paused ones included, for the edit form. A dealer sees
     * exactly the offers it may change. The DMS polls this, so it gets an ETag to revalidate.
     */
    public function show(Request $request, Offer $offer): JsonResponse
    {
        Gate::forUser($request->user('dealer'))->authorize('update', $offer);
        $offer->load(['vehicle', 'dealer']);

        return HttpCache::json($request, ['data' => (new OfferResource($offer))->resolve($request)], maxAge: 60);
    }

    public function update(DealerOfferRequest $request, Offer $offer): OfferResource
    {
        Gate::forUser($request->user('dealer'))->authorize('update', $offer);
        $offer->fill($request->validated())->save();

        return new OfferResource($offer->load(['vehicle', 'dealer']));
    }

    public function destroy(Request $request, Offer $offer): Response
    {
        Gate::forUser($request->user('dealer'))->authorize('delete', $offer);
        $offer->delete();

        return response()->noContent();
    }
}
