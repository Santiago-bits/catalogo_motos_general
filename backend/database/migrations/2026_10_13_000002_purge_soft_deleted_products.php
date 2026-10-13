<?php

use App\Models\Product;
use Illuminate\Database\Migrations\Migration;

/**
 * Antes, eliminar un producto sólo lo ocultaba y dejaba sus fotos en la carpeta.
 * Ahora el borrado es definitivo: esto termina de borrar los que quedaron ocultos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Product::onlyTrashed()->each(fn (Product $product) => $product->purge());
    }

    public function down(): void
    {
        // Sin vuelta atrás: los productos y sus archivos ya no existen.
    }
};
