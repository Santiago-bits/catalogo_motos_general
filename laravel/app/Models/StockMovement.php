<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    public const UPDATED_AT = null;

    /** Motivos sugeridos por tipo (el panel los muestra en un desplegable). */
    public const REASONS = [
        'compra' => 'Compra a proveedor',
        'devolucion' => 'Devolución de cliente',
        'venta' => 'Venta',
        'reserva' => 'Seña / reserva entregada',
        'uso_taller' => 'Uso en taller',
        'rotura' => 'Rotura o pérdida',
        'conteo' => 'Conteo / inventario',
        'stock_inicial' => 'Stock inicial',
        'importacion' => 'Importación',
        'otro' => 'Otro',
    ];

    protected $fillable = ['product_id', 'type', 'quantity', 'stock_before', 'stock_after', 'reason', 'note', 'user_id'];

    protected $casts = ['created_at' => 'datetime'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
