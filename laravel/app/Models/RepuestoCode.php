<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RepuestoCode extends Model
{
    public $timestamps = false;

    public const TYPES = ['oem' => 'OEM', 'fabricante' => 'Fabricante', 'alternativo' => 'Alternativo', 'cruzado' => 'Cruzado', 'interno' => 'Interno'];

    protected $fillable = ['product_id', 'code_type', 'code', 'brand_id', 'note'];

    public function brand(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
