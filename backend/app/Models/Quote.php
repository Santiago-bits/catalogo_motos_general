<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quote extends Model
{
    protected $fillable = ['number', 'name', 'email', 'phone', 'message', 'total', 'currency', 'status'];

    public function items(): HasMany
    {
        return $this->hasMany(QuoteItem::class);
    }
}
