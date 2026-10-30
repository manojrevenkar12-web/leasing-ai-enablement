<?php

namespace App\Domain\Leasing;

enum Segment: string
{
    case Small = 'small';
    case Compact = 'compact';
    case Suv = 'suv';
    case Ev = 'ev';
}
