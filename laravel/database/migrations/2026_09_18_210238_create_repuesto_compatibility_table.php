<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repuesto_compatibility', function (Blueprint $table) {
            $table->id();
            $table->foreignId('repuesto_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->string('model', 120);
            $table->smallInteger('year_from')->nullable();
            $table->smallInteger('year_to')->nullable();
            $table->string('note', 200)->nullable();

            $table->index('repuesto_id');
            $table->index('model');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repuesto_compatibility');
    }
};
