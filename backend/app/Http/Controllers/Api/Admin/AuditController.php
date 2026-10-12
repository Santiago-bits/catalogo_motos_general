<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request)
    {
        return self::filtered($request)
            ->with('user:id,name')
            ->latest('id')
            ->paginate(min(max((int) $request->query('por_pagina', 30), 10), 100))
            ->appends($request->query());
    }

    /** Valores para los filtros: secciones, acciones y usuarios que aparecen en el registro. */
    public function meta()
    {
        return response()->json([
            'modules' => ActivityLog::query()->whereNotNull('module')->distinct()->orderBy('module')->pluck('module'),
            'actions' => ActivityLog::query()->distinct()->orderBy('action')->pluck('action'),
            'users' => User::query()->whereIn('id', ActivityLog::query()->whereNotNull('user_id')->distinct()->pluck('user_id'))->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** Filtros compartidos con la exportación de auditoría. */
    public static function filtered(Request $request): Builder
    {
        $query = ActivityLog::query();

        if ($term = trim((string) $request->query('q'))) {
            $query->where('description', 'like', "%{$term}%");
        }
        if ($module = $request->query('modulo')) {
            $query->where('module', $module);
        }
        if ($action = $request->query('accion')) {
            $query->where('action', $action);
        }
        if ($user = $request->query('usuario')) {
            $query->where('user_id', $user);
        }
        if ($from = $request->query('desde')) {
            $query->where('created_at', '>=', $from.' 00:00:00');
        }
        if ($to = $request->query('hasta')) {
            $query->where('created_at', '<=', $to.' 23:59:59');
        }

        return $query;
    }
}
