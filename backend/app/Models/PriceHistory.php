<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceHistory extends Model
{
    public $timestamps = false;

    protected $fillable = ['product_id', 'old_price', 'new_price', 'currency', 'changed_by'];

    protected static function booted(): void
    {
        static::creating(function (PriceHistory $history) {
            $history->created_at ??= now();
        });
    }
}
