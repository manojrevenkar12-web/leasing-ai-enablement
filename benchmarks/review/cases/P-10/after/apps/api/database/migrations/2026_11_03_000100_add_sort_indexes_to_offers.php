<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Search sorts by leasing factor, rate, total cost factor or newest. The first two already have an
 * index on (status, customer_type, <sort column>); these add the same for the other two sorts, which
 * show up as full scans in the slow-query log since the catalogue passed 50k offers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->index(['status', 'customer_type', 'total_cost_factor'], 'offers_status_type_total_index');
            $table->index(['status', 'customer_type', 'created_at'], 'offers_status_type_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->dropIndex('offers_status_type_total_index');
            $table->dropIndex('offers_status_type_created_index');
        });
    }
};
