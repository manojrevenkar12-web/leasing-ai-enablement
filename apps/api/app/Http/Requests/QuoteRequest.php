<?php

namespace App\Http\Requests;

use App\Models\Offer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class QuoteRequest extends FormRequest
{
    /** Down payments above this share of the list price are not offered online. */
    public const MAX_DOWN_PAYMENT_SHARE = 0.5;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var Offer $offer */
        $offer = $this->route('offer');
        $maxDown = (int) floor($offer->vehicle->list_price_cents * self::MAX_DOWN_PAYMENT_SHARE);

        return [
            'term' => ['required', 'integer', Rule::in(config('leasing.terms_months'))],
            'km' => ['required', 'integer', Rule::in(config('leasing.mileages_km'))],
            'down_payment_cents' => ['required', 'integer', 'min:0', "max:{$maxDown}"],
        ];
    }
}
