<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Moto extends Model
{
    protected $primaryKey = 'product_id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'model', 'year', 'condition_type', 'km', 'fuel_type',
        'displacement_cc', 'cylinders', 'power_hp', 'torque_nm', 'transmission',
        'cooling', 'starter', 'brakes_front', 'brakes_rear',
        'suspension_front', 'suspension_rear', 'fuel_capacity_l', 'weight_kg',
        'seat_height_mm', 'color', 'warranty', 'location',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
