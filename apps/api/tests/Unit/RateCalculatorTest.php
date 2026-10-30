<?php

use App\Domain\Leasing\CustomerType;
use App\Domain\Leasing\LeasingTerms;
use App\Domain\Leasing\RateCalculator;
use App\Domain\Leasing\ResidualValues;
use App\Domain\Leasing\Segment;
use App\Domain\Leasing\UnsupportedTerms;

// Mutation testing (composer mutate): these tests answer for the domain classes.
mutates(RateCalculator::class, ResidualValues::class, LeasingTerms::class, App\Domain\Leasing\Quote::class, CustomerType::class);

function calculator(float $apr = 4.99): RateCalculator
{
    return new RateCalculator(new ResidualValues(config('leasing.residual_values')), $apr, 1.19);
}

function terms(int $months = 36, int $km = 10000, int $down = 0, int $extra = 0, CustomerType $type = CustomerType::Private): LeasingTerms
{
    return new LeasingTerms($months, $km, $down, $extra, $type);
}

it('prices a known private offer to the cent', function () {
    // Golf, 33,315 EUR, 36 months, 10,000 km: residual 56% = 18,656.40 EUR
    $q = calculator()->quote(3331500, Segment::Compact, terms());

    expect($q->residualValueCents)->toBe(1865640)
        ->and($q->monthlyRateCents)->toBe(51685)
        ->and($q->leasingFactor)->toBe(1.55)
        ->and($q->totalCostFactor)->toBe(1.55)
        ->and($q->isNet())->toBeFalse();
});

it('quotes business customers net and compares net rate to net price', function () {
    $private = calculator()->quote(3331500, Segment::Compact, terms());
    $business = calculator()->quote(3331500, Segment::Compact, terms(type: CustomerType::Business));

    expect($business->monthlyRateCents)->toBe(43432) // unrounded gross rate / 1.19, then rounded
        ->and($business->isNet())->toBeTrue()
        // net/net gives the same factor as gross/gross, give or take rounding
        ->and(abs($business->leasingFactor - $private->leasingFactor))->toBeLessThanOrEqual(0.01);
});

it('spreads down payment and one-off costs into the total cost factor only', function () {
    $plain = calculator()->quote(3331500, Segment::Compact, terms());
    $withExtra = calculator()->quote(3331500, Segment::Compact, terms(extra: 89900));

    expect($withExtra->monthlyRateCents)->toBe($plain->monthlyRateCents)
        ->and($withExtra->leasingFactor)->toBe($plain->leasingFactor)
        ->and($withExtra->totalCostFactor)->toBe(round((516.85 * 36 + 899) / 36 / 33315 * 100, 2));
});

it('lowers the rate as the down payment rises and raises it with mileage', function (Segment $segment, int $months) {
    $c = calculator();
    $rates = fn (array $ts) => array_map(fn (LeasingTerms $t) => $c->quote(4000000, $segment, $t)->monthlyRateCents, $ts);

    $byDown = $rates([terms($months, down: 0), terms($months, down: 200000), terms($months, down: 500000)]);
    $byKm = $rates([terms($months, 10000), terms($months, 15000), terms($months, 20000), terms($months, 30000)]);

    expect($byDown)->toBe(collect($byDown)->sortDesc()->values()->all())
        ->and($byKm)->toBe(collect($byKm)->sort()->values()->all())
        ->and(count(array_unique($byKm)))->toBe(4);
})->with(Segment::cases())->with([24, 36, 48, 60]);

it('never quotes a negative rate when the down payment covers everything', function () {
    $q = calculator()->quote(2000000, Segment::Small, terms(24, down: 2000000));

    expect($q->monthlyRateCents)->toBe(0);
});

it('rejects a mileage or term the residual table does not cover', function (int $months, int $km) {
    calculator()->quote(3000000, Segment::Suv, terms($months, $km));
})->with([[36, 25000], [36, 5000], [72, 10000]])->throws(UnsupportedTerms::class);

it('rejects negative money and non-positive terms', function (array $args) {
    new LeasingTerms(...$args);
})->with([
    [[0, 10000, 0, 0, CustomerType::Private]],
    [[36, 0, 0, 0, CustomerType::Private]],
    [[36, 10000, -1, 0, CustomerType::Private]],
    [[36, 10000, 0, -1, CustomerType::Private]],
])->throws(InvalidArgumentException::class);

it('reacts to the interest rate', function () {
    $low = calculator(1.99)->quote(3331500, Segment::Compact, terms());
    $high = calculator(7.99)->quote(3331500, Segment::Compact, terms());

    expect($low->monthlyRateCents)->toBeLessThan(51685)->and($high->monthlyRateCents)->toBeGreaterThan(51685);
});

it('exports a quote for the API', function () {
    expect(calculator()->quote(3331500, Segment::Compact, terms())->toArray())->toBe([
        'monthly_rate_cents' => 51685,
        'leasing_factor' => 1.55,
        'total_cost_factor' => 1.55,
        'residual_value_cents' => 1865640,
        'net' => false,
    ]);
});

it('accepts the smallest positive term and mileage', function () {
    $t = new LeasingTerms(1, 1, 0, 0, CustomerType::Private);

    expect([$t->months, $t->kmPerYear])->toBe([1, 1]);
});
