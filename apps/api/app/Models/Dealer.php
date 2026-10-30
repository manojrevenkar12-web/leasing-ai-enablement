<?php

namespace App\Models;

use Database\Factories\DealerFactory;
use Illuminate\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $city
 * @property string $api_token_hash
 */
class Dealer extends Model implements AuthenticatableContract
{
    use Authenticatable;

    /** @use HasFactory<DealerFactory> */
    use HasFactory;

    protected $fillable = ['name', 'city', 'api_token_hash'];

    protected $hidden = ['api_token_hash'];

    /** @return HasMany<Offer, $this> */
    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(string $token): ?self
    {
        return self::query()->where('api_token_hash', self::hashToken($token))->first();
    }
}
