<?php

namespace App\Http\Requests;

use App\Domain\Leasing\CustomerType;
use App\Models\Offer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DealerOfferRequest extends FormRequest
{
    /**
     * Most dealer management systems export amounts in euros ("1999.90"), not cents. Accept those
     * as down_payment_eur / extra_costs_eur and convert them, so dealers need no mapping on their
     * side. The cents fields win if both are sent; the rules below then validate the cents.
     */
    protected function prepareForValidation(): void
    {
        foreach (['down_payment', 'extra_costs'] as $field) {
            $eur = $this->input("{$field}_eur");
            if (is_numeric($eur) && ! $this->has("{$field}_cents")) {
                $this->merge(["{$field}_cents" => (int) ($eur * 100)]);
            }
        }
    }

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
