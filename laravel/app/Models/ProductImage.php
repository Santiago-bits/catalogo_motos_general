<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductImage extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = ['product_id', 'path', 'thumb_path', 'alt', 'is_main', 'sort_order', 'created_at'];

    protected $casts = ['is_main' => 'boolean'];

    protected static function booted(): void
    {
        static::creating(function (ProductImage $image) {
            $image->created_at ??= now();
        });
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
