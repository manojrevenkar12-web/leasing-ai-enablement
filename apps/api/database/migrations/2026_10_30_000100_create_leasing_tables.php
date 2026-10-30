<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dealers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('city');
            // sha256 of the dealer's API token; the token itself is never stored
            $table->char('api_token_hash', 64)->unique();
            $table->timestamps();
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('make', 40);
            $table->string('model', 60);
            $table->string('variant', 120);
            $table->string('fuel', 16);
            $table->unsignedSmallInteger('power_kw');
            $table->string('segment', 16);
            $table->unsignedInteger('list_price_cents');
            $table->timestamps();
            $table->index(['make', 'model']);
        });

        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dealer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->string('customer_type', 16);
            $table->unsignedTinyInteger('term_months');
            $table->unsignedInteger('km_per_year');
            $table->unsignedInteger('down_payment_cents');
            $table->unsignedInteger('extra_costs_cents');
            // computed by the RateCalculator on every save
            $table->unsignedInteger('monthly_rate_cents');
            $table->decimal('leasing_factor', 5, 2);
            $table->decimal('total_cost_factor', 5, 2);
            $table->unsignedInteger('residual_value_cents');
            $table->string('status', 16)->default('active');
            $table->timestamps();
            $table->index(['status', 'customer_type', 'leasing_factor']);
            $table->index(['status', 'customer_type', 'monthly_rate_cents']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('dealers');
    }
};
