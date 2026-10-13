<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Secciones de cada marca (moto, casco, repuesto), como las categorías:
 * así cada listado y cada formulario muestran sólo las marcas que corresponden.
 * Una marca puede estar en varias (Honda: motos y repuestos).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('brands', function (Blueprint $table) {
            $table->json('groups')->nullable()->after('slug');
        });

        // Se arranca con las secciones de los productos que ya tiene cada marca;
        // las que no tienen productos quedan en motos (eran las marcas de motos).
        foreach (DB::table('brands')->pluck('id') as $id) {
            $types = DB::table('products')->where('brand_id', $id)->distinct()->pluck('type')->values()->all();
            DB::table('brands')->where('id', $id)->update(['groups' => json_encode($types ?: ['moto'])]);
        }
    }

    public function down(): void
    {
        Schema::table('brands', function (Blueprint $table) {
            $table->dropColumn('groups');
        });
    }
};
