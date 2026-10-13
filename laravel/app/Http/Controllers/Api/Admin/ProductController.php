<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminProductResource;
use App\Models\ActivityLog;
use App\Models\Casco;
use App\Models\FeatureValue;
use App\Models\Moto;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\Repuesto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    private const USED = ['usada', 'reacondicionada'];

    /**
     * Listado del panel. Igual que en SH: "Motos" muestra sólo las 0 km y las
     * usadas quedan aparte (?condicion=usada).
     */
    public function index(Request $request)
    {
        $query = Product::query()->with(['brand', 'category', 'mainImage', 'moto', 'casco', 'repuesto']);

        $type = $request->query('type');
        if ($type) {
            $query->where('type', $type);
        }

        $condition = $request->query('condicion');
        if ($type === 'moto') {
            if (in_array($condition, self::USED, true) || $condition === 'usado') {
                $query->whereHas('moto', fn ($q) => $q->whereIn('condition_type', self::USED));
            } else {
                $query->whereDoesntHave('moto', fn ($q) => $q->whereIn('condition_type', self::USED));
            }
        }

        if ($term = trim((string) $request->query('q'))) {
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%")
                    ->orWhereHas('moto', fn ($m) => $m->where('model', 'like', "%{$term}%"));
            });
        }

        if ($category = $request->query('categoria')) {
            $query->where('category_id', $category);
        }
        if ($brand = $request->query('marca')) {
            $query->where('brand_id', $brand);
        }
        if ($status = $request->query('estado')) {
            $query->where('availability', $status);
        }
        if (in_array($request->query('activo'), ['0', '1'], true)) {
            $query->where('active', $request->query('activo') === '1');
        }
        if ($request->boolean('sin_precio')) {
            $query->where('final_price', '<=', 0);
        }
        if ($request->boolean('sin_imagen')) {
            $query->doesntHave('images');
        }
        if ($request->boolean('sin_categoria')) {
            $query->whereNull('category_id');
        }

        match ($request->query('orden', 'codigo_desc')) {
            'codigo' => $query->orderBy('code'),
            'az' => $query->orderBy('name'),
            'za' => $query->orderByDesc('name'),
            'precio_asc' => $query->orderBy('final_price'),
            'precio_desc' => $query->orderByDesc('final_price'),
            'recientes' => $query->orderByDesc('created_at'),
            default => $query->orderByDesc('code'),
        };

        $perPage = min(max((int) $request->query('por_pagina', 25), 5), 100);

        return AdminProductResource::collection($query->paginate($perPage));
    }

    public function show(Product $product)
    {
        $product->load([
            'brand', 'category', 'images', 'tags', 'moto', 'casco', 'repuesto', 'featureValues.feature',
            'documents', 'videos', 'updater:id,name', 'codes.brand:id,name', 'compatibilities.brand:id,name',
        ]);

        return (new AdminProductResource($product))->additional([
            'price_history' => PriceHistory::where('product_id', $product->id)->latest('id')->limit(20)->get(),
            'codes' => $product->codes,
            'compatibilities' => $product->compatibilities,
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        [$data, $detail, $tagIds, $specs] = $this->split($data);

        $data['code'] = ($data['code'] ?? null) ?: $this->nextCode($data['type']);
        $data['currency'] = ($data['currency'] ?? null) ?: (\App\Models\Setting::get('currency_default') ?: 'ARS');
        $data['slug'] = $this->slugFor($data['name']);
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;
        $data['price_updated_at'] = now();

        $product = DB::transaction(function () use ($data, $detail, $tagIds, $specs) {
            $product = Product::create($data);
            $this->syncDetail($product, $detail);
            $product->tags()->sync($tagIds ?? []);
            $this->syncSpecs($product, $specs);

            return $product;
        });

        if ($product->final_price > 0) {
            PriceHistory::create([
                'product_id' => $product->id,
                'old_price' => null,
                'new_price' => $product->final_price,
                'currency' => $product->currency,
                'changed_by' => $request->user()->id,
            ]);
        }

        ActivityLog::log($request->user()->id, 'crear', 'Product', $product->id, "Creó el producto \"{$product->name}\" ({$product->code})");

        return $this->show($product->fresh());
    }

    public function update(Request $request, Product $product)
    {
        $data = $this->validated($request, $product);
        [$data, $detail, $tagIds, $specs] = $this->split($data);
        unset($data['type']);

        $data['code'] = ($data['code'] ?? null) ?: $product->code;
        $data['updated_by'] = $request->user()->id;

        $changes = DB::transaction(function () use ($product, $data, $detail, $tagIds, $specs) {
            $product->update($data);
            $changes = ActivityLog::diff($product);

            $detailModel = $this->syncDetail($product, $detail);
            if ($detailModel) {
                $changes += ActivityLog::diff($detailModel, ['product_id']);
            }

            if ($tagIds !== null) {
                $product->tags()->sync($tagIds);
            }
            $this->syncSpecs($product, $specs);

            return $changes;
        });

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Editó el producto \"{$product->name}\" ({$product->code})", null, $changes);

        return $this->show($product->fresh());
    }

    public function destroy(Request $request, Product $product)
    {
        ActivityLog::log($request->user()->id, 'eliminar', 'Product', $product->id, "Eliminó el producto \"{$product->name}\" ({$product->code})");
        $product->purge();

        return response()->json(['ok' => true]);
    }

    /** Crea una copia idéntica (sin publicar) para editarla. */
    public function duplicate(Request $request, Product $product)
    {
        $product->load(['moto', 'casco', 'repuesto', 'tags', 'featureValues', 'images', 'codes', 'compatibilities']);

        $copy = DB::transaction(function () use ($product, $request) {
            $copy = $product->replicate(['slug', 'code', 'views', 'inquiries_count']);
            $copy->name = Str::limit($product->name, 190, '').' (copia)';
            $copy->code = $this->nextCode($product->type);
            $copy->slug = $this->slugFor($copy->name);
            $copy->active = false;
            $copy->featured = false;
            $copy->views = 0;
            $copy->inquiries_count = 0;
            $copy->created_by = $request->user()->id;
            $copy->updated_by = $request->user()->id;
            $copy->save();

            if ($detail = $product->{$product->type}) {
                $copy->{$product->type}()->create(collect($detail->getAttributes())->except(['product_id', 'id'])->all());
            }

            $copy->tags()->sync($product->tags->pluck('id'));

            foreach ($product->featureValues as $value) {
                $copy->featureValues()->create($value->only(['feature_id', 'value_text', 'value_number']));
            }

            foreach ($product->codes as $code) {
                $copy->codes()->create($code->only(['code_type', 'code', 'brand_id', 'note']));
            }

            foreach ($product->compatibilities as $compat) {
                $copy->compatibilities()->create($compat->only(['brand_id', 'model', 'year_from', 'year_to', 'note']));
            }

            // Las fotos se copian como archivos nuevos: borrar una en la copia no afecta al original.
            foreach ($product->images as $image) {
                $newPath = $this->copyPublicFile($image->path, $copy->type);
                if ($newPath) {
                    $copy->images()->create([
                        'path' => $newPath,
                        'thumb_path' => null,
                        'alt' => $image->alt,
                        'is_main' => $image->is_main,
                        'sort_order' => $image->sort_order,
                    ]);
                }
            }

            return $copy;
        });

        ActivityLog::log($request->user()->id, 'crear', 'Product', $copy->id, "Duplicó \"{$product->name}\" como {$copy->code}");

        return response()->json(['id' => $copy->id, 'code' => $copy->code], 201);
    }

    /** Pasa una moto de 0 km a usada o al revés. */
    public function toggleCondition(Request $request, Product $product)
    {
        abort_unless($product->type === 'moto', 422, 'Sólo las motos tienen condición.');

        $moto = Moto::firstOrCreate(['product_id' => $product->id], ['condition_type' => 'nueva', 'km' => 0]);
        $old = $moto->condition_type;
        $moto->condition_type = in_array($old, self::USED, true) ? 'nueva' : 'usada';
        $moto->save();

        $label = $moto->condition_type === 'nueva' ? '0 km' : 'usada';
        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Pasó \"{$product->name}\" a {$label}", null, ['condition_type' => [$old, $moto->condition_type]]);

        return response()->json(['condition_type' => $moto->condition_type]);
    }

    private function validated(Request $request, ?Product $product = null): array
    {
        return $request->validate([
            'type' => [$product ? 'nullable' : 'required', 'in:moto,casco,repuesto'],
            'code' => ['nullable', 'string', 'max:60', 'unique:products,code'.($product ? ','.$product->id : '')],
            'name' => ['required', 'string', 'max:200'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'short_description' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'profit_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'final_price' => ['required', 'numeric', 'min:0'],
            'offer_price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'in:ARS,USD'],
            'price_visible' => ['boolean'],
            'availability' => ['nullable', 'in:disponible,reservado,vendido,consultar'],
            'featured' => ['boolean'],
            'is_new' => ['boolean'],
            'is_offer' => ['boolean'],
            'active' => ['boolean'],
            'meta_title' => ['nullable', 'string', 'max:160'],
            'meta_description' => ['nullable', 'string', 'max:255'],
            'detail' => ['nullable', 'array'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
            'specs' => ['nullable', 'array'],
        ], [
            'code.unique' => 'Ya existe otro producto con ese código.',
        ]);
    }

    /** @return array{0:array,1:array,2:?array,3:array} */
    private function split(array $data): array
    {
        $detail = $data['detail'] ?? [];
        $tagIds = array_key_exists('tag_ids', $data) ? ($data['tag_ids'] ?? []) : null;
        $specs = $data['specs'] ?? [];
        unset($data['detail'], $data['tag_ids'], $data['specs']);

        if (isset($data['cost_price'], $data['profit_percent']) && $data['cost_price'] > 0) {
            $data['profit_amount'] = round($data['cost_price'] * $data['profit_percent'] / 100, 2);
        }

        return [$data, $detail, $tagIds, $specs];
    }

    private function syncDetail(Product $product, array $detail): ?\Illuminate\Database\Eloquent\Model
    {
        if ($detail === []) {
            return null;
        }

        $model = match ($product->type) {
            'moto' => Moto::firstOrNew(['product_id' => $product->id]),
            'casco' => Casco::firstOrNew(['product_id' => $product->id]),
            'repuesto' => Repuesto::firstOrNew(['product_id' => $product->id]),
            default => null,
        };

        if (! $model) {
            return null;
        }

        $fillable = array_diff($model->getFillable(), ['product_id']);
        $model->fill(array_intersect_key($detail, array_flip($fillable)));
        $model->save();

        return $model;
    }

    private function syncSpecs(Product $product, array $specs): void
    {
        foreach ($specs as $featureId => $value) {
            if ($value === null || $value === '') {
                FeatureValue::where('product_id', $product->id)->where('feature_id', $featureId)->delete();

                continue;
            }

            FeatureValue::updateOrCreate(
                ['product_id' => $product->id, 'feature_id' => $featureId],
                is_numeric($value) ? ['value_number' => $value, 'value_text' => null] : ['value_text' => $value, 'value_number' => null]
            );
        }
    }

    /** Próximo código correlativo del tipo: MOTO-0001, CASCO-0001, REP-0001. */
    private function nextCode(string $type): string
    {
        $prefix = ['moto' => 'MOTO', 'casco' => 'CASCO', 'repuesto' => 'REP'][$type] ?? 'PROD';
        $max = 0;

        Product::withTrashed()->where('code', 'like', "{$prefix}-%")->pluck('code')->each(function ($code) use (&$max, $prefix) {
            $number = substr($code, strlen($prefix) + 1);
            if (ctype_digit($number)) {
                $max = max($max, (int) $number);
            }
        });

        return sprintf('%s-%04d', $prefix, $max + 1);
    }

    private function slugFor(string $name): string
    {
        return Str::slug($name).'-'.Str::lower(Str::random(4));
    }

    private function copyPublicFile(string $url, string $folder): ?string
    {
        $relative = Str::after($url, '/storage/');
        if (! Storage::disk('public')->exists($relative)) {
            return null;
        }

        $newRelative = 'products/'.$folder.'/'.Str::random(32).'.'.pathinfo($relative, PATHINFO_EXTENSION);
        Storage::disk('public')->copy($relative, $newRelative);

        return Storage::disk('public')->url($newRelative);
    }
}
