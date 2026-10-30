<?php

namespace Database\Factories;

use App\Domain\Leasing\Segment;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Vehicle> */
class VehicleFactory extends Factory
{
    protected $model = Vehicle::class;

    /** make, model, segment, fuel, kW, list price in EUR */
    public const CATALOGUE = [
        ['Volkswagen', 'Polo', 'small', 'petrol', 70, 21495],
        ['Volkswagen', 'Golf', 'compact', 'petrol', 110, 33315],
        ['Volkswagen', 'ID.3', 'ev', 'electric', 150, 36900],
        ['Volkswagen', 'Tiguan', 'suv', 'hybrid', 150, 45760],
        ['Skoda', 'Fabia', 'small', 'petrol', 70, 19890],
        ['Skoda', 'Octavia', 'compact', 'diesel', 110, 34490],
        ['Skoda', 'Enyaq', 'ev', 'electric', 150, 46200],
        ['Opel', 'Corsa', 'small', 'petrol', 74, 21650],
        ['Opel', 'Astra', 'compact', 'hybrid', 132, 37500],
        ['BMW', '1er', 'compact', 'petrol', 115, 38900],
        ['BMW', 'X1', 'suv', 'diesel', 120, 47100],
        ['BMW', 'i4', 'ev', 'electric', 250, 57900],
        ['Audi', 'A3 Sportback', 'compact', 'petrol', 110, 36450],
        ['Audi', 'Q4 e-tron', 'ev', 'electric', 210, 52900],
        ['Mercedes-Benz', 'A-Klasse', 'compact', 'petrol', 120, 37400],
        ['Mercedes-Benz', 'GLC', 'suv', 'hybrid', 190, 63500],
        ['Hyundai', 'Kona', 'suv', 'hybrid', 104, 32990],
        ['Hyundai', 'Ioniq 5', 'ev', 'electric', 168, 44900],
        ['Kia', 'Picanto', 'small', 'petrol', 46, 14590],
        ['Kia', 'EV3', 'ev', 'electric', 150, 35990],
        ['Cupra', 'Born', 'ev', 'electric', 170, 41990],
        ['Toyota', 'Yaris', 'small', 'hybrid', 85, 24390],
        ['Toyota', 'RAV4', 'suv', 'hybrid', 160, 44990],
        ['Fiat', '500e', 'small', 'electric', 87, 29990],
    ];

    public function definition(): array
    {
        [$make, $model, $segment, $fuel, $kw, $price] = fake()->randomElement(self::CATALOGUE);

        return [
            'make' => $make,
            'model' => $model,
            'variant' => fake()->randomElement(['Life', 'Style', 'Business', 'Sport', 'Edition']).' '.$kw.' kW',
            'fuel' => $fuel,
            'power_kw' => $kw,
            'segment' => Segment::from($segment),
            'list_price_cents' => $price * 100,
        ];
    }
}
