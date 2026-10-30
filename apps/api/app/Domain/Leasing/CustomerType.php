<?php

namespace App\Domain\Leasing;

enum CustomerType: string
{
    case Private = 'private';
    case Business = 'business';

    /** Business customers see net prices; private customers see gross prices. */
    public function isNet(): bool
    {
        return $this === self::Business;
    }
}
