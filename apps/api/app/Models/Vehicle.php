<?php

namespace App\Models;

use App\Domain\Leasing\Segment;
use Database\Factories\VehicleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $make
 * @property string $model
 * @property string $variant
 * @property string $fuel
 * @property int $power_kw
 * @property Segment $segment
 * @property int $list_price_cents
 */
class Vehicle extends Model
{
    /** @use HasFactory<VehicleFactory> */
    use HasFactory;

    public const FUELS = ['petrol', 'diesel', 'hybrid', 'electric'];

    protected $fillable = ['make', 'model', 'variant', 'fuel', 'power_kw', 'segment', 'list_price_cents'];

    protected function casts(): array
    {
        return [
            'segment' => Segment::class,
            'power_kw' => 'integer',
            'list_price_cents' => 'integer',
        ];
    }

    /** @return HasMany<Offer, $this> */
    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }
}
