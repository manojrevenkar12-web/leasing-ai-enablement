<?php

use App\Console\Commands\GoldenMaster;
use App\Domain\Leasing\RateCalculator;

mutates(RateCalculator::class);

it('reproduces every legacy quote except where an approved change says otherwise', function () {
    $result = GoldenMaster::verify(app(RateCalculator::class), base_path(GoldenMaster::FIXTURE), base_path(GoldenMaster::APPROVED));

    expect($result['total'])->toBe(count(GoldenMaster::inputs()))
        ->and($result['unapproved'])->toBe([])
        ->and($result['identical'] + $result['explained'])->toBe($result['total']);
});

it('has no stale approvals: every approved change explains at least one case', function () {
    $result = GoldenMaster::verify(app(RateCalculator::class), base_path(GoldenMaster::FIXTURE), base_path(GoldenMaster::APPROVED));

    foreach ($result['by_change'] as $id => $n) {
        expect($n)->toBeGreaterThan(0, "{$id} explains nothing; remove it");
    }
});

it('keeps every private quote identical to the cent', function () {
    $result = GoldenMaster::verify(app(RateCalculator::class), base_path(GoldenMaster::FIXTURE), base_path(GoldenMaster::APPROVED));
    $grid = GoldenMaster::GRID;
    $privateSupported = count($grid['segments']) * count($grid['months']) * (count($grid['km']) - 1)
        * count($grid['down_cents']) * count($grid['price_cents']) * count($grid['extra_cents']);

    // Every case that is neither business (AC-1) nor an unsupported mileage (AC-2) is identical.
    expect($result['identical'])->toBeGreaterThanOrEqual($privateSupported);
});

it('catches an unapproved change in behaviour', function () {
    // A calculator with a slightly different interest rate must be caught, not explained away.
    $drifted = new RateCalculator(
        App\Domain\Leasing\ResidualValues::fromConfig(),
        (float) config('leasing.apr_percent') + 0.01,
        (float) config('leasing.vat_factor'),
    );
    $result = GoldenMaster::verify($drifted, base_path(GoldenMaster::FIXTURE), base_path(GoldenMaster::APPROVED));

    expect(count($result['unapproved']))->toBeGreaterThan(1000);
});

it('does not let an approval explain more than it allows', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'ac');
    // Approve only the factor for business: total cost factor differences must stay unapproved.
    file_put_contents($tmp, json_encode([[
        'id' => 'AC-1', 'when' => ['customer_type' => 'business'], 'allows' => ['fields' => ['leasing_factor']],
    ]]));
    $result = GoldenMaster::verify(app(RateCalculator::class), base_path(GoldenMaster::FIXTURE), $tmp);

    expect($result['unapproved'])->not->toBe([]);
    unlink($tmp);
});
