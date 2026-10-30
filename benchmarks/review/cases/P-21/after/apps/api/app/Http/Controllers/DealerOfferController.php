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
     * For each of the dealer's active offers, the best leasing factor any other dealer has for the
     * same vehicle and terms, so the dashboard can show which offers are undercut.
     */
    public function benchmark(Request $request): JsonResponse
    {
        /** @var Dealer $dealer */
        $dealer = $request->user('dealer');
        $offers = $dealer->offers()->active()->with('vehicle')->orderBy('offers.id')->get();

        return response()->json(['data' => $offers->map(function (Offer $offer) use ($dealer): array {
            $best = Offer::query()->active()
                ->where('vehicle_id', $offer->vehicle_id)
                ->where('customer_type', $offer->customer_type->value)
                ->where('term_months', $offer->term_months)
                ->where('km_per_year', $offer->km_per_year)
                ->where('dealer_id', '!=', $dealer->id)
                ->min('leasing_factor');

            return [
                'offer_id' => $offer->id,
                'vehicle' => $offer->vehicle->make.' '.$offer->vehicle->model,
                'leasing_factor' => (float) $offer->leasing_factor,
                'best_other_factor' => $best === null ? null : (float) $best,
                'undercut' => $best !== null && (float) $best < (float) $offer->leasing_factor,
            ];
        })->all()]);
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
