<?php

namespace App\Policies;

use App\Models\Dealer;
use App\Models\Offer;

/** A dealer changes only its own offers. */
class OfferPolicy
{
    public function update(Dealer $dealer, Offer $offer): bool
    {
        return $offer->dealer_id === $dealer->id;
    }

    public function delete(Dealer $dealer, Offer $offer): bool
    {
        return $offer->dealer_id === $dealer->id;
    }
}
