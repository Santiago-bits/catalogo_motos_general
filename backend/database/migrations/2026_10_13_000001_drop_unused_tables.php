<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Tablas que el sistema dejó de usar:
 * - moto_repuestos: compatibilidad moto↔repuesto vieja; la vigente es repuesto_compatibility.
 * - search_logs: registro de búsquedas que no se mostraba en ningún lado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('moto_repuestos');
        Schema::dropIfExists('search_logs');
    }

    public function down(): void
    {
        // Sin vuelta atrás: las tablas no tienen uso en el código.
    }
};
