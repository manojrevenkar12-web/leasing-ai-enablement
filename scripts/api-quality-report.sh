#!/usr/bin/env bash
# Writes reports/golden-master.json and reports/mutation.json from the API's own checks; the
# enablement desk and the README read them. Fails if the refactor gate in config/quality.json fails.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/apps/api"
mkdir -p "$ROOT/reports"
php artisan leasing:golden-master --verify --report="$ROOT/reports/golden-master.json"
MIN=$(node -e "console.log(require('$ROOT/config/quality.json').refactor_gate.mutation_score_min_percent)")
OUT=$(php vendor/bin/pest --mutate --parallel --min="$MIN" 2>&1 | sed 's/\x1b\[[0-9;]*m//g') || { echo "$OUT" | tail -30; exit 1; }
echo "$OUT" | tail -5
node -e '
const out = process.argv[1];
const num = (re) => Number((out.match(re) || [])[1] ?? NaN);
const r = { score_percent: num(/Score:\s+([\d.]+)%/), tested: num(/(\d+) tested/), timeout: num(/(\d+) timeout/) || 0, untested: num(/(\d+) untested/) || 0, min_percent: Number(process.argv[2]), target: "app/Domain (RateCalculator, ResidualValues, LeasingTerms, Quote, CustomerType)" };
require("fs").writeFileSync(process.argv[3], JSON.stringify(r, null, 2) + "\n");
console.log(r);' "$OUT" "$MIN" "$ROOT/reports/mutation.json"
