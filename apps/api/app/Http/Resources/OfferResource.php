<?php

namespace App\Http\Resources;

use App\Models\Offer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Offer */
class OfferResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_type' => $this->customer_type->value,
            'net' => $this->customer_type->isNet(),
            'term_months' => $this->term_months,
            'km_per_year' => $this->km_per_year,
            'down_payment_cents' => $this->down_payment_cents,
            'extra_costs_cents' => $this->extra_costs_cents,
            'monthly_rate_cents' => $this->monthly_rate_cents,
            'leasing_factor' => (float) $this->leasing_factor,
            'total_cost_factor' => (float) $this->total_cost_factor,
            'status' => $this->status,
            'vehicle' => [
                'id' => $this->vehicle->id,
                'make' => $this->vehicle->make,
                'model' => $this->vehicle->model,
                'variant' => $this->vehicle->variant,
                'fuel' => $this->vehicle->fuel,
                'power_kw' => $this->vehicle->power_kw,
                'segment' => $this->vehicle->segment->value,
                'list_price_cents' => $this->vehicle->list_price_cents,
            ],
            'dealer' => [
                'id' => $this->dealer->id,
                'name' => $this->dealer->name,
                'city' => $this->dealer->city,
            ],
        ];
    }
}
