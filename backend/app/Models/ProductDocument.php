<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductDocument extends Model
{
    public const KINDS = ['ficha' => 'Ficha técnica', 'manual' => 'Manual', 'garantia' => 'Garantía', 'folleto' => 'Folleto', 'otro' => 'Otro'];

    protected $fillable = ['product_id', 'title', 'kind', 'path', 'original_name', 'size', 'is_public'];

    protected $casts = ['is_public' => 'boolean', 'size' => 'integer'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
