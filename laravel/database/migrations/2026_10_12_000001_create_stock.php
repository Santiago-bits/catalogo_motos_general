<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Control de stock: cantidad por producto, mínimo para alertar y
 * registro de cada movimiento (ingreso, egreso, ajuste).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->integer('stock_qty')->default(0)->after('availability');
            $table->unsignedInteger('stock_min')->default(0)->after('stock_qty');
            $table->index('stock_qty');
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['ingreso', 'egreso', 'ajuste']);
            $table->integer('quantity');          // con signo: + entra, − sale
            $table->integer('stock_before');
            $table->integer('stock_after');
            $table->string('reason', 60)->nullable();
            $table->string('note', 255)->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->index(['product_id', 'created_at']);
            $table->index('type');
        });

        // Permisos de la sección Stock (el rol administrador los tiene todos).
        $order = (int) DB::table('permissions')->max('sort_order');
        $view = DB::table('permissions')->insertGetId(['key' => 'stock.view', 'module' => 'Stock', 'label' => 'Ver el stock y sus movimientos', 'sort_order' => ++$order]);
        $manage = DB::table('permissions')->insertGetId(['key' => 'stock.manage', 'module' => 'Stock', 'label' => 'Cargar ingresos, egresos y ajustes', 'sort_order' => ++$order]);

        $roles = DB::table('roles')->pluck('id', 'slug');
        foreach (['editor' => [$view, $manage], 'vendedor' => [$view, $manage]] as $slug => $perms) {
            if (isset($roles[$slug])) {
                foreach ($perms as $permId) {
                    DB::table('permission_role')->insertOrIgnore(['role_id' => $roles[$slug], 'permission_id' => $permId]);
                }
            }
        }

        // Stock inicial: 1 unidad para lo que hoy figura disponible o reservado.
        $now = now();
        DB::table('products')->whereNull('deleted_at')->whereIn('availability', ['disponible', 'reservado'])->orderBy('id')
            ->each(function ($product) use ($now) {
                DB::table('products')->where('id', $product->id)->update(['stock_qty' => 1]);
                DB::table('stock_movements')->insert([
                    'product_id' => $product->id, 'type' => 'ajuste', 'quantity' => 1,
                    'stock_before' => 0, 'stock_after' => 1, 'reason' => 'stock_inicial',
                    'note' => 'Stock inicial al activar el control de stock', 'user_id' => null, 'created_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('key', ['stock.view', 'stock.manage'])->delete();
        Schema::dropIfExists('stock_movements');
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['stock_qty']);
            $table->dropColumn(['stock_qty', 'stock_min']);
        });
    }
};
