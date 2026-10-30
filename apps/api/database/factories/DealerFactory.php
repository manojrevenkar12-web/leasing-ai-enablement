<?php

namespace Database\Factories;

use App\Models\Dealer;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Dealer> */
class DealerFactory extends Factory
{
    protected $model = Dealer::class;

    public function definition(): array
    {
        return [
            'name' => 'Autohaus '.fake()->lastName(),
            'city' => fake()->randomElement(['Düsseldorf', 'Berlin', 'München', 'Köln', 'Hamburg', 'Essen', 'Leipzig']),
            'api_token_hash' => Dealer::hashToken(Str::random(40)),
        ];
    }

    public function withToken(string $token): self
    {
        return $this->state(['api_token_hash' => Dealer::hashToken($token)]);
    }
}
