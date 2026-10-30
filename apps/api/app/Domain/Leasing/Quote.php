<?php

namespace App\Domain\Leasing;

/**
 * The result of one quote. Rates are in cents; net for business customers, gross for private ones.
 * The leasing factor is the monthly rate as a percentage of the list price, compared on the same
 * basis (net to net, gross to gross); the total cost factor also spreads the down payment and the
 * one-off costs over the term.
 */
final readonly class Quote
{
    public function __construct(
        public int $monthlyRateCents,
        public float $leasingFactor,
        public float $totalCostFactor,
        public int $residualValueCents,
        public CustomerType $customerType,
    ) {}

    public function isNet(): bool
    {
        return $this->customerType->isNet();
    }

    /** @return array{monthly_rate_cents: int, leasing_factor: float, total_cost_factor: float, residual_value_cents: int, net: bool} */
    public function toArray(): array
    {
        return [
            'monthly_rate_cents' => $this->monthlyRateCents,
            'leasing_factor' => $this->leasingFactor,
            'total_cost_factor' => $this->totalCostFactor,
            'residual_value_cents' => $this->residualValueCents,
            'net' => $this->isNet(),
        ];
    }
}
