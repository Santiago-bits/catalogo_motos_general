<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\GoogleAuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with('roleModel')->where('email', $data['email'])->first();

        if (! $user || ! Auth::guard('web')->getProvider()->validateCredentials($user, $data)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales no son válidas.'],
            ]);
        }

        if (! $user->canAccessPanel()) {
            throw ValidationException::withMessages([
                'email' => ['Esta cuenta no tiene acceso al panel.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        ActivityLog::log($user->id, 'login', 'User', $user->id, "Inició sesión {$user->name}", 'sesion');

        $token = $user->createToken('admin-panel')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->toPanelArray(),
        ]);
    }

    /** Datos públicos del login: si está activo "Iniciar sesión con Google". */
    public function config()
    {
        return response()->json([
            'google_client_id' => GoogleAuthService::isConfigured() ? GoogleAuthService::clientId() : null,
        ]);
    }

    /**
     * Login con el botón "Iniciar sesión con Google". Sólo entra quien ya es
     * usuario activo del panel con ese mismo email (como en SH Servicios).
     */
    public function loginWithGoogle(Request $request)
    {
        abort_unless(GoogleAuthService::isConfigured(), 400, 'El inicio de sesión con Google no está disponible.');

        $data = $request->validate(['credential' => ['required', 'string', 'max:4096']]);

        $account = GoogleAuthService::verifyIdToken($data['credential']);
        abort_if($account === null, 401, 'No se pudo verificar la cuenta de Google. Probá de nuevo.');

        $user = User::with('roleModel')->whereRaw('LOWER(email) = ?', [$account['email']])->first();
        abort_if($user === null, 401, "No hay ningún usuario con el email {$account['email']}. Pedile al administrador que lo cargue.");
        abort_unless($user->canAccessPanel(), 401, 'La cuenta está desactivada o no tiene acceso al panel. Contactá al administrador.');

        $user->forceFill(['last_login_at' => now()])->save();
        ActivityLog::log($user->id, 'login', 'User', $user->id, "Inició sesión con Google {$user->name}", 'sesion');

        return response()->json([
            'token' => $user->createToken('admin-panel')->plainTextToken,
            'user' => $user->toPanelArray(),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->load('roleModel')->toPanelArray());
    }

    /** Mis datos: nombre, email y teléfono. Pide la contraseña actual para confirmar. */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:40'],
            'current_password' => ['required', 'string'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['La contraseña actual no es correcta.']]);
        }

        unset($data['current_password']);
        $user->update($data);

        ActivityLog::log($user->id, 'editar', 'User', $user->id, 'Actualizó sus datos de perfil', 'perfil', ActivityLog::diff($user));

        return response()->json($user->load('roleModel')->toPanelArray());
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['La contraseña actual no es correcta.']]);
        }

        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['La contraseña nueva tiene que ser distinta de la actual.']]);
        }

        $user->update(['password' => $data['password'], 'must_change_password' => false]);

        // Cierra las otras sesiones abiertas, conserva la actual.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        ActivityLog::log($user->id, 'editar', 'User', $user->id, 'Cambió su contraseña', 'perfil');

        return response()->json(['ok' => true]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }
}
