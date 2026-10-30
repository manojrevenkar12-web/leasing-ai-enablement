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
    ) {
        if ($months <= 0 || $kmPerYear <= 0) {
            throw new InvalidArgumentException('Term and mileage must be positive.');
        }
        if ($downPaymentCents < 0 || $extraCostsCents < 0) {
            throw new InvalidArgumentException('Down payment and extra costs cannot be negative.');
        }
    }
}
