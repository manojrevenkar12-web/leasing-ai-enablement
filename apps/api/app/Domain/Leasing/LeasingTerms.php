<?php

namespace App\Domain\Leasing;

use InvalidArgumentException;

/**
 * What the customer chooses for one quote. Money is in cents, always gross (incl. VAT), the way
 * dealers enter it; the calculator converts to net for business customers.
 */
final readonly class LeasingTerms
{
    public function __construct(
        public int $months,
        public int $kmPerYear,
        public int $downPaymentCents,
        public int $extraCostsCents,
        public CustomerType $customerType,
        /** dealer discount on the list price (Händlerrabatt), gross; the residual value stays on the list price */
        public int $discountCents = 0,
    ) {
        if ($months <= 0 || $kmPerYear <= 0) {
            throw new InvalidArgumentException('Term and mileage must be positive.');
        }
        if ($downPaymentCents < 0 || $extraCostsCents < 0 || $discountCents < 0) {
            throw new InvalidArgumentException('Down payment, extra costs and discount cannot be negative.');
        }
    }
}
