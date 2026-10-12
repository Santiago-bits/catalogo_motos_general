<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'action', 'module', 'subject_type', 'subject_id', 'description', 'changes', 'ip'];

    protected $casts = ['changes' => 'array', 'created_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected static function booted(): void
    {
        static::creating(function (ActivityLog $log) {
            $log->created_at ??= now();
            $log->ip ??= request()?->ip();
        });
    }

    /**
     * Registra un evento de auditoría.
     *
     * @param  array<string,array{0:mixed,1:mixed}>|null  $changes  campo => [antes, ahora]
     */
    public static function log(?int $userId, string $action, ?string $subjectType = null, ?int $subjectId = null, ?string $description = null, ?string $module = null, ?array $changes = null): void
    {
        static::create([
            'user_id' => $userId,
            'action' => $action,
            'module' => $module ?? self::moduleFor($subjectType),
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'description' => $description,
            'changes' => $changes ?: null,
        ]);
    }

    /**
     * Diferencias entre los valores originales y los nuevos de un modelo ya guardado.
     *
     * @return array<string,array{0:mixed,1:mixed}>
     */
    public static function diff(Model $model, array $ignore = ['updated_at', 'updated_by', 'slug']): array
    {
        $changes = [];
        $previous = $model->getPrevious();
        foreach ($model->getChanges() as $field => $new) {
            if (in_array($field, $ignore, true)) {
                continue;
            }
            $old = $previous[$field] ?? null;
            if ((string) $old !== (string) $new) {
                $changes[$field] = [$old, $new];
            }
        }

        return $changes;
    }

    private static function moduleFor(?string $subjectType): ?string
    {
        return match ($subjectType) {
            'Product' => 'productos',
            'Brand' => 'marcas',
            'Category' => 'categorias',
            'Tag' => 'etiquetas',
            'Feature' => 'caracteristicas',
            'Service' => 'servicios',
            'Inquiry' => 'consultas',
            'Quote' => 'cotizaciones',
            'User' => 'usuarios',
            'Role' => 'roles',
            'Setting' => 'configuracion',
            default => null,
        };
    }
}
