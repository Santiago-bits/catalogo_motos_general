<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'phone', 'position', 'password', 'role', 'role_id', 'active', 'must_change_password', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    /** @var array<int,string>|null Claves de permiso del rol, cargadas una vez por request. */
    private ?array $permissionKeys = null;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'active' => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    public function roleModel(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function isAdmin(): bool
    {
        return (bool) $this->roleModel?->is_system;
    }

    /** Puede entrar al panel: cuenta activa y con un rol activo. */
    public function canAccessPanel(): bool
    {
        return $this->active && $this->roleModel !== null && $this->roleModel->active;
    }

    /** @return array<int,string> */
    public function permissionKeys(): array
    {
        if ($this->permissionKeys !== null) {
            return $this->permissionKeys;
        }

        $role = $this->roleModel;
        if (! $role || ! $role->active) {
            return $this->permissionKeys = [];
        }

        return $this->permissionKeys = $role->is_system
            ? Permission::pluck('key')->all()
            : $role->permissions()->pluck('key')->all();
    }

    public function hasPermission(string $key): bool
    {
        return $this->isAdmin() || in_array($key, $this->permissionKeys(), true);
    }

    /** Datos del usuario que necesita el panel. */
    public function toPanelArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'position' => $this->position,
            'role' => $this->roleModel?->slug,
            'role_name' => $this->roleModel?->name,
            'is_admin' => $this->isAdmin(),
            'must_change_password' => (bool) $this->must_change_password,
            'last_login_at' => $this->last_login_at,
            'permissions' => $this->permissionKeys(),
        ];
    }
}
