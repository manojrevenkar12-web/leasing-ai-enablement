<?php

// Business settings for leasing quotes. The residual values and the APR are the ones the legacy
// calculator (legacy/rate_calc.php) has used since 2017; changing them changes every quote, so a
// change here is a pricing decision, reviewed like one.

return [
    'apr_percent' => 4.99,
    // Segments the dealer bank finances at a different APR than apr_percent.
    'apr_percent_by_segment' => [
        'ev' => 3.99, // dealer bank EV campaign from 1 Nov 2026
    ],
    'vat_factor' => 1.19,

    'terms_months' => [24, 36, 48, 60],
    'mileages_km' => [10000, 15000, 20000, 30000],

    // segment => months => km per year => residual value in % of the gross list price
    'residual_values' => [
        'small' => [
            24 => [10000 => 62, 15000 => 59, 20000 => 56, 30000 => 50],
            36 => [10000 => 54, 15000 => 51, 20000 => 47, 30000 => 41],
            48 => [10000 => 47, 15000 => 43, 20000 => 39, 30000 => 33],
            60 => [10000 => 41, 15000 => 37, 20000 => 33, 30000 => 27],
        ],
        'compact' => [
            24 => [10000 => 64, 15000 => 61, 20000 => 58, 30000 => 52],
            36 => [10000 => 56, 15000 => 53, 20000 => 49, 30000 => 43],
            48 => [10000 => 49, 15000 => 45, 20000 => 41, 30000 => 35],
            60 => [10000 => 43, 15000 => 39, 20000 => 35, 30000 => 29],
        ],
        'suv' => [
            24 => [10000 => 66, 15000 => 63, 20000 => 60, 30000 => 54],
            36 => [10000 => 58, 15000 => 55, 20000 => 51, 30000 => 45],
            48 => [10000 => 51, 15000 => 47, 20000 => 43, 30000 => 37],
            60 => [10000 => 45, 15000 => 41, 20000 => 37, 30000 => 31],
        ],
        'ev' => [
            24 => [10000 => 58, 15000 => 55, 20000 => 52, 30000 => 46],
            36 => [10000 => 49, 15000 => 46, 20000 => 42, 30000 => 36],
            48 => [10000 => 41, 15000 => 37, 20000 => 33, 30000 => 27],
            60 => [10000 => 35, 15000 => 31, 20000 => 27, 30000 => 21],
        ],
    ],

    // Search
    'search' => [
        'per_page' => 24,
        'max_per_page' => 60,
        'cache_seconds' => 300,
    ],
];
