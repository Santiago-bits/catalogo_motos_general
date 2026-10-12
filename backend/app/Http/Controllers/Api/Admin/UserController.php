<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index()
    {
        return User::with('roleModel:id,name,slug,is_system')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'phone', 'position', 'role_id', 'active', 'must_change_password', 'last_login_at', 'created_at'])
            ->map(fn (User $user) => $this->payload($user));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'role_id' => ['required', 'exists:roles,id'],
            'phone' => ['nullable', 'string', 'max:40'],
            'position' => ['nullable', 'string', 'max:120'],
            'active' => ['boolean'],
            'must_change_password' => ['boolean'],
        ], ['email.unique' => 'Ya hay un usuario con ese email.']);

        $data['role'] = $this->legacyRole((int) $data['role_id']);
        $user = User::create($data);

        ActivityLog::log($request->user()->id, 'crear', 'User', $user->id, "Creó el usuario {$user->name} ({$user->email})");

        return response()->json($this->payload($user->load('roleModel')), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', Password::min(8)],
            'role_id' => ['required', 'exists:roles,id'],
            'phone' => ['nullable', 'string', 'max:40'],
            'position' => ['nullable', 'string', 'max:120'],
            'active' => ['boolean'],
            'must_change_password' => ['boolean'],
        ]);

        $isSelf = $user->id === $request->user()->id;
        if ($isSelf && (! ($data['active'] ?? true) || (int) $data['role_id'] !== (int) $user->role_id)) {
            abort(422, 'No podés desactivarte ni cambiarte el rol a vos mismo.');
        }

        if (empty($data['password'])) {
            unset($data['password']);
        }
        $data['role'] = $this->legacyRole((int) $data['role_id']);

        $user->update($data);
        $changes = ActivityLog::diff($user, ['updated_at', 'password', 'remember_token', 'role']);
        if (isset($data['password'])) {
            $changes['password'] = ['(anterior)', '(nueva)'];
            $user->tokens()->delete();
        }

        ActivityLog::log($request->user()->id, 'editar', 'User', $user->id, "Editó el usuario {$user->name}", null, $changes);

        return $this->payload($user->load('roleModel'));
    }

    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'No podés eliminar tu propio usuario.');

        $activeAdmins = User::where('active', true)->whereHas('roleModel', fn ($q) => $q->where('is_system', true))->count();
        abort_if($user->isAdmin() && $activeAdmins <= 1, 422, 'Es el único administrador activo: no se puede eliminar.');

        ActivityLog::log($request->user()->id, 'eliminar', 'User', $user->id, "Eliminó el usuario {$user->name} ({$user->email})");
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['ok' => true]);
    }

    /** La columna vieja "role" (admin/editor) se mantiene en sync por compatibilidad. */
    private function legacyRole(int $roleId): string
    {
        return Role::find($roleId)?->is_system ? 'admin' : 'editor';
    }

    private function payload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'position' => $user->position,
            'role_id' => $user->role_id,
            'role_name' => $user->roleModel?->name,
            'is_admin' => (bool) $user->roleModel?->is_system,
            'active' => (bool) $user->active,
            'must_change_password' => (bool) $user->must_change_password,
            'last_login_at' => $user->last_login_at,
            'created_at' => $user->created_at,
        ];
    }
}
