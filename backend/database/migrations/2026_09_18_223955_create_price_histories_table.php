<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('old_price', 14, 2)->nullable();
            $table->decimal('new_price', 14, 2);
            $table->char('currency', 3)->default('ARS');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_histories');
    }
};
