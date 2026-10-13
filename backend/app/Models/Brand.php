<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Brand extends Model
{
    /** Secciones en las que puede estar una marca (las mismas que las categorías). */
    public const GROUPS = ['moto', 'casco', 'repuesto'];

    protected $fillable = ['name', 'slug', 'groups', 'logo_path', 'active'];

    protected $casts = ['active' => 'boolean', 'groups' => 'array'];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /** Marcas de una sección: ?grupo=repuesto. */
    public function scopeInGroup(Builder $query, ?string $group): Builder
    {
        return in_array($group, self::GROUPS, true) ? $query->whereJsonContains('groups', $group) : $query;
    }

    /** Suma la sección si la marca todavía no la tenía (al crear un producto o importar). */
    public function addGroup(string $group): void
    {
        if (in_array($group, self::GROUPS, true) && ! in_array($group, $this->groups ?? [], true)) {
            $this->update(['groups' => [...($this->groups ?? []), $group]]);
        }
    }
}
