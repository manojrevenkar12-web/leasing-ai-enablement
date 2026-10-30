<?php

use App\Models\Dealer;
use App\Models\Offer;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

function vehicle(string $make, string $model, int $priceEur, string $fuel = 'petrol', string $segment = 'compact'): Vehicle
{
    return Vehicle::factory()->create([
        'make' => $make, 'model' => $model, 'fuel' => $fuel, 'segment' => $segment, 'list_price_cents' => $priceEur * 100,
    ]);
}

function offerFor(Vehicle $v, array $attrs = []): Offer
{
    return Offer::factory()->for($v)->for(Dealer::factory())->create(array_merge([
        'customer_type' => 'private', 'term_months' => 36, 'km_per_year' => 10000, 'down_payment_cents' => 0, 'extra_costs_cents' => 89900,
    ], $attrs));
}

it('lists active private offers, cheapest leasing factor first', function () {
    $golf = vehicle('Volkswagen', 'Golf', 33315);
    $polo = vehicle('Volkswagen', 'Polo', 21495, segment: 'small');
    $a = offerFor($golf, ['term_months' => 24]);
    $b = offerFor($golf, ['term_months' => 48]);
    $c = offerFor($polo);
    offerFor($polo, ['customer_type' => 'business']);
    offerFor($golf)->update(['status' => Offer::PAUSED]);

    $res = $this->getJson('/api/offers')->assertOk();

    $ids = collect($res->json('data'))->pluck('id');
    $factors = collect($res->json('data'))->pluck('leasing_factor');
    expect($ids->sort()->values()->all())->toBe(collect([$a->id, $b->id, $c->id])->sort()->values()->all())
        ->and($factors->all())->toBe($factors->sort()->values()->all())
        ->and($res->json('meta.total'))->toBe(3);
});

