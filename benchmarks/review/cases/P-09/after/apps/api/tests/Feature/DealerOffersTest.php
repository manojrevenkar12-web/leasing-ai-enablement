<?php

use App\Models\Dealer;
use App\Models\Offer;
use App\Models\Vehicle;

beforeEach(function () {
    $this->dealer = Dealer::factory()->withToken('token-of-dealer-a')->create();
    $this->other = Dealer::factory()->withToken('token-of-dealer-b')->create();
    $this->vehicle = Vehicle::factory()->create(['segment' => 'suv', 'list_price_cents' => 4576000]);
    $this->as = fn (string $token) => ['Authorization' => "Bearer {$token}"];
});

function newOffer(array $override = []): array
{
    return array_merge([
        'customer_type' => 'private', 'term_months' => 36, 'km_per_year' => 15000,
        'down_payment_cents' => 199900, 'extra_costs_cents' => 109000,
    ], $override);
}

it('needs a valid dealer token', function () {
    $this->postJson('/api/dealer/offers', newOffer(['vehicle_id' => $this->vehicle->id]))->assertUnauthorized();
    $this->postJson('/api/dealer/offers', newOffer(['vehicle_id' => $this->vehicle->id]), ($this->as)('wrong'))->assertUnauthorized();
});

it('creates an offer and computes its rate', function () {
    $res = $this->postJson('/api/dealer/offers', newOffer(['vehicle_id' => $this->vehicle->id]), ($this->as)('token-of-dealer-a'))
        ->assertCreated();

    $offer = Offer::query()->findOrFail($res->json('data.id'));
    expect($offer->dealer_id)->toBe($this->dealer->id)
        ->and($offer->monthly_rate_cents)->toBeGreaterThan(0)
        ->and($res->json('data.monthly_rate_cents'))->toBe($offer->monthly_rate_cents);
});

it('refuses a rate typed in by the dealer', function () {
    $this->postJson('/api/dealer/offers', newOffer(['vehicle_id' => $this->vehicle->id, 'monthly_rate_cents' => 9900]), ($this->as)('token-of-dealer-a'))
        ->assertUnprocessable()->assertJsonValidationErrors('monthly_rate_cents');
});

it('lets a dealer change its own offer and reprices it', function () {
    $offer = Offer::factory()->for($this->dealer)->for($this->vehicle)->private()->create(['term_months' => 36]);
    $before = $offer->monthly_rate_cents;

    $this->patchJson("/api/dealer/offers/{$offer->id}", ['term_months' => 24], ($this->as)('token-of-dealer-a'))
        ->assertOk()->assertJsonPath('data.term_months', 24);

    expect($offer->fresh()->monthly_rate_cents)->not->toBe($before);
});

it('lets a dealer pause an offer whose terms are no longer priced', function () {
    $offer = Offer::factory()->for($this->dealer)->for($this->vehicle)->private()->create(['term_months' => 36, 'km_per_year' => 30000]);
    config(['leasing.residual_values.suv.36' => [10000 => 58, 15000 => 55, 20000 => 51]]);
    app()->forgetInstance(\App\Domain\Leasing\RateCalculator::class);

    $this->patchJson("/api/dealer/offers/{$offer->id}", ['status' => Offer::PAUSED], ($this->as)('token-of-dealer-a'))
        ->assertOk()->assertJsonPath('data.status', Offer::PAUSED);
});

it('does not let a dealer change or delete another dealer\'s offer', function () {
    $offer = Offer::factory()->for($this->other)->for($this->vehicle)->create();

    $this->patchJson("/api/dealer/offers/{$offer->id}", ['term_months' => 24], ($this->as)('token-of-dealer-a'))->assertForbidden();
    $this->deleteJson("/api/dealer/offers/{$offer->id}", [], ($this->as)('token-of-dealer-a'))->assertForbidden();
    expect(Offer::query()->find($offer->id))->not->toBeNull();
});

it('deletes its own offer', function () {
    $offer = Offer::factory()->for($this->dealer)->for($this->vehicle)->create();

    $this->deleteJson("/api/dealer/offers/{$offer->id}", [], ($this->as)('token-of-dealer-a'))->assertNoContent();
    expect(Offer::query()->find($offer->id))->toBeNull();
});

it('validates dealer input', function (array $override, string $field) {
    $this->postJson('/api/dealer/offers', newOffer(array_merge(['vehicle_id' => $this->vehicle->id], $override)), ($this->as)('token-of-dealer-a'))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['vehicle_id' => 999999], 'vehicle_id'],
    [['term_months' => 30], 'term_months'],
    [['km_per_year' => 25000], 'km_per_year'],
    [['down_payment_cents' => -5], 'down_payment_cents'],
    [['customer_type' => 'fleet'], 'customer_type'],
]);

it('never stores the token, only its hash', function () {
    expect(Dealer::query()->pluck('api_token_hash')->all())->not->toContain('token-of-dealer-a')
        ->and($this->dealer->api_token_hash)->toBe(hash('sha256', 'token-of-dealer-a'));
});
