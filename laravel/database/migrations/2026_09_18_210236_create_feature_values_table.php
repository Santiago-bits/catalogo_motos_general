<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feature_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('feature_id')->constrained('features')->cascadeOnDelete();
            $table->string('value_text', 255)->nullable();
            $table->decimal('value_number', 16, 4)->nullable();

            $table->unique(['product_id', 'feature_id']);
            $table->index(['feature_id', 'value_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_values');
    }
};
