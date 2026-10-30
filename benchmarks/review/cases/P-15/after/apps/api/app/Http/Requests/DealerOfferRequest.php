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
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'vehicle_id' => [$required, 'integer', 'exists:vehicles,id'],
            // An offer is for private or for business customers for good: switching it would move
            // its price between gross and net under the same id. Dealers create a second offer.
            'customer_type' => $creating ? ['required', Rule::enum(CustomerType::class)] : ['prohibited'],
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
