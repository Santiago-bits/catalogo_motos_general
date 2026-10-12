<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    public $timestamps = false;

    protected $fillable = ['key', 'module', 'label', 'sort_order'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }
}
