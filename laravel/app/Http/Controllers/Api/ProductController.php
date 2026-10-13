<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $type = (string) $request->route('type');

        $query = Product::query()
            ->type($type)
            ->active()
            ->with(['brand', 'category', 'mainImage', 'moto']);

        if ($brand = $request->query('marca')) {
            $query->whereHas('brand', fn ($q) => $q->where('slug', $brand));
        }

        if ($category = $request->query('categoria')) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $category));
        }

        if (in_array($condition = $request->query('condicion'), ['nueva', 'usada'], true)) {
            $query->whereHas('moto', fn ($q) => $condition === 'usada'
                ? $q->whereIn('condition_type', ['usada', 'reacondicionada'])
                : $q->where('condition_type', 'nueva'));
        }

        if ($minPrice = $request->query('precio_min')) {
            $query->where('final_price', '>=', $minPrice);
        }

        if ($maxPrice = $request->query('precio_max')) {
            $query->where('final_price', '<=', $maxPrice);
        }

        if ($request->boolean('ofertas')) {
            $query->where('is_offer', true);
        }

        $sort = $request->query('orden', 'recientes');
        match ($sort) {
            'precio_asc' => $query->orderBy('final_price', 'asc'),
            'precio_desc' => $query->orderBy('final_price', 'desc'),
            'nombre' => $query->orderBy('name'),
            default => $query->orderByDesc('created_at'),
        };

        $perPage = min((int) $request->query('por_pagina', 12), 48);

        return ProductResource::collection($query->paginate($perPage));
    }

    public function show(Request $request)
    {
        $type = (string) $request->route('type');
        $slug = (string) $request->route('slug');

        $product = Product::query()
            ->type($type)
            ->active()
            ->where('slug', $slug)
            ->with(['brand', 'category', 'images', 'tags', 'moto', 'casco', 'repuesto.compatibility.brand', 'featureValues.feature', 'videos', 'documents' => fn ($q) => $q->where('is_public', true)])
            ->firstOrFail();

        $product->increment('views');

        return new ProductResource($product);
    }

    public function featured()
    {
        $products = Product::query()
            ->active()
            ->featured()
            ->with(['brand', 'category', 'mainImage', 'moto'])
            ->orderByDesc('created_at')
            ->limit(8)
            ->get();

        return ProductResource::collection($products);
    }
}
