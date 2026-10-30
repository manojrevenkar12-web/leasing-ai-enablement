<?php

use App\Models\Dealer;
use App\Models\Offer;
use App\Models\Vehicle;

beforeEach(function () {
    $this->log = tempnam(sys_get_temp_dir(), 'telemetry');
    config(['logging.channels.telemetry.handler_with.stream' => $this->log]);
    app('log')->forgetChannel('telemetry');
});

afterEach(fn () => @unlink($this->log));

function lines(string $path): array
{
    return array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", (string) file_get_contents($path))));
}

it('tags every response with a request id and server timing', function () {
    $res = $this->getJson('/api/offers')->assertOk();

    expect($res->headers->get('X-Request-Id'))->toMatch('/^[0-9a-f-]{36}$/')
        ->and($res->headers->get('Server-Timing'))->toMatch('/^app;dur=[\d.]+, db;desc="\d+ queries";dur=[\d.]+, cache;desc="miss"$/');
});

it('keeps a caller\'s request id, but not one that could forge log lines', function () {
    $this->getJson('/api/offers', ['X-Request-Id' => 'abc-12345-trace'])->assertHeader('X-Request-Id', 'abc-12345-trace');

    $forged = $this->getJson('/api/offers', ['X-Request-Id' => "x\n{\"status\":200}"])->headers->get('X-Request-Id');
    expect($forged)->toMatch('/^[0-9a-f-]{36}$/');
});

it('writes one JSON line per request without tokens or request bodies', function () {
    Dealer::factory()->withToken('secret-dealer-token')->create();
    $vehicle = Vehicle::factory()->create();

    $this->postJson('/api/dealer/offers', [
        'vehicle_id' => $vehicle->id, 'customer_type' => 'private', 'term_months' => 36, 'km_per_year' => 10000,
        'down_payment_cents' => 123456, 'extra_costs_cents' => 0,
    ], ['Authorization' => 'Bearer secret-dealer-token'])->assertCreated();

    $raw = (string) file_get_contents($this->log);
    $line = lines($this->log)[0];
    expect($line['context'])->toMatchArray(['route' => 'dealer.offers.store', 'method' => 'POST', 'status' => 201])
        ->and($line['context']['db_queries'])->toBeGreaterThan(0)
        ->and($raw)->not->toContain('secret-dealer-token')
        ->and($raw)->not->toContain('123456');
});

it('records cache hits', function () {
    Offer::factory()->private()->create();
    $this->getJson('/api/offers');
    $this->getJson('/api/offers');

    expect(array_column(array_column(lines($this->log), 'context'), 'cache'))->toBe(['miss', 'hit']);
});

it('records how many bytes each response sent', function () {
    Offer::factory()->private()->create();
    $full = $this->getJson('/api/offers')->assertOk();
    $this->getJson('/api/offers', ['If-None-Match' => $full->headers->get('ETag')])->assertStatus(304);

    $sizes = array_column(array_column(lines($this->log), 'context'), 'response_bytes');
    expect($sizes)->toBe([strlen((string) $full->getContent()), 0]);
});
