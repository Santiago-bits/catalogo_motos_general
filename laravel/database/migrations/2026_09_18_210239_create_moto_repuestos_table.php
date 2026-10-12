<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moto_repuestos', function (Blueprint $table) {
            $table->foreignId('moto_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('repuesto_id')->constrained('products')->cascadeOnDelete();
            $table->string('note', 200)->nullable();
            $table->boolean('recommended')->default(false);

            $table->primary(['moto_id', 'repuesto_id']);
            $table->index('repuesto_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moto_repuestos');
    }
};
