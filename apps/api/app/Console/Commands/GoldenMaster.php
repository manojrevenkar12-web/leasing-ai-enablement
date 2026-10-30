<?php

namespace App\Console\Commands;

use App\Domain\Leasing\CustomerType;
use App\Domain\Leasing\LeasingTerms;
use App\Domain\Leasing\RateCalculator;
use App\Domain\Leasing\Segment;
use App\Domain\Leasing\UnsupportedTerms;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Characterisation of the legacy rate calculator.
 *
 *   --record  runs legacy/rate_calc.php over the input grid and writes the fixture. Done once,
 *             before the refactor; re-recording would erase what the refactor is checked against.
 *   --verify  runs the new calculator over the same inputs and reports every difference, split
 *             into differences an approved change explains and differences nobody approved.
 */
class GoldenMaster extends Command
{
    protected $signature = 'leasing:golden-master {--record} {--verify} {--report=}';

    protected $description = 'Record the legacy calculator, or verify the new one against it';

    public const FIXTURE = 'tests/GoldenMaster/legacy-quotes.json';

    public const APPROVED = 'tests/GoldenMaster/approved-changes.json';

    /** Includes 25,000 km on purpose: the legacy code silently priced it as 10,000 km. */
    public const GRID = [
        'segments' => ['small', 'compact', 'suv', 'ev'],
        'months' => [24, 36, 48, 60],
        'km' => [10000, 15000, 20000, 25000, 30000],
        'down_cents' => [0, 99900, 250000, 500000],
        'price_cents' => [1459000, 2149500, 2979000, 3449000, 4189990, 5290000, 6350000, 8990000],
        'types' => ['private', 'business'],
        'extra_cents' => [0, 89900],
    ];

    public function handle(RateCalculator $calculator): int
    {
        if ($this->option('record')) {
            return $this->record();
        }
        $result = self::verify($calculator, base_path(self::FIXTURE), base_path(self::APPROVED));
        $this->table(['', 'cases'], [
            ['total', $result['total']],
            ['identical', $result['identical']],
            ['explained by an approved change', $result['explained']],
            ['NOT approved', count($result['unapproved'])],
        ]);
        foreach ($result['by_change'] as $id => $n) {
            $this->line("  {$id}: {$n} cases");
        }
        if ($report = $this->option('report')) {
            file_put_contents((string) $report, json_encode(array_merge($result, ['unapproved' => array_slice($result['unapproved'], 0, 20)]), JSON_PRETTY_PRINT));
        }

        return $result['unapproved'] === [] && ! in_array(0, $result['by_change'], true) ? self::SUCCESS : self::FAILURE;
    }

    private function record(): int
    {
        if (file_exists(base_path(self::FIXTURE)) && ! $this->confirm('The fixture exists. Re-recording erases the reference. Continue?')) {
            return self::FAILURE;
        }
        require_once base_path('legacy/rate_calc.php');
        $cases = [];
        foreach (self::inputs() as $in) {
            [$seg, $m, $km, $down, $price, $type, $extra] = $in;
            [$rate, $factor, $total, $rv] = calc_rate($price / 100, $m, $km, $down / 100, $type, $seg, $extra / 100);
            $cases[] = [...$in, (int) round($rate * 100), $factor, $total, (int) round($rv * 100)];
        }
        file_put_contents(base_path(self::FIXTURE), json_encode([
            'recorded_from' => 'legacy/rate_calc.php',
            'fields' => ['segment', 'months', 'km', 'down_cents', 'price_cents', 'customer_type', 'extra_cents', 'rate_cents', 'leasing_factor', 'total_cost_factor', 'residual_cents'],
            'cases' => $cases,
        ]));
        $this->info(count($cases).' cases recorded');

        return self::SUCCESS;
    }

    /** @return list<array{string, int, int, int, int, string, int}> */
    public static function inputs(): array
    {
        $g = self::GRID;
        $out = [];
        foreach ($g['segments'] as $s) {
            foreach ($g['months'] as $m) {
                foreach ($g['km'] as $km) {
                    foreach ($g['down_cents'] as $d) {
                        foreach ($g['price_cents'] as $p) {
                            foreach ($g['types'] as $t) {
                                foreach ($g['extra_cents'] as $e) {
                                    $out[] = [$s, $m, $km, $d, $p, $t, $e];
                                }
                            }
                        }
                    }
                }
            }
        }

        return $out;
    }

