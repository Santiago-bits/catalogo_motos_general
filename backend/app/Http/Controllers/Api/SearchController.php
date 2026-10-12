<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function index(Request $request)
    {
        $term = trim((string) $request->query('q', ''));

        if ($term === '') {
            return ProductResource::collection(collect());
        }

        $products = Product::query()
            ->active()
            ->where(function ($query) use ($term) {
                $query->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%")
                    ->orWhere('short_description', 'like', "%{$term}%");
            })
            ->with(['brand', 'category', 'mainImage', 'moto'])
            ->limit(24)
            ->get();

        return ProductResource::collection($products);
    }
}
