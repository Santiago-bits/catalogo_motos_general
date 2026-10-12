<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->unique();
            $table->string('name', 120);
            $table->string('email', 160)->nullable();
            $table->string('phone', 40)->nullable();
            $table->text('message')->nullable();
            $table->decimal('total', 14, 2)->default(0);
            $table->char('currency', 3)->default('ARS');
            $table->enum('status', ['pendiente', 'contactado', 'cerrada'])->default('pendiente');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
