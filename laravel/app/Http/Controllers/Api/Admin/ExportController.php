<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\ExportService;
use App\Services\PdfService;
use Illuminate\Http\Request;

class ExportController extends Controller
{
    /** Conjuntos disponibles y qué formatos puede generar este servidor. */
    public function index()
    {
        return response()->json([
            'datasets' => collect(ExportService::DATASETS)->map(fn ($def, $key) => [
                'key' => $key,
                'title' => $def[0],
                'description' => $def[1],
                'catalog' => in_array($key, ['motos', 'usadas', 'cascos', 'repuestos'], true),
            ])->values(),
            'catalog_sets' => collect(self::CATALOG_SETS)->map(fn ($title, $key) => [
                'key' => $key,
                'title' => $title,
                'type' => match ($key) { 'cascos' => 'casco', 'repuestos' => 'repuesto', default => 'moto' },
            ])->values(),
            'xlsx' => class_exists(\ZipArchive::class),
            'pdf_images' => extension_loaded('gd'),
        ]);
    }

    public function download(Request $request, string $dataset, string $format)
    {
        abort_unless(isset(ExportService::DATASETS[$dataset]), 404);
        abort_unless(in_array($format, ['csv', 'xlsx', 'pdf'], true), 404);

        $auditQuery = $dataset === 'auditoria' ? AuditController::filtered($request) : null;
        $data = ExportService::dataset($dataset, $auditQuery);

        ActivityLog::log($request->user()->id, 'exportar', null, null, "Exportó {$data['title']} a ".strtoupper($format), 'datos');

        return ExportService::respond($data, $format, $dataset.'-'.now()->format('Ymd-His'));
    }

    /** Catálogo en PDF con fotos y ficha resumida. */
    /** Conjuntos que pueden salir como catálogo con fotos. */
    private const CATALOG_SETS = [
        'motos' => 'Motos 0 km',
        'usadas' => 'Motos usadas',
        'motos-todas' => 'Motos 0 km y usadas',
        'cascos' => 'Cascos y accesorios',
        'repuestos' => 'Repuestos',
    ];

    /** Catálogo en PDF con fotos y ficha resumida, con filtros. */
    public function catalog(Request $request, string $dataset)
    {
        abort_unless(isset(self::CATALOG_SETS[$dataset]), 404);

        $filters = $request->validate([
            'categoria' => ['nullable', 'integer'],
            'marca' => ['nullable', 'integer'],
            'estado' => ['nullable', 'in:disponible,reservado,vendido,consultar'],
            'precio_min' => ['nullable', 'numeric', 'min:0'],
            'precio_max' => ['nullable', 'numeric', 'min:0'],
            'anio_min' => ['nullable', 'integer'],
            'anio_max' => ['nullable', 'integer'],
            'orden' => ['nullable', 'in:destacados,nombre,precio_asc,precio_desc,codigo,recientes,anio_desc'],
            'titulo' => ['nullable', 'string', 'max:80'],
        ]);

        $query = ExportService::productsFor($dataset)->with(['brand', 'category', 'mainImage', 'moto', 'casco', 'repuesto']);

        if (! $request->boolean('incluir_no_publicados')) {
            $query->where('active', true);
        }
        if (! empty($filters['categoria'])) {
            $query->where('category_id', $filters['categoria']);
        }
        if (! empty($filters['marca'])) {
            $query->where('brand_id', $filters['marca']);
        }
        if (! empty($filters['estado'])) {
            $query->where('availability', $filters['estado']);
        } elseif (! $request->boolean('incluir_vendidos')) {
            // Por defecto el catálogo no muestra lo vendido.
            $query->where('availability', '!=', 'vendido');
        }
        if (isset($filters['precio_min']) && $filters['precio_min'] !== '') {
            $query->where('final_price', '>=', $filters['precio_min']);
        }
        if (! empty($filters['precio_max'])) {
            $query->where('final_price', '<=', $filters['precio_max']);
        }
        if (! empty($filters['anio_min'])) {
            $query->whereHas('moto', fn ($q) => $q->where('year', '>=', $filters['anio_min']));
        }
        if (! empty($filters['anio_max'])) {
            $query->whereHas('moto', fn ($q) => $q->where('year', '<=', $filters['anio_max']));
        }
        if ($request->boolean('solo_destacados')) {
            $query->where('featured', true);
        }
        if ($request->boolean('solo_ofertas')) {
            $query->where('is_offer', true);
        }
        if ($request->boolean('solo_con_foto')) {
            $query->has('images');
        }

        match ($filters['orden'] ?? 'destacados') {
            'nombre' => $query->orderBy('name'),
            'precio_asc' => $query->orderBy('final_price'),
            'precio_desc' => $query->orderByDesc('final_price'),
            'codigo' => $query->orderBy('code'),
            'recientes' => $query->orderByDesc('created_at'),
            'anio_desc' => $query->orderByDesc(\App\Models\Moto::select('year')->whereColumn('motos.product_id', 'products.id')->limit(1)),
            default => $query->orderByDesc('featured')->orderBy('name'),
        };

        $products = $query->get();
        abort_if($products->isEmpty(), 422, 'Ningún producto coincide con esos filtros. Probá con menos filtros.');

        $title = trim((string) ($filters['titulo'] ?? '')) ?: 'Catálogo · '.self::CATALOG_SETS[$dataset];
        $pdf = PdfService::catalog($products, $title, $request->boolean('precios', true));

        ActivityLog::log($request->user()->id, 'exportar', null, null, "Generó el catálogo PDF \"{$title}\" ({$products->count()} productos)", 'datos');

        return PdfService::response($pdf, 'catalogo-'.$dataset.'-'.now()->format('Ymd').'.pdf');
    }
}
