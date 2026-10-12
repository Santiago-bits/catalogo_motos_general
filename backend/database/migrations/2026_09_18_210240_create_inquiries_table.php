<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('name', 120);
            $table->string('email', 160)->nullable();
            $table->string('phone', 40)->nullable();
            $table->text('message')->nullable();
            $table->enum('status', ['nueva', 'contactado', 'cerrada'])->default('nueva');
            $table->string('source', 60)->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiries');
    }
};
