<?php

use App\Http\Controllers\CookedController;
use App\Http\Controllers\FridgeController;
use App\Http\Controllers\FridgeScanController;
use App\Http\Controllers\IngredientController;
use App\Http\Controllers\RecipeController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| FridgeMama API
|--------------------------------------------------------------------------
|
| One screen, one loop: detect → track → warn → cook → measure.
|
| Nothing here is authenticated. There are no accounts — a fridge belongs to
| the session id the browser sends in X-Fridge-Session, resolved on every
| request by ResolveFridgeSession. That is the whole identity model, and it is
| the right one for a single-session offline app a judge picks up for ninety
| seconds.
|
*/

// ── The fridge ───────────────────────────────────────────────────────────
// index returns the entire screen in one payload: shelf, freshness tiers,
// health dial, waste counter, leaderboard and recipe suggestions.
Route::get('fridge', [FridgeController::class, 'index']);
Route::post('fridge/items', [FridgeController::class, 'store']);
Route::patch('fridge/items/{pantryItem}', [FridgeController::class, 'update']);
Route::delete('fridge/items/{pantryItem}', [FridgeController::class, 'destroy']);

// The demo clock, and the reset between judges.
Route::post('fridge/fast-forward', [FridgeController::class, 'fastForward']);
Route::post('fridge/reset', [FridgeController::class, 'reset']);

// ── Fridge Scan ──────────────────────────────────────────────────────────
Route::get('fridge/scan/status', [FridgeScanController::class, 'status']);
Route::post('fridge/scan', [FridgeScanController::class, 'scan'])->middleware('throttle:60,1');
Route::post('fridge/scan/confirm', [FridgeScanController::class, 'confirm']);

// ── Recipes ──────────────────────────────────────────────────────────────
// No library and no browsing: only the reveal for something already suggested.
Route::get('recipes/{recipe}', [RecipeController::class, 'show']);
Route::get('recipe-images/{path}', [RecipeController::class, 'image'])->where('path', '.*');

// ── Cooking it, and the waste counter ────────────────────────────────────
Route::post('recipes/{recipe}/cooked', [CookedController::class, 'store']);
Route::post('fridge/restore', [CookedController::class, 'restore']);

// ── Ingredient vocabulary, for manual correction ─────────────────────────
Route::get('ingredients', [IngredientController::class, 'index']);
