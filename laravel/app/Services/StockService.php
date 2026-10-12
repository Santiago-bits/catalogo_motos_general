<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Único lugar donde cambia el stock: registra el movimiento y mantiene el
 * estado de publicación al día (sin stock → "Consultar"; vuelve a entrar → "Disponible").
 */
class StockService
{
    /**
     * @param  string  $type  ingreso | egreso | ajuste
     * @param  int  $quantity  ingreso/egreso: unidades (positivo). ajuste: stock final que queda.
     */
    public static function move(Product $product, string $type, int $quantity, ?string $reason = null, ?string $note = null, ?int $userId = null): StockMovement
    {
        return DB::transaction(function () use ($product, $type, $quantity, $reason, $note, $userId) {
            // Bloquea la fila para que dos movimientos simultáneos no pisen el saldo.
            $locked = Product::whereKey($product->id)->lockForUpdate()->firstOrFail();
            $before = (int) $locked->stock_qty;

            $after = match ($type) {
                'ingreso' => $before + abs($quantity),
                'egreso' => $before - abs($quantity),
                'ajuste' => max(0, $quantity),
                default => throw new \InvalidArgumentException("Tipo de movimiento inválido: {$type}"),
            };

            if ($type !== 'ajuste' && $quantity === 0) {
                throw ValidationException::withMessages(['quantity' => ['La cantidad tiene que ser mayor a cero.']]);
            }
            if ($after < 0) {
                throw ValidationException::withMessages(['quantity' => ["No hay stock suficiente: quedan {$before} unidad(es)."]]);
            }
            if ($type === 'ajuste' && $after === $before) {
                throw ValidationException::withMessages(['quantity' => ['El stock ya es ese: no hay nada que ajustar.']]);
            }

            $movement = StockMovement::create([
                'product_id' => $locked->id,
                'type' => $type,
                'quantity' => $after - $before,
                'stock_before' => $before,
                'stock_after' => $after,
                'reason' => $reason,
                'note' => $note,
                'user_id' => $userId,
            ]);

            $oldAvailability = $locked->availability;
            $changes = ['stock_qty' => $after];
            // Estado automático: sólo se toca cuando cruza el cero.
            if ($after === 0 && $locked->availability === 'disponible') {
                $changes['availability'] = 'consultar';
            } elseif ($before === 0 && $after > 0 && in_array($locked->availability, ['consultar', 'vendido'], true)) {
                $changes['availability'] = 'disponible';
            }
            $locked->forceFill($changes)->save();
            $product->setRawAttributes($locked->getAttributes(), true);

            $label = ['ingreso' => 'Ingreso', 'egreso' => 'Egreso', 'ajuste' => 'Ajuste'][$type];
            ActivityLog::log(
                $userId, 'editar', 'Product', $locked->id,
                sprintf('%s de stock de "%s": %+d (queda %d)', $label, $locked->name, $after - $before, $after),
                'stock',
                ['stock_qty' => [$before, $after]] + (isset($changes['availability']) ? ['availability' => [$oldAvailability, $changes['availability']]] : [])
            );

            return $movement;
        });
    }
}
