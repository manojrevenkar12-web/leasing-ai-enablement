<?php

namespace Database\Factories;

use App\Domain\Leasing\CustomerType;
use App\Models\Dealer;
use App\Models\Offer;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Rates are not set here: the model computes them on save, like in production.
 *
 * @extends Factory<Offer>
 */
class OfferFactory extends Factory
{
    protected $model = Offer::class;

    public function definition(): array
    {
        return [
            'dealer_id' => Dealer::factory(),
            'vehicle_id' => Vehicle::factory(),
            'customer_type' => fake()->randomElement(CustomerType::cases()),
            'term_months' => fake()->randomElement([24, 36, 48]),
            'km_per_year' => fake()->randomElement([10000, 15000, 20000]),
            'down_payment_cents' => fake()->randomElement([0, 0, 99900, 199900, 299900]),
            'extra_costs_cents' => fake()->randomElement([79000, 89900, 109000, 129000]),
            'status' => Offer::ACTIVE,
        ];
    }

    public function private(): self
    {
        return $this->state(['customer_type' => CustomerType::Private]);
    }

    public function business(): self
    {
        return $this->state(['customer_type' => CustomerType::Business]);
    }

    public function paused(): self
    {
        return $this->state(['status' => Offer::PAUSED]);
    }
}
