<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repuesto_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->enum('code_type', ['interno', 'oem', 'fabricante', 'alternativo', 'cruzado'])->default('alternativo');
            $table->string('code', 80);
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->string('note', 160)->nullable();

            $table->index('code');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repuesto_codes');
    }
};
