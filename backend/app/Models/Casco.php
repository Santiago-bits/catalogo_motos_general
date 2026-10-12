<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Casco extends Model
{
    use HasFactory;

    protected $primaryKey = 'product_id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'helmet_type', 'size', 'certification', 'visor_type',
        'material', 'color', 'weight_grams', 'has_bluetooth', 'warranty',
    ];

    protected $casts = [
        'has_bluetooth' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
