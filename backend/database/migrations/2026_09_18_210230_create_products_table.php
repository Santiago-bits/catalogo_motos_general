<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['moto', 'casco', 'repuesto'])->index();
            $table->string('code', 60)->unique();
            $table->string('name', 200);
            $table->string('slug', 220)->unique();
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('short_description', 400)->nullable();
            $table->mediumText('description')->nullable();

            $table->decimal('cost_price', 14, 2)->default(0);
            $table->decimal('profit_percent', 7, 3)->default(0);
            $table->decimal('profit_amount', 14, 2)->default(0);
            $table->decimal('final_price', 14, 2)->default(0);
            $table->decimal('offer_price', 14, 2)->nullable();
            $table->char('currency', 3)->default('ARS');
            $table->boolean('price_visible')->default(true);
            $table->dateTime('price_updated_at')->nullable();

            $table->enum('availability', ['disponible', 'reservado', 'vendido', 'consultar'])->default('disponible');
            $table->boolean('featured')->default(false);
            $table->boolean('is_new')->default(false);
            $table->boolean('is_offer')->default(false);

            $table->string('meta_title', 180)->nullable();
            $table->string('meta_description', 300)->nullable();
            $table->string('og_image')->nullable();

            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('inquiries_count')->default(0);

            $table->boolean('active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['type', 'active']);
            $table->index('featured');
            $table->index('final_price');
            $table->fullText(['name', 'code', 'short_description', 'description']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
