<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    private const USED = ['usada', 'reacondicionada'];

    /** Inventario: cada producto con su stock, mínimo y estado. */
    public function index(Request $request)
    {
        $query = $this->filtered($request)->with(['brand:id,name', 'category:id,name', 'mainImage', 'moto:product_id,condition_type,model']);

        match ($request->query('orden', 'stock_asc')) {
            'stock_desc' => $query->orderByDesc('stock_qty'),
            'nombre' => $query->orderBy('name'),
            'codigo' => $query->orderBy('code'),
            default => $query->orderBy('stock_qty')->orderBy('name'),
        };

        $page = $query->paginate(min(max((int) $request->query('por_pagina', 25), 5), 100))->appends($request->query());

        $page->getCollection()->transform(fn (Product $p) => [
            'id' => $p->id,
            'type' => $p->type,
            'code' => $p->code,
            'name' => $p->name,
            'slug' => $p->slug,
            'brand' => $p->brand?->name,
            'category' => $p->category?->name,
            'model' => $p->moto?->model,
            'condition' => $p->moto?->condition_type,
            'thumb' => $p->mainImage?->thumb_path ?? $p->mainImage?->path,
            'stock_qty' => (int) $p->stock_qty,
            'stock_min' => (int) $p->stock_min,
            'stock_status' => $this->status($p),
            'availability' => $p->availability,
            'active' => (bool) $p->active,
            'final_price' => (float) $p->final_price,
            'currency' => $p->currency,
        ]);

        return response()->json($page->toArray() + ['summary' => $this->summary()]);
    }

    /** Historial de movimientos (de un producto o de todos). */
    public function movements(Request $request)
    {
        $query = StockMovement::query()->with(['product:id,name,code,type,slug', 'user:id,name'])->latest('id');

        if ($product = $request->query('producto')) {
            $query->where('product_id', $product);
        }
        if ($type = $request->query('tipo')) {
            $query->where('type', $type);
        }
        if ($user = $request->query('usuario')) {
            $query->where('user_id', $user);
        }
        if ($term = trim((string) $request->query('q'))) {
            $query->whereHas('product', fn ($q) => $q->withTrashed()->where(fn ($w) => $w->where('name', 'like', "%{$term}%")->orWhere('code', 'like', "%{$term}%")));
        }
        if ($from = $request->query('desde')) {
            $query->where('created_at', '>=', $from.' 00:00:00');
        }
        if ($to = $request->query('hasta')) {
            $query->where('created_at', '<=', $to.' 23:59:59');
        }

        return $query->paginate(min(max((int) $request->query('por_pagina', 30), 10), 100))->appends($request->query());
    }

    /** Motivos y usuarios para los filtros y formularios. */
    public function meta()
    {
        return response()->json([
            'reasons' => StockMovement::REASONS,
            'users' => User::whereIn('id', StockMovement::whereNotNull('user_id')->distinct()->pluck('user_id'))->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** Carga un ingreso, egreso o ajuste. */
    public function store(Request $request, Product $product)
    {
        $data = $request->validate([
            'type' => ['required', 'in:ingreso,egreso,ajuste'],
            'quantity' => ['required', 'integer', 'min:0', 'max:100000'],
            'reason' => ['nullable', 'in:'.implode(',', array_keys(StockMovement::REASONS))],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'quantity.required' => 'Indicá la cantidad.',
            'quantity.integer' => 'La cantidad tiene que ser un número entero.',
        ]);

        $movement = StockService::move($product, $data['type'], (int) $data['quantity'], $data['reason'] ?? null, $data['note'] ?? null, $request->user()->id);

        return response()->json([
            'movement' => $movement,
            'stock_qty' => (int) $product->stock_qty,
            'availability' => $product->availability,
            'stock_status' => $this->status($product),
        ], 201);
    }

    /** Stock mínimo: por debajo de ese número el producto aparece como "stock bajo". */
    public function updateMin(Request $request, Product $product)
    {
        $data = $request->validate(['stock_min' => ['required', 'integer', 'min:0', 'max:100000']]);

        $old = (int) $product->stock_min;
        $product->update(['stock_min' => $data['stock_min']]);
        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Cambió el stock mínimo de \"{$product->name}\"", 'stock', ['stock_min' => [$old, (int) $data['stock_min']]]);

        return response()->json(['stock_min' => (int) $product->stock_min, 'stock_status' => $this->status($product)]);
    }

    // ------------------------------------------------------------------

    private function filtered(Request $request): Builder
    {
        $query = Product::query();

        match ($request->query('seccion')) {
            'motos' => $query->where('type', 'moto')->whereDoesntHave('moto', fn ($q) => $q->whereIn('condition_type', self::USED)),
            'usadas' => $query->where('type', 'moto')->whereHas('moto', fn ($q) => $q->whereIn('condition_type', self::USED)),
            'cascos' => $query->where('type', 'casco'),
            'repuestos' => $query->where('type', 'repuesto'),
            default => null,
        };

        match ($request->query('estado_stock')) {
            'sin' => $query->where('stock_qty', '<=', 0),
            'bajo' => self::lowStock($query),
            'ok' => $query->where('stock_qty', '>', 0)->whereRaw('stock_qty > stock_min'),
            default => null,
        };

        if ($term = trim((string) $request->query('q'))) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$term}%")->orWhere('code', 'like', "%{$term}%"));
        }
        if ($brand = $request->query('marca')) {
            $query->where('brand_id', $brand);
        }
        if (in_array($request->query('activo'), ['0', '1'], true)) {
            $query->where('active', $request->query('activo') === '1');
        }

        return $query;
    }

    /** Con stock pero igual o por debajo del mínimo configurado. */
    public static function lowStock(Builder $query): Builder
    {
        return $query->where('stock_qty', '>', 0)->where('stock_min', '>', 0)->whereColumn('stock_qty', '<=', 'stock_min');
    }

    private function status(Product $p): string
    {
        if ($p->stock_qty <= 0) {
            return 'sin';
        }

        return $p->stock_min > 0 && $p->stock_qty <= $p->stock_min ? 'bajo' : 'ok';
    }

    /** Totales del inventario completo (no dependen de los filtros). */
    private function summary(): array
    {
        return [
            'units' => (int) Product::sum(DB::raw('GREATEST(stock_qty,0)')),
            'products' => Product::count(),
            'out' => Product::where('stock_qty', '<=', 0)->count(),
            'low' => self::lowStock(Product::query())->count(),
            'movements_today' => StockMovement::whereDate('created_at', today())->count(),
        ];
    }
}
