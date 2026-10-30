<?php

namespace App\Http\Controllers;

use App\Domain\Leasing\UnsupportedTerms;
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

    public function update(DealerOfferRequest $request, Offer $offer): OfferResource
    {
        Gate::forUser($request->user('dealer'))->authorize('update', $offer);
        $offer->fill($request->validated());

        try {
            $offer->save();
        } catch (UnsupportedTerms $e) {
            // Terms that the residual-value table no longer covers (e.g. after a mileage was
            // withdrawn) cannot be repriced. That must not stop a dealer from pausing the offer.
            report($e);
        }

        return new OfferResource($offer->load(['vehicle', 'dealer']));
    }

    public function destroy(Request $request, Offer $offer): Response
    {
        Gate::forUser($request->user('dealer'))->authorize('delete', $offer);
        $offer->delete();

        return response()->noContent();
    }
}
