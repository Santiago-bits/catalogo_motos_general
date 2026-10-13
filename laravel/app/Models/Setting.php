<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::query()->find($key)?->value ?? $default;
    }

    /** Nombre comercial (Configuración → Marca), el mismo que se ve en el logo del sitio. */
    public static function companyName(): string
    {
        $name = trim((static::get('brand_name') ?: 'RODADO').' '.(static::get('brand_sub') ?: 'MOTOS'));

        return mb_convert_case(mb_strtolower($name), MB_CASE_TITLE);
    }

    public static function set(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
