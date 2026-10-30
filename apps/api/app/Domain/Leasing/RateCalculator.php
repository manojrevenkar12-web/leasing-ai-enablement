<?php

namespace App\Domain\Leasing;

/**
 * Monthly leasing rate as an annuity with a residual value (balloon), the way the dealer bank
 * prices it. Replaces legacy/rate_calc.php and is characterised against it: for every input the
 * golden master covers, it returns the same numbers, except where an approved change in
 * tests/GoldenMaster/approved-changes.json says otherwise.
 *
 * The arithmetic deliberately follows the legacy order of operations in floating point (rounding
 * the residual value to cents first, the rate to cents last) so private quotes stay identical to
 * the cent; results leave this class as integer cents.
 */
final readonly class RateCalculator
{
    public function __construct(
        private ResidualValues $residualValues,
        private float $aprPercent,
        private float $vatFactor,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            ResidualValues::fromConfig(),
            (float) config('leasing.apr_percent'), // @pest-mutate-ignore equivalent: the config value is a float already
            (float) config('leasing.vat_factor'), // @pest-mutate-ignore equivalent: the config value is a float already
        );
    }

    public function quote(int $listPriceCents, Segment $segment, LeasingTerms $terms): Quote
    {
        $price = $listPriceCents / 100;
        $residual = round($price * $this->residualValues->percent($segment, $terms->months, $terms->kmPerYear) / 100, 2);

        $rate = max(0.0, $this->annuity($price - $terms->downPaymentCents / 100, $residual, $terms->months));
        $down = $terms->downPaymentCents / 100;
        $extra = $terms->extraCostsCents / 100;
        $basePrice = $price;

        if ($terms->customerType->isNet()) {
            $rate /= $this->vatFactor;
            $down /= $this->vatFactor;
            $extra /= $this->vatFactor;
            // Compare net to net (approved change AC-1: the legacy code divided the net rate by
            // the gross price, which made business offers look 19% cheaper than they are).
            $basePrice = $price / $this->vatFactor;
        }
        $rate = round($rate, 2);

        return new Quote(
            monthlyRateCents: self::cents($rate),
            leasingFactor: round($rate / $basePrice * 100, 2),
            totalCostFactor: round(($rate * $terms->months + $down + $extra) / $terms->months / $basePrice * 100, 2),
            residualValueCents: self::cents($residual),
            customerType: $terms->customerType,
        );
    }

    /** Monthly payment that pays off $financed down to $residual over $months at the APR. */
    private function annuity(float $financed, float $residual, int $months): float
    {
        $i = $this->aprPercent / 12 / 100;

        return ($financed - $residual / (1 + $i) ** $months) * $i / (1 - (1 + $i) ** -$months);
    }

    private static function cents(float $euros): int
    {
        return (int) round($euros * 100); // @pest-mutate-ignore equivalent: an integral float is coerced to the same int
    }
}
