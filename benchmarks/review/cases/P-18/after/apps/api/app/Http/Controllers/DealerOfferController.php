<?php

namespace App\Http\Controllers;

use App\Http\Requests\DealerOfferRequest;
use App\Http\Resources\OfferResource;
use App\Models\Dealer;
use App\Models\Offer;
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
     * Create or update the dealer's offer for one vehicle and set of terms, so the DMS can push its
     * whole stock every night without keeping our ids. Same vehicle, customer type, term and
     * mileage is the same offer; down payment, extra costs and status are what changes.
     */
    public function upsert(DealerOfferRequest $request): JsonResponse
    {
        /** @var Dealer $dealer */
        $dealer = $request->user('dealer');
        $v = $request->validated();

        $offer = Offer::query()->firstOrNew([
            'vehicle_id' => $v['vehicle_id'],
            'customer_type' => $v['customer_type'],
            'term_months' => $v['term_months'],
            'km_per_year' => $v['km_per_year'],
        ]);
        $offer->fill($v);
        if (! $offer->exists) {
            $offer->dealer()->associate($dealer);
        }
        $offer->save();

        return (new OfferResource($offer->load(['vehicle', 'dealer'])))
            ->response()->setStatusCode($offer->wasRecentlyCreated ? 201 : 200);
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
