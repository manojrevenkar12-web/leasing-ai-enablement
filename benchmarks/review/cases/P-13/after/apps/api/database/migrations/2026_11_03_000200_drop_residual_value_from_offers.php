<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * offers.residual_value_cents was stored for a dealer export that was switched off in August. No
 * endpoint reads it, and it is always recomputable from the vehicle and the terms (the quote
 * endpoint already does that), so it goes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->dropColumn('residual_value_cents');
        });
    }

    public function down(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->unsignedInteger('residual_value_cents')->default(0);
        });
    }
};
