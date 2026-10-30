<?php

use App\Http\Controllers\DealerOfferController;
use App\Http\Controllers\OfferSearchController;
use App\Http\Controllers\QuoteController;
use Illuminate\Support\Facades\Route;

Route::get('/offers', [OfferSearchController::class, 'index'])->name('offers.search');
Route::get('/offers/makes', [OfferSearchController::class, 'makes'])->name('offers.makes');
Route::get('/offers/{offer}', [OfferSearchController::class, 'show'])->whereNumber('offer')->name('offers.show');
Route::post('/offers/{offer}/quote', QuoteController::class)->whereNumber('offer')
    ->middleware('throttle:quotes')->name('offers.quote');

Route::prefix('dealer')->middleware(['auth:dealer', 'throttle:dealer'])->group(function () {
    Route::get('/offers/benchmark', [DealerOfferController::class, 'benchmark'])->name('dealer.offers.benchmark');
    Route::post('/offers', [DealerOfferController::class, 'store'])->name('dealer.offers.store');
    Route::patch('/offers/{offer}', [DealerOfferController::class, 'update'])->whereNumber('offer')->name('dealer.offers.update');
    Route::delete('/offers/{offer}', [DealerOfferController::class, 'destroy'])->whereNumber('offer')->name('dealer.offers.destroy');
});
