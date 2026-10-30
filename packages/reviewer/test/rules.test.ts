import { describe, expect, it } from 'vitest';
import { methods, runRules } from '../src/rules/index.js';
import { changed, input } from './helpers.js';

const ids = (files: Parameters<typeof input>) => runRules(input(...files)).findings.map((f) => `${f.rule}@${f.line}`);
const ctl = 'apps/api/app/Http/Controllers/DealerOfferController.php';

describe('team rules', () => {
  it('flags money turned into floats outside the calculator, not inside it', () => {
    const svc = changed('apps/api/app/Services/Pricing.php', `
<?php
+ $rate = (float) $offer->monthly_rate_cents / 100;
+ $eur = $offer->down_payment_cents / 100;
$ok = 1;`);
    const calc = changed('apps/api/app/Domain/Leasing/RateCalculator.php', `
<?php
+ $price = (float) $listPriceCents / 100;`);
    expect(ids([svc])).toEqual(['money-float@2', 'money-float@3']);
    expect(ids([calc])).toEqual([]);
  });

  it('flags a computed rate accepted from the client, not one that is prohibited or rendered', () => {
    const req = changed('apps/api/app/Http/Requests/DealerOfferRequest.php', `
return [
+     'monthly_rate_cents' => ['sometimes', 'integer'],
+     'leasing_factor' => ['prohibited'],
];`);
    const res = changed('apps/api/app/Http/Resources/OfferResource.php', `
return [
+     'monthly_rate_cents' => $this->monthly_rate_cents,
];`);
    expect(ids([req, res])).toEqual(['client-rate@2']);
  });

  it('flags a controller write without a policy check', () => {
    const bad = changed(ctl, `
class C {
    public function pause(Request $request, Offer $offer): Response
    {
+         $offer->update(['status' => 'paused']);
        return response()->noContent();
    }
    public function update(Request $request, Offer $offer): Response
    {
        Gate::forUser($request->user('dealer'))->authorize('update', $offer);
+         $offer->fill($request->validated())->save();
        return response()->noContent();
    }
}`);
    expect(ids([bad])).toEqual(['missing-authorization@4']);
  });

  it('flags SQL built from strings, not bound parameters', () => {
    const f = changed('apps/api/app/Http/Controllers/OfferSearchController.php', `
<?php
+ $q->whereRaw("lower(vehicles.make) = '$make'");
+ $q->whereRaw('lower(vehicles.model) = ' . $model);
+ $q->whereRaw('lower(vehicles.make) = ?', [$make]);`);
    expect(ids([f])).toEqual(['raw-sql-interpolation@2', 'raw-sql-interpolation@3']);
  });

  it('flags removed eager loading and queries inside loops', () => {
    const f = changed('apps/api/app/Http/Controllers/OfferSearchController.php', `
<?php
$page = $query->orderBy($column)
-     ->with(['vehicle', 'dealer'])
+     ->paginate(10);
foreach ($offers as $offer) {
+     $dealer = Dealer::query()->find($offer->dealer_id);
}
+ $after = Dealer::query()->find(1);`);
    expect(ids([f])).toEqual(['eager-loading-removed@3', 'eager-loading-removed@5']);
  });

  it('flags destructive migrations in up(), not in down()', () => {
    const f = changed('apps/api/database/migrations/2026_11_01_drop.php', `
public function up(): void
{
+     Schema::table('offers', fn ($t) => $t->dropColumn('extra_costs_cents'));
}
public function down(): void
{
+     Schema::dropIfExists('offer_notes');
}`, 'added');
    expect(ids([f])).toEqual(['destructive-migration@3']);
  });

  it('flags tokens and request bodies in logs, not ids and counts', () => {
    const f = changed('apps/api/app/Http/Controllers/QuoteController.php', `
<?php
+ Log::info('quote', $request->all());
+ Log::warning('dealer token ' . $request->bearerToken());
+ Log::info('quote', ['offer_id' => $offer->id, 'ms' => $ms]);`);
    expect(ids([f])).toEqual(['pii-in-logs@2', 'pii-in-logs@3']);
  });

  it('flags a validated search filter missing from the cache key', () => {
    const f = changed('apps/api/app/Http/Requests/SearchOffersRequest.php', `
class SearchOffersRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'make' => ['sometimes', 'string'],
+             'power_min_kw' => ['sometimes', 'integer'],
        ];
    }

    public function filters(): array
    {
        return [
            'make' => $text('make'),
        ];
    }
}`);
    expect(ids([f])).toEqual(['filter-missing-from-cache-key@7']);
  });

  it('flags a fixed cache key', () => {
    const f = changed('apps/api/app/Http/Controllers/OfferSearchController.php', `
<?php
+ $body = $this->cache->remember('offers:search', 300, fn () => $this->search($filters));
+ $body = $this->cache->remember($this->catalog->key('search', $f), 300, fn () => 1);`);
    expect(ids([f])).toEqual(['literal-cache-key@2']);
  });

  it('flags an exception turned into success, not one that is reported', () => {
    const f = changed('apps/api/app/Http/Controllers/QuoteController.php', `
<?php
try {
    $quote = $calculator->quote($p, $s, $t);
+ } catch (UnsupportedTerms $e) {
+     return response()->json(['data' => []]);
+ }
try {
    $x = 1;
+ } catch (Throwable $e) {
+     report($e);
+     throw $e;
+ }`);
    expect(ids([f])).toEqual(['swallowed-error@4']);
  });

  it('flags credentials, unsafe HTML and any in the web app', () => {
    const f = changed('apps/web/src/features/offers/OfferCard.tsx', `
+ const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwx';
+ return <div dangerouslySetInnerHTML={{ __html: offer.note }} />;
+ const x = data as any;`);
    expect(ids([f]).sort()).toEqual(['no-any@3', 'no-dangerous-html@2', 'secret-in-code@1']);
  });

  it('blocks a re-recorded golden master and notes pricing config changes', () => {
    const gm = changed('apps/api/tests/GoldenMaster/legacy-quotes.json', '+ {"cases": []}');
    const cfg = changed('apps/api/config/leasing.php', `
<?php
+ 'apr_percent' => 3.99,`);
    const res = runRules(input(gm, cfg));
    expect(res.findings.map((f) => f.rule)).toEqual(['pricing-behaviour']);
    expect(res.notes.map((n) => n.rule)).toEqual(['pricing-behaviour']);
  });

  it('notes application code changed without a test, as a summary note only', () => {
    const app = changed('apps/api/app/Support/X.php', '+ <?php');
    const test = changed('apps/api/tests/Feature/XTest.php', '+ <?php');
    expect(runRules(input(app)).notes.map((n) => n.rule)).toEqual(['tests-not-changed']);
    expect(runRules(input(app, test)).notes).toEqual([]);
    expect(runRules(input(app)).findings).toEqual([]);
  });

  it('ignores comments and lines the PR did not add', () => {
    const f = changed('apps/api/app/Services/Pricing.php', `
<?php
$rate = (float) $offer->monthly_rate_cents / 100;
+ // $rate = (float) $offer->monthly_rate_cents / 100;`);
    expect(ids([f])).toEqual([]);
  });
});

describe('methods', () => {
  it('splits a PHP class into methods with line ranges', () => {
    const php = ['<?php', 'class A {', '  public function a() {', '    $x = fn () => 1;', '  }', '', '  private static function b(int $x): int', '  {', '    return $x;', '  }', '}'].join('\n');
    expect(methods(php).map((m) => [m.name, m.start, m.end])).toEqual([
      ['a', 3, 5],
      ['b', 7, 10],
    ]);
  });
});
