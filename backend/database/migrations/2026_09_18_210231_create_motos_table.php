<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('motos', function (Blueprint $table) {
            $table->foreignId('product_id')->primary()->constrained('products')->cascadeOnDelete();
            $table->string('model', 120)->nullable();
            $table->smallInteger('year')->nullable();
            $table->enum('condition_type', ['nueva', 'usada', 'reacondicionada'])->default('usada');
            $table->unsignedInteger('km')->nullable();
            $table->enum('fuel_type', ['nafta', 'electrico', 'hibrido'])->nullable();
            $table->unsignedSmallInteger('displacement_cc')->nullable();
            $table->unsignedTinyInteger('cylinders')->nullable();
            $table->decimal('power_hp', 6, 2)->nullable();
            $table->decimal('torque_nm', 6, 2)->nullable();
            $table->enum('transmission', ['manual', 'automatica', 'semiautomatica'])->nullable();
            $table->enum('cooling', ['aire', 'liquido', 'aceite'])->nullable();
            $table->enum('starter', ['electrico', 'pedal', 'ambos'])->nullable();
            $table->string('brakes_front', 60)->nullable();
            $table->string('brakes_rear', 60)->nullable();
            $table->string('suspension_front', 80)->nullable();
            $table->string('suspension_rear', 80)->nullable();
            $table->decimal('fuel_capacity_l', 5, 2)->nullable();
            $table->decimal('weight_kg', 7, 2)->nullable();
            $table->unsignedSmallInteger('seat_height_mm')->nullable();
            $table->string('color', 60)->nullable();
            $table->string('warranty', 160)->nullable();
            $table->string('location', 160)->nullable();

            $table->index('model');
            $table->index('year');
            $table->index('displacement_cc');
            $table->index('fuel_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('motos');
    }
};
