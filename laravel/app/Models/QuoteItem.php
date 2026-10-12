<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuoteItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['quote_id', 'product_id', 'product_name', 'quantity', 'unit_price'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
