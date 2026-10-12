<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SearchLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['term', 'results_count'];

    protected static function booted(): void
    {
        static::creating(function (SearchLog $log) {
            $log->created_at ??= now();
        });
    }
}
