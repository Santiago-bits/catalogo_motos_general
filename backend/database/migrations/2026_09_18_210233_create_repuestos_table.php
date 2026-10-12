<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repuestos', function (Blueprint $table) {
            $table->foreignId('product_id')->primary()->constrained('products')->cascadeOnDelete();
            $table->string('oem_code', 80)->nullable();
            $table->string('manufacturer_code', 80)->nullable();
            $table->string('manufacturer', 120)->nullable();
            $table->enum('origin', ['original', 'alternativo', 'remanufacturado'])->default('alternativo');
            $table->string('unit', 20)->default('unidad');
            $table->decimal('weight_kg', 10, 3)->nullable();

            $table->index('oem_code');
            $table->index('manufacturer_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repuestos');
    }
};
