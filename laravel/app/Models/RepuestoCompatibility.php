<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RepuestoCompatibility extends Model
{
    use HasFactory;

    protected $table = 'repuesto_compatibility';

    public $timestamps = false;

    protected $fillable = ['repuesto_id', 'brand_id', 'model', 'year_from', 'year_to', 'note'];

    public function brand(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