it('filters by make, model, fuel, budget, term and mileage', function () {
    $golf = vehicle('Volkswagen', 'Golf', 33315);
    $id3 = vehicle('Volkswagen', 'ID.3', 36900, 'electric', 'ev');
    $x1 = vehicle('BMW', 'X1', 47100, 'diesel', 'suv');
    $golf36 = offerFor($golf);
    $golf48 = offerFor($golf, ['term_months' => 48, 'km_per_year' => 15000]);
    $id3o = offerFor($id3);
    $x1o = offerFor($x1);

    $ids = fn (string $q) => collect($this->getJson("/api/offers?{$q}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids('make=volkswagen'))->toBe(collect([$golf36->id, $golf48->id, $id3o->id])->sort()->values()->all())
        ->and($ids('make=VW'))->toBe([])
        ->and($ids('make=Volkswagen&model=golf'))->toBe([$golf36->id, $golf48->id])
        ->and($ids('fuel=electric'))->toBe([$id3o->id])
        ->and($ids('term=48&km=15000'))->toBe([$golf48->id])
        ->and($ids('max_rate_eur='.intdiv($x1o->fresh()->monthly_rate_cents, 100)))->not->toContain($x1o->id);
});

it('shows business offers net and only when asked for', function () {
    $golf = vehicle('Volkswagen', 'Golf', 33315);
    $private = offerFor($golf);
    $business = offerFor($golf, ['customer_type' => 'business']);

    $res = $this->getJson('/api/offers?customer_type=business')->assertOk();

    expect($res->json('data.0.id'))->toBe($business->id)
        ->and($res->json('data.0.net'))->toBeTrue()
        ->and($res->json('data.0.monthly_rate_cents'))->toBeLessThan($private->fresh()->monthly_rate_cents);
});

it('sorts by rate, total cost and newest, and paginates', function () {
    $golf = vehicle('Volkswagen', 'Golf', 33315);
    foreach ([0, 99900, 199900, 299900, 399900] as $i => $down) {
        $this->travel($i)->minutes();
        offerFor($golf, ['down_payment_cents' => $down]);
    }

    $rates = collect($this->getJson('/api/offers?sort=rate')->json('data'))->pluck('monthly_rate_cents');
    $newest = collect($this->getJson('/api/offers?sort=newest')->json('data'))->pluck('down_payment_cents');
    $page2 = $this->getJson('/api/offers?sort=rate&per_page=2&page=2')->assertOk();

    expect($rates->all())->toBe($rates->sort()->values()->all())
        ->and($newest->first())->toBe(399900)
        ->and($page2->json('meta'))->toMatchArray(['page' => 2, 'per_page' => 2, 'total' => 5, 'last_page' => 3])
        ->and($page2->json('data.0.monthly_rate_cents'))->toBe($rates[2]);
});

it('rejects filters it does not understand', function (string $query, string $field) {
    $this->getJson("/api/offers?{$query}")->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    ['sort=cheapest', 'sort'],
    ['term=30', 'term'],
    ['km=25000', 'km'],
    ['customer_type=fleet', 'customer_type'],
    ['per_page=500', 'per_page'],
    ['fuel=coal', 'fuel'],
]);

it('caches a search, serves the copy, and drops it when an offer changes', function () {
    $offer = offerFor(vehicle('Volkswagen', 'Golf', 33315));

    $this->getJson('/api/offers?make=volkswagen')->assertHeader('X-Cache', 'miss');
    $this->getJson('/api/offers?make=Volkswagen&sort=factor')->assertHeader('X-Cache', 'hit');

    $offer->update(['term_months' => 48]);

    $fresh = $this->getJson('/api/offers?make=volkswagen')->assertHeader('X-Cache', 'miss');
    expect($fresh->json('data.0.term_months'))->toBe(48);
});

it('answers 304 when the client already has the current result', function () {
    offerFor(vehicle('Volkswagen', 'Golf', 33315));
    $etag = $this->getJson('/api/offers')->assertOk()->headers->get('ETag');

    $this->getJson('/api/offers', ['If-None-Match' => $etag])->assertStatus(304);
    expect($etag)->not->toBeNull();
});

it('runs the same number of queries for 3 offers as for 30 (no N+1)', function () {
    $count = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson('/api/offers?per_page=60&sort=rate')->assertOk();

        return count(DB::getQueryLog());
    };
    $golf = vehicle('Volkswagen', 'Golf', 33315);
    Offer::factory()->count(3)->private()->for($golf)->create();
    cache()->flush();
    $few = $count();
    Offer::factory()->count(27)->private()->create();
    cache()->flush();
    $many = $count();

    expect($many)->toBe($few)->and($few)->toBeLessThanOrEqual(5);
});

it('lists makes with their number of offers', function () {
    $golf = vehicle('Volkswagen', 'Golf', 33315);
    $x1 = vehicle('BMW', 'X1', 47100, 'diesel', 'suv');
    offerFor($golf);
    offerFor($golf, ['term_months' => 48]);
    offerFor($x1);
    offerFor($x1, ['customer_type' => 'business']);

    $this->getJson('/api/offers/makes')->assertOk()->assertExactJson(['data' => [
        ['make' => 'BMW', 'offers' => 1],
        ['make' => 'Volkswagen', 'offers' => 2],
    ]]);
});

it('shows one active offer and hides paused ones', function () {
    $offer = offerFor(vehicle('Volkswagen', 'Golf', 33315));
    $paused = offerFor(vehicle('BMW', 'X1', 47100, 'diesel', 'suv'), ['status' => Offer::PAUSED]);

    $this->getJson("/api/offers/{$offer->id}")->assertOk()
        ->assertJsonPath('data.vehicle.model', 'Golf')
        ->assertJsonPath('data.dealer.id', $offer->dealer_id)
        ->assertJsonMissingPath('data.dealer.api_token_hash');
    $this->getJson("/api/offers/{$paused->id}")->assertNotFound();
    $this->getJson('/api/offers/999999')->assertNotFound();
});
