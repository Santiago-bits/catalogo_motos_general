<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Inquiry;
use App\Models\Product;
use App\Models\Quote;
use App\Models\SearchLog;
use App\Models\Service;
use Illuminate\Database\Eloquent\Builder;

class DashboardController extends Controller
{
    /** Secciones del catálogo: clave => [tipo, condición, etiqueta, ruta del panel]. */
    private const SECTIONS = [
        'motos' => ['moto', 'nueva', 'Motos 0 km', 'motos'],
        'usadas' => ['moto', 'usada', 'Motos usadas', 'usadas'],
        'cascos' => ['casco', null, 'Cascos', 'cascos'],
        'repuestos' => ['repuesto', null, 'Repuestos', 'repuestos'],
    ];

    public function index()
    {
        $stats = [];
        foreach (self::SECTIONS as $key => [$type, $condition]) {
            $stats[$key] = $this->section($type, $condition)->count();
            $stats[$key.'_active'] = $this->section($type, $condition)->where('active', true)->count();
        }

        $stats += [
            'categories' => Category::count(),
            'brands' => Brand::count(),
            'services' => Service::count(),
            'featured' => Product::where('featured', true)->where('active', true)->count(),
            'offers' => Product::where('is_offer', true)->where('active', true)->count(),
            'inactive' => Product::where('active', false)->count(),
            'stock_units' => (int) Product::where('stock_qty', '>', 0)->sum('stock_qty'),
            'stock_out' => Product::where('active', true)->where('stock_qty', '<=', 0)->count(),
            'inquiries_new' => Inquiry::where('status', 'nueva')->count(),
            'inquiries_total' => Inquiry::count(),
            'quotes_pending' => Quote::where('status', 'pendiente')->count(),
            'quotes_total' => Quote::count(),
        ];

        return response()->json([
            'stats' => $stats,
            'review' => $this->review(),
            'inquiries' => Inquiry::with('product:id,name')->latest()->limit(6)->get(['id', 'name', 'email', 'phone', 'message', 'status', 'source', 'product_id', 'created_at']),
            'top_products' => Product::active()->orderByDesc('views')->limit(5)->get(['id', 'name', 'type', 'views']),
            'top_searches' => SearchLog::query()
                ->selectRaw('term, count(*) as total')
                ->groupBy('term')
                ->orderByDesc('total')
                ->limit(5)
                ->get(),
        ]);
    }

    /** Notas de las actualizaciones del panel (HTML plano en resources/content/novedades.html). */
    public function news()
    {
        $file = resource_path('content/novedades.html');

        return response()->json(['html' => is_file($file) ? trim((string) file_get_contents($file)) : '']);
    }

    /** Números que muestra el menú lateral (consultas sin responder, cotizaciones pendientes). */
    public function counters()
    {
        return response()->json([
            'inquiries_new' => Inquiry::where('status', 'nueva')->count(),
            'quotes_pending' => Quote::where('status', 'pendiente')->count(),
        ]);
    }

    /**
     * Cosas para revisar: productos publicados sin precio, sin foto o sin categoría.
     * Cada fila lleva al listado de ESA sección con el filtro aplicado.
     */
    private function review(): array
    {
        $checks = [
            'sin_precio' => ['sin precio', fn (Builder $q) => $q->where('final_price', '<=', 0), 'tag'],
            'sin_imagen' => ['sin foto', fn (Builder $q) => $q->doesntHave('images'), 'image'],
            'sin_categoria' => ['sin categoría', fn (Builder $q) => $q->whereNull('category_id'), 'folder-x'],
            'sin_stock' => ['sin stock', fn (Builder $q) => $q->where('stock_qty', '<=', 0), 'box-seam'],
            'stock_bajo' => ['con stock bajo', fn (Builder $q) => StockController::lowStock($q), 'exclamation-triangle'],
        ];

        $review = [];
        foreach (self::SECTIONS as [$type, $condition, $label, $route]) {
            foreach ($checks as $flag => [$suffix, $apply, $icon]) {
                $count = $apply($this->section($type, $condition)->where('active', true))->count();
                if ($count === 0) {
                    continue;
                }
                $isStock = in_array($flag, ['sin_stock', 'stock_bajo'], true);
                $review[] = [
                    'label' => "{$label} {$suffix}",
                    'count' => $count,
                    'route' => $isStock ? 'stock' : $route,
                    'flag' => $flag,
                    'icon' => $icon,
                    'query' => $isStock ? ['seccion' => $route, 'estado_stock' => $flag === 'sin_stock' ? 'sin' : 'bajo'] : [$flag => '1'],
                ];
            }
        }

        return $review;
    }

    private function section(string $type, ?string $condition): Builder
    {
        $query = Product::query()->where('type', $type);

        // "0 km" incluye las motos sin ficha cargada: sólo excluye las usadas.
        if ($condition === 'nueva') {
            $query->whereDoesntHave('moto', fn ($q) => $q->whereIn('condition_type', ['usada', 'reacondicionada']));
        } elseif ($condition === 'usada') {
            $query->whereHas('moto', fn ($q) => $q->whereIn('condition_type', ['usada', 'reacondicionada']));
        }

        return $query;
    }
}
