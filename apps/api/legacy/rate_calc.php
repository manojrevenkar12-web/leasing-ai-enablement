<?php
/*
 * rate_calc.php  --  leasing rate calculator (v2, 2017)
 *
 * Used by the dealer backoffice and the offer import cron. Do not change the
 * numbers without talking to sales, dealers compare them to their own sheets.
 *
 * This file is kept exactly as it ran in production. It is the reference the
 * Laravel calculator (app/Domain/Leasing) is characterised against: see
 * tests/GoldenMaster and docs/playbooks/ai-refactoring.md.
 */

$GLOBALS['RV_TABLE'] = array(
    // segment => months => km per year => residual value in % of list price
    'small' => array(
        24 => array(10000 => 62, 15000 => 59, 20000 => 56, 30000 => 50),
        36 => array(10000 => 54, 15000 => 51, 20000 => 47, 30000 => 41),
        48 => array(10000 => 47, 15000 => 43, 20000 => 39, 30000 => 33),
        60 => array(10000 => 41, 15000 => 37, 20000 => 33, 30000 => 27),
    ),
    'compact' => array(
        24 => array(10000 => 64, 15000 => 61, 20000 => 58, 30000 => 52),
        36 => array(10000 => 56, 15000 => 53, 20000 => 49, 30000 => 43),
        48 => array(10000 => 49, 15000 => 45, 20000 => 41, 30000 => 35),
        60 => array(10000 => 43, 15000 => 39, 20000 => 35, 30000 => 29),
    ),
    'suv' => array(
        24 => array(10000 => 66, 15000 => 63, 20000 => 60, 30000 => 54),
        36 => array(10000 => 58, 15000 => 55, 20000 => 51, 30000 => 45),
        48 => array(10000 => 51, 15000 => 47, 20000 => 43, 30000 => 37),
        60 => array(10000 => 45, 15000 => 41, 20000 => 37, 30000 => 31),
    ),
    'ev' => array(
        24 => array(10000 => 58, 15000 => 55, 20000 => 52, 30000 => 46),
        36 => array(10000 => 49, 15000 => 46, 20000 => 42, 30000 => 36),
        48 => array(10000 => 41, 15000 => 37, 20000 => 33, 30000 => 27),
        60 => array(10000 => 35, 15000 => 31, 20000 => 27, 30000 => 21),
    ),
);
$GLOBALS['APR'] = 4.99;      // dealer bank, yearly
$GLOBALS['VAT'] = 1.19;

/*
 * $price  gross list price in EUR (float)
 * $months 24/36/48/60
 * $km     km per year
 * $down   down payment (Sonderzahlung) gross EUR
 * $type   'private' or 'business'
 * $seg    small / compact / suv / ev
 * $extra  transfer + registration gross EUR
 *
 * returns array(rate, factor, total_factor, rv)
 */
function calc_rate($price, $months, $km, $down, $type, $seg, $extra = 0)
{
    global $RV_TABLE, $APR, $VAT;

    if (!isset($RV_TABLE[$seg])) $seg = 'compact';
    if (!isset($RV_TABLE[$seg][$months])) $months = 36;
    if (isset($RV_TABLE[$seg][$months][$km])) {
        $pct = $RV_TABLE[$seg][$months][$km];
    } else {
        $pct = $RV_TABLE[$seg][$months][10000]; // TODO other km
    }

    $rv = round($price * $pct / 100, 2);
    $i = $APR / 12 / 100;
    $fin = $price - $down;
    $rate = ($fin - $rv / pow(1 + $i, $months)) * $i / (1 - pow(1 + $i, -$months));
    if ($rate < 0) $rate = 0;

    if ($type == 'business') {
        $rate = $rate / $VAT;
        $down = $down / $VAT;
        $extra = $extra / $VAT;
    }
    $rate = round($rate, 2);

    // leasing factor = rate / list price * 100
    $factor = round($rate / $price * 100, 2);
    // total cost factor: one-off costs spread over the term
    $total = round(($rate * $months + $down + $extra) / $months / $price * 100, 2);

    return array($rate, $factor, $total, $rv);
}
