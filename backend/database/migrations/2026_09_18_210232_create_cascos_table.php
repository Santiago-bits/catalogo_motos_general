<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cascos', function (Blueprint $table) {
            $table->foreignId('product_id')->primary()->constrained('products')->cascadeOnDelete();
            $table->enum('helmet_type', ['integral', 'abierto', 'modular', 'cross', 'infantil'])->nullable();
            $table->enum('size', ['XS', 'S', 'M', 'L', 'XL', 'XXL'])->nullable();
            $table->string('certification', 60)->nullable();
            $table->string('visor_type', 80)->nullable();
            $table->string('material', 80)->nullable();
            $table->string('color', 60)->nullable();
            $table->unsignedSmallInteger('weight_grams')->nullable();
            $table->boolean('has_bluetooth')->default(false);
            $table->string('warranty', 160)->nullable();

            $table->index('helmet_type');
            $table->index('size');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cascos');
    }
};