    /**
     * @return array{total: int, identical: int, explained: int, by_change: array<string, int>, unapproved: list<array<string, mixed>>}
     */
    public static function verify(RateCalculator $calculator, string $fixturePath, string $approvedPath): array
    {
        $fixture = json_decode((string) file_get_contents($fixturePath), true);
        $approved = json_decode((string) file_get_contents($approvedPath), true);
        if (! is_array($fixture) || ! is_array($approved)) {
            throw new RuntimeException('Golden master fixture or approved changes unreadable');
        }
        $byChange = array_fill_keys(array_column($approved, 'id'), 0);
        $identical = 0;
        $explained = 0;
        $unapproved = [];
        $supportedKm = config('leasing.mileages_km');

        foreach ($fixture['cases'] as $c) {
            [$seg, $m, $km, $down, $price, $type, $extra, $rate, $factor, $total, $rv] = $c;
            $case = ['customer_type' => $type, 'km_supported' => in_array($km, $supportedKm, true), 'segment' => $seg, 'months' => $m];
            try {
                $q = $calculator->quote($price, Segment::from($seg), new LeasingTerms($m, $km, $down, $extra, CustomerType::from($type)));
                $diff = array_keys(array_filter([
                    'rate_cents' => $q->monthlyRateCents !== $rate,
                    'leasing_factor' => abs($q->leasingFactor - $factor) > 1e-9,
                    'total_cost_factor' => abs($q->totalCostFactor - $total) > 1e-9,
                    'residual_cents' => $q->residualValueCents !== $rv,
                ]));
                $outcome = $diff === [] ? null : ['fields' => $diff, 'new' => ['leasing_factor' => $q->leasingFactor, 'total_cost_factor' => $q->totalCostFactor]];
            } catch (UnsupportedTerms) {
                $outcome = ['exception' => 'UnsupportedTerms'];
            }
            if ($outcome === null) {
                $identical++;

                continue;
            }
            $match = self::explain($approved, $case, $outcome, $c);
            if ($match !== null) {
                $explained++;
                $byChange[$match]++;
            } else {
                $unapproved[] = ['input' => array_slice($c, 0, 7), 'legacy' => array_slice($c, 7), 'difference' => $outcome];
            }
        }

        return ['total' => count($fixture['cases']), 'identical' => $identical, 'explained' => $explained, 'by_change' => $byChange, 'unapproved' => $unapproved];
    }

    /**
     * The id of the approved change that explains this difference, if any. A change explains a
     * difference only when the case matches its selector AND the difference is exactly what it
     * allows (the listed fields, or the listed exception) AND, if the change names an expected
     * result, the new values are that result. Without the last part an approval would hide any
     * error in the fields it allows (mutation testing found exactly that).
     *
     * @param  list<array<string, mixed>>  $approved
     * @param  array<string, mixed>  $case
     * @param  array<string, mixed>  $outcome
     * @param  list<mixed>  $legacy  the fixture row
     */
    private static function explain(array $approved, array $case, array $outcome, array $legacy): ?string
    {
        foreach ($approved as $change) {
            foreach ($change['when'] as $k => $v) {
                if (($case[$k] ?? null) !== $v) {
                    continue 2;
                }
            }
            if (isset($outcome['exception']) && ($change['allows']['exception'] ?? null) === $outcome['exception']) {
                return $change['id'];
            }
            if (isset($outcome['fields']) && array_diff($outcome['fields'], $change['allows']['fields'] ?? []) === []) {
                $expected = isset($change['expect']) ? self::expected((string) $change['expect'], $legacy) : null;
                if ($expected === null || $expected == array_intersect_key($outcome['new'], $expected)) {
                    return $change['id'];
                }
            }
        }

        return null;
    }

    /**
     * What an approved change says the new values must be, computed from the legacy row.
     *
     * @param  list<mixed>  $row
     * @return array<string, float>
     */
    private static function expected(string $rule, array $row): array
    {
        [, $months, , $down, $price, , $extra, $rate] = $row;
        $vat = (float) config('leasing.vat_factor');

        return match ($rule) {
            // AC-1: same net rate as before, compared to the net price; one-off costs net as well.
            'net-basis' => [
                'leasing_factor' => round(($rate / 100) / ($price / 100 / $vat) * 100, 2),
                'total_cost_factor' => round((($rate / 100) * $months + $down / 100 / $vat + $extra / 100 / $vat) / $months / ($price / 100 / $vat) * 100, 2),
            ],
            default => throw new RuntimeException("Unknown expectation {$rule} in approved changes"),
        };
    }
}
