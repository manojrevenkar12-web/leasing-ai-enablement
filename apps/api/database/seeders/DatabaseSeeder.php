<?php

namespace Database\Seeders;

use App\Domain\Leasing\Segment;
use App\Models\Dealer;
use App\Models\Offer;
use App\Models\Vehicle;
use Database\Factories\VehicleFactory;
use Illuminate\Database\Seeder;

/** A reproducible catalogue: 12 dealers, every catalogue vehicle, about 700 offers. */
class DatabaseSeeder extends Seeder
{
    /** Token of the first dealer, for trying the dealer API locally. Never used outside dev. */
    public const DEV_DEALER_TOKEN = 'dev-dealer-token-change-me';

    public function run(): void
    {
        fake()->seed(20261030);
        mt_srand(20261030);

        $dealers = collect([Dealer::factory()->withToken(self::DEV_DEALER_TOKEN)->create(['name' => 'Autohaus Rheinblick', 'city' => 'Düsseldorf'])])
            ->merge(Dealer::factory()->count(11)->create());

        $vehicles = collect(VehicleFactory::CATALOGUE)->map(fn (array $v) => Vehicle::query()->create([
            'make' => $v[0], 'model' => $v[1], 'variant' => 'Style '.$v[4].' kW', 'fuel' => $v[3],
            'power_kw' => $v[4], 'segment' => Segment::from($v[2]), 'list_price_cents' => $v[5] * 100,
        ]));

        Offer::withoutEvents(function () use ($dealers, $vehicles): void {
            foreach ($vehicles as $vehicle) {
                foreach ($dealers->random(mt_rand(3, 6)) as $dealer) {
                    foreach (['private', 'business'] as $type) {
                        foreach (fake()->randomElements([24, 36, 48], mt_rand(1, 3)) as $term) {
                            $offer = Offer::factory()->make([
                                'customer_type' => $type,
                                'term_months' => $term,
                                'km_per_year' => fake()->randomElement([10000, 15000, 20000]),
                                // dealer discounts of 8 to 28% on the list price, as on real leasing portals
                                'discount_cents' => (int) round($vehicle->list_price_cents * mt_rand(8, 28) / 100),
                            ]);
                            $offer->dealer()->associate($dealer);
                            $offer->vehicle()->associate($vehicle);
                            $offer->price();
                            $offer->save();
                        }
                    }
                }
            }
        });
    }
}
