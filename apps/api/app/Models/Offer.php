<?php

namespace App\Models;

use App\Domain\Leasing\CustomerType;
use App\Domain\Leasing\LeasingTerms;
use App\Domain\Leasing\RateCalculator;
use App\Support\OfferCatalog;
use Database\Factories\OfferFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $dealer_id
 * @property int $vehicle_id
 * @property CustomerType $customer_type
 * @property int $term_months
 * @property int $km_per_year
 * @property int $down_payment_cents
 * @property int $extra_costs_cents
 * @property int $monthly_rate_cents
 * @property string $leasing_factor
 * @property string $total_cost_factor
 * @property int $residual_value_cents
 * @property string $status
 * @property-read Dealer $dealer
 * @property-read Vehicle $vehicle
 */
class Offer extends Model
{
    /** @use HasFactory<OfferFactory> */
    use HasFactory;

    public const ACTIVE = 'active';

    public const PAUSED = 'paused';

    protected $fillable = [
        'vehicle_id', 'customer_type', 'term_months', 'km_per_year', 'down_payment_cents', 'extra_costs_cents', 'status',
    ];

    protected $attributes = ['status' => self::ACTIVE];

    protected function casts(): array
    {
        return [
            'customer_type' => CustomerType::class,
            'term_months' => 'integer',
            'km_per_year' => 'integer',
            'down_payment_cents' => 'integer',
            'extra_costs_cents' => 'integer',
            'monthly_rate_cents' => 'integer',
            'leasing_factor' => 'decimal:2',
            'total_cost_factor' => 'decimal:2',
            'residual_value_cents' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // The rate is never typed in: it is computed from the terms on every save, so a dealer
        // cannot publish a rate that does not follow from its own terms.
        static::saving(function (Offer $offer): void {
            if ($offer->isDirty('vehicle_id')) {
                $offer->unsetRelation('vehicle');
            }
            $offer->price();
        });
        // Any write changes what search returns.
        static::saved(fn () => app(OfferCatalog::class)->changed());
        static::deleted(fn () => app(OfferCatalog::class)->changed());
    }

    public function price(): void
    {
        $quote = app(RateCalculator::class)->quote(
            $this->vehicle->list_price_cents,
            $this->vehicle->segment,
            $this->terms(),
        );
        $this->monthly_rate_cents = $quote->monthlyRateCents;
        $this->leasing_factor = number_format($quote->leasingFactor, 2, '.', '');
        $this->total_cost_factor = number_format($quote->totalCostFactor, 2, '.', '');
        $this->residual_value_cents = $quote->residualValueCents;
    }

    public function terms(): LeasingTerms
    {
        return new LeasingTerms(
            $this->term_months,
            $this->km_per_year,
            $this->down_payment_cents,
            $this->extra_costs_cents,
            $this->customer_type,
        );
    }

    /** @return BelongsTo<Dealer, $this> */
    public function dealer(): BelongsTo
    {
        return $this->belongsTo(Dealer::class);
    }

    /** @return BelongsTo<Vehicle, $this> */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * @param  Builder<Offer>  $query
     * @return Builder<Offer>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('offers.status', self::ACTIVE);
    }
}
