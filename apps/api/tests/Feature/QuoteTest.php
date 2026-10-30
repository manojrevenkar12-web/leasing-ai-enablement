<?php

use App\Domain\Leasing\CustomerType;
use App\Domain\Leasing\LeasingTerms;
use App\Domain\Leasing\RateCalculator;
use App\Domain\Leasing\Segment;
use App\Models\Offer;
use App\Models\Vehicle;

beforeEach(function () {
    $this->vehicle = Vehicle::factory()->create(['segment' => 'compact', 'list_price_cents' => 3331500]);
    $this->offer = Offer::factory()->for($this->vehicle)->private()->create(['extra_costs_cents' => 89900]);
});

it('quotes other terms for an offer without storing anything', function () {
    $before = $this->offer->fresh()->monthly_rate_cents;

    $res = $this->postJson("/api/offers/{$this->offer->id}/quote", ['term' => 48, 'km' => 20000, 'down_payment_cents' => 250000])->assertOk();

    $expected = app(RateCalculator::class)->quote(3331500, Segment::Compact, new LeasingTerms(48, 20000, 250000, 89900, CustomerType::Private));
    expect($res->json('data'))->toMatchArray([
        'offer_id' => $this->offer->id,
        'term_months' => 48,
        'km_per_year' => 20000,
        'monthly_rate_cents' => $expected->monthlyRateCents,
        'leasing_factor' => $expected->leasingFactor,
        'net' => false,
    ])->and($this->offer->fresh()->monthly_rate_cents)->toBe($before);
});

it('validates the quote request', function (array $body, string $field) {
    $this->postJson("/api/offers/{$this->offer->id}/quote", array_merge(['term' => 36, 'km' => 10000, 'down_payment_cents' => 0], $body))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['term' => 30], 'term'],
    [['km' => 25000], 'km'],
    [['down_payment_cents' => -1], 'down_payment_cents'],
    // more than half the list price is not offered online
    [['down_payment_cents' => 1665751], 'down_payment_cents'],
]);

it('does not quote paused offers', function () {
    $this->offer->update(['status' => Offer::PAUSED]);

    $this->postJson("/api/offers/{$this->offer->id}/quote", ['term' => 36, 'km' => 10000, 'down_payment_cents' => 0])->assertNotFound();
});

it('limits how often one client can quote', function () {
    for ($i = 0; $i < 60; $i++) {
        $this->postJson("/api/offers/{$this->offer->id}/quote", ['term' => 36, 'km' => 10000, 'down_payment_cents' => 0])->assertOk();
    }
    $this->postJson("/api/offers/{$this->offer->id}/quote", ['term' => 36, 'km' => 10000, 'down_payment_cents' => 0])->assertTooManyRequests();
});
