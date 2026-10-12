<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inquiry extends Model
{
    use HasFactory;

    public const STATUSES = ['nueva' => 'Nueva', 'en_proceso' => 'En proceso', 'respondida' => 'Respondida', 'cerrada' => 'Cerrada'];

    protected $fillable = ['product_id', 'name', 'email', 'phone', 'message', 'status', 'source', 'assigned_to', 'internal_note', 'replied_at'];

    protected $casts = ['replied_at' => 'datetime'];

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }


    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
