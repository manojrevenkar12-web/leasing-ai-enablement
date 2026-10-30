<?php

namespace App\Http\Requests;

use App\Domain\Leasing\CustomerType;
use App\Models\Offer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DealerOfferRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'vehicle_id' => [$required, 'integer', 'exists:vehicles,id'],
            'customer_type' => [$required, Rule::enum(CustomerType::class)],
            'term_months' => [$required, 'integer', Rule::in(config('leasing.terms_months'))],
            'km_per_year' => [$required, 'integer', Rule::in(config('leasing.mileages_km'))],
            'down_payment_cents' => [$required, 'integer', 'min:0', 'max:5000000'],
            'extra_costs_cents' => [$required, 'integer', 'min:0', 'max:500000'],
            'status' => ['sometimes', Rule::in([Offer::ACTIVE, Offer::PAUSED])],
            // Rates are computed, never accepted from the client.
            'monthly_rate_cents' => ['prohibited'],
            'leasing_factor' => ['prohibited'],
        ];
    }
}
