<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Repuesto extends Model
{
    protected $primaryKey = 'product_id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'oem_code', 'manufacturer_code', 'manufacturer',
        'origin', 'unit', 'weight_kg',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function codes(): HasMany
    {
        return $this->hasMany(RepuestoCode::class, 'product_id', 'product_id');
    }

    public function compatibility(): HasMany
    {
        return $this->hasMany(RepuestoCompatibility::class, 'repuesto_id', 'product_id');
    }
}
