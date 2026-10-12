<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index()
    {
        return Role::withCount('users')->with('permissions:id,key')->orderByDesc('is_system')->orderBy('name')->get()
            ->map(fn (Role $role) => $this->payload($role));
    }

    /** Permisos agrupados por módulo, para armar los checkboxes. */
    public function permissions()
    {
        return Permission::orderBy('sort_order')->get(['id', 'key', 'module', 'label'])
            ->groupBy('module')
            ->map(fn ($items, $module) => ['module' => $module, 'permissions' => $items->values()])
            ->values();
    }

    public function show(Role $role)
    {
        return $this->payload($role->loadCount('users')->load('permissions:id,key'));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $role = Role::create([
            'name' => $data['name'],
            'slug' => $this->uniqueSlug($data['name']),
            'description' => $data['description'] ?? null,
            'active' => $data['active'] ?? true,
        ]);
        $role->permissions()->sync($data['permissions'] ?? []);

        ActivityLog::log($request->user()->id, 'crear', 'Role', $role->id, "Creó el rol \"{$role->name}\"");

        return response()->json($this->payload($role->loadCount('users')->load('permissions:id,key')), 201);
    }

    public function update(Request $request, Role $role)
    {
        $data = $this->validated($request, $role);

        $role->update([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            // El rol de sistema no se puede desactivar ni recortar: siempre tiene todo.
            'active' => $role->is_system ? true : ($data['active'] ?? $role->active),
        ]);
        $changes = ActivityLog::diff($role);

        if (! $role->is_system) {
            $before = $role->permissions()->orderBy('key')->pluck('key')->all();
            $role->permissions()->sync($data['permissions'] ?? []);
            $after = $role->permissions()->orderBy('key')->pluck('key')->all();
            if ($before !== $after) {
                $changes['permisos'] = [implode(', ', $before), implode(', ', $after)];
            }
        }

        ActivityLog::log($request->user()->id, 'editar', 'Role', $role->id, "Editó el rol \"{$role->name}\"", null, $changes);

        return $this->payload($role->loadCount('users')->load('permissions:id,key'));
    }

    public function destroy(Request $request, Role $role)
    {
        abort_if($role->is_system, 422, 'El rol de administrador no se puede eliminar.');
        abort_if($role->users()->exists(), 422, 'Hay usuarios con este rol. Asignales otro rol antes de eliminarlo.');

        ActivityLog::log($request->user()->id, 'eliminar', 'Role', $role->id, "Eliminó el rol \"{$role->name}\"");
        $role->delete();

        return response()->json(['ok' => true]);
    }

    private function validated(Request $request, ?Role $role = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('roles', 'name')->ignore($role?->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'active' => ['boolean'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ], ['name.unique' => 'Ya existe un rol con ese nombre.']);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'rol';
        $slug = $base;
        $i = 2;
        while (Role::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    private function payload(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'slug' => $role->slug,
            'description' => $role->description,
            'is_system' => $role->is_system,
            'active' => $role->active,
            'users_count' => $role->users_count ?? 0,
            'permission_ids' => $role->is_system
                ? Permission::pluck('id')->all()
                : $role->permissions->pluck('id')->all(),
        ];
    }
}
