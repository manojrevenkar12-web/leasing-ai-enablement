<?php

namespace App\Domain\Leasing;

/** Residual values in % of the gross list price, by segment, term and mileage. */
final readonly class ResidualValues
{
    /** @param array<string, array<int, array<int, int>>> $table */
    public function __construct(private array $table) {}

    public static function fromConfig(): self
    {
        /** @var array<string, array<int, array<int, int>>> $table */
        $table = config('leasing.residual_values');

        return new self($table);
    }

    /**
     * The legacy calculator priced an unknown mileage as if it were 10,000 km, which overstates the
     * residual value and understates the rate. That is now an error (approved change AC-2).
     */
    public function percent(Segment $segment, int $months, int $km): int
    {
        return $this->table[$segment->value][$months][$km]
            ?? throw UnsupportedTerms::for($segment, $months, $km);
    }
}
