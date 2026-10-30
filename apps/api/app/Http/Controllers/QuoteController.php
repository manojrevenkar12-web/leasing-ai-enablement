<?php

namespace App\Http\Controllers;

use App\Domain\Leasing\LeasingTerms;
use App\Domain\Leasing\RateCalculator;
use App\Http\Requests\QuoteRequest;
use App\Models\Offer;
use Illuminate\Http\JsonResponse;

class QuoteController
{
    /** A quote for other terms than the dealer's headline offer. Nothing is stored. */
    public function __invoke(QuoteRequest $request, Offer $offer, RateCalculator $calculator): JsonResponse
    {
        abort_unless($offer->status === Offer::ACTIVE, 404);
        $v = $request->validated();
        $terms = new LeasingTerms(
            (int) $v['term'],
            (int) $v['km'],
            (int) $v['down_payment_cents'],
            $offer->extra_costs_cents,
            $offer->customer_type,
        );
        $quote = $calculator->quote($offer->vehicle->list_price_cents, $offer->vehicle->segment, $terms);

        return response()->json(['data' => [
            'offer_id' => $offer->id,
            'term_months' => $terms->months,
            'km_per_year' => $terms->kmPerYear,
            'down_payment_cents' => $terms->downPaymentCents,
            'extra_costs_cents' => $terms->extraCostsCents,
            ...$quote->toArray(),
        ]]);
    }
}
