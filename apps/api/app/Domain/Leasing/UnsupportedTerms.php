<?php

namespace App\Domain\Leasing;

use DomainException;

/** Thrown for a term or mileage the residual-value table does not cover. */
final class UnsupportedTerms extends DomainException
{
    public static function for(Segment $segment, int $months, int $km): self
    {
        return new self("No residual value for {$segment->value}, {$months} months, {$km} km per year.");
    }
}
