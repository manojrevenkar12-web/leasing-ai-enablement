<?php

namespace App\Providers;

use App\Domain\Leasing\RateCalculator;
use App\Models\Dealer;
use App\Models\Offer;
use App\Policies\OfferPolicy;
use App\Support\OfferCatalog;
use App\Support\Telemetry;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RateCalculator::class, fn () => RateCalculator::fromConfig());
        $this->app->singleton(OfferCatalog::class);
        $this->app->scoped(Telemetry::class);
    }

    public function boot(): void
    {
        // Lazy loading is a bug here: it is how N+1 queries reach production.
        Model::preventLazyLoading(! $this->app->isProduction());
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        DB::listen(fn (QueryExecuted $q) => $this->app->make(Telemetry::class)->query($q->time));

        // Dealers authenticate with a bearer token; only its sha256 is stored.
        Auth::viaRequest('dealer-token', function (Request $request): ?Dealer {
            $token = $request->bearerToken();

            return $token !== null && $token !== '' ? Dealer::findByToken($token) : null;
        });

        Gate::policy(Offer::class, OfferPolicy::class);

        RateLimiter::for('quotes', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));
        RateLimiter::for('dealer', fn (Request $request) => Limit::perMinute(120)->by((string) $request->bearerToken()));
    }
}
