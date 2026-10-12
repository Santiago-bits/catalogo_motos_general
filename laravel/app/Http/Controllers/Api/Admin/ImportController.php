<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\ImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ImportController extends Controller
{
    /** Opción del panel => [tipo de producto, condición fija (sólo motos), sección del panel]. */
    private const TYPES = [
        'motos-nuevas' => ['moto', 'nueva', 'motos'],
        'motos-usadas' => ['moto', 'usada', 'usadas'],
        'motos' => ['moto', null, 'motos'],
        'cascos' => ['casco', null, 'cascos'],
        'repuestos' => ['repuesto', null, 'repuestos'],
    ];

    /** La previsualización queda guardada 30 minutos, igual que en SH. */
    private const PREVIEW_TTL = 1800;

    /** Columnas de cada plantilla y los valores que acepta cada una. */
    public function index()
    {
        $columns = [];
        foreach (self::TYPES as $key => [$type, $condition]) {
            $columns[$key] = collect(ImportService::columnsFor($type, $condition))->map(fn ($def, $column) => [
                'column' => $column,
                'kind' => $def[1],
                'options' => $def[2] ?? null,
                'required' => in_array($column, ['codigo', 'nombre'], true),
            ])->values();
        }

        return response()->json(['columns' => $columns]);
    }

    public function template(string $type)
    {
        abort_unless(isset(self::TYPES[$type]), 404);

        [$productType, $condition] = self::TYPES[$type];

        return response(ImportService::template($productType, $condition), 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="plantilla-'.$type.'.csv"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /** Lee el CSV, valida cada fila y devuelve la previsualización. No escribe nada. */
    public function preview(Request $request)
    {
        $request->validate([
            'tipo' => ['required', 'in:'.implode(',', array_keys(self::TYPES))],
            'archivo' => ['required', 'file', 'max:6144'],
        ], ['archivo.max' => 'El archivo supera los 6 MB.']);

        $file = $request->file('archivo');
        if (! in_array(strtolower($file->getClientOriginalExtension()), ['csv', 'txt'], true)) {
            abort(422, 'El archivo tiene que ser CSV. Si tenés un Excel, guardalo como "CSV (delimitado por punto y coma)".');
        }

        [$type, $condition, $section] = self::TYPES[$request->input('tipo')];
        $result = ImportService::parse($file->getRealPath(), $type, $condition);
        abort_unless($result['ok'], 422, $result['message']);

        $token = Str::random(40);
        Cache::put($this->cacheKey($request, $token), [
            'type' => $type,
            'section' => $section,
            'name' => $file->getClientOriginalName(),
            'valid' => $result['valid'],
        ], self::PREVIEW_TTL);

        return response()->json([
            'token' => $token,
            'type' => $type,
            'name' => $file->getClientOriginalName(),
            'message' => $result['message'],
            'columns' => $result['columns'],
            'valid' => array_map(fn ($row) => ['line' => $row['line'], 'raw' => $row['raw']], array_slice($result['valid'], 0, 300)),
            'invalid' => array_slice($result['invalid'], 0, 300),
            'valid_count' => count($result['valid']),
            'invalid_count' => count($result['invalid']),
        ]);
    }

    /** Importa las filas correctas de una previsualización. */
    public function run(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'actualizar' => ['boolean'],
        ]);

        $key = $this->cacheKey($request, $data['token']);
        $preview = Cache::pull($key);
        abort_unless(is_array($preview) && ! empty($preview['valid']), 422, 'La previsualización caducó o no tiene filas válidas. Subí el archivo nuevamente.');

        $result = ImportService::run($preview['valid'], $preview['type'], $request->boolean('actualizar', true), $request->user()->id);

        ActivityLog::log(
            $request->user()->id, 'importar', null, null,
            sprintf('Importó "%s": %d creado(s), %d actualizado(s), %d con error', $preview['name'], $result['created'], $result['updated'], count($result['errors'])),
            'datos'
        );

        return response()->json($result + ['type' => $preview['type'], 'section' => $preview['section'] ?? null]);
    }

    private function cacheKey(Request $request, string $token): string
    {
        return 'import-preview:'.$request->user()->id.':'.$token;
    }
}
