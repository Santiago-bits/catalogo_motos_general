<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;

class CompareController extends Controller
{
    public function index(Request $request)
    {
        $ids = array_filter(array_map('intval', explode(',', (string) $request->query('ids', ''))));

        if ($ids === []) {
            return ProductResource::collection(collect());
        }

        $products = Product::whereIn('id', $ids)
            ->active()
            ->with(['brand', 'category', 'images', 'featureValues.feature', 'moto', 'casco', 'repuesto'])
            ->get();

        return ProductResource::collection($products);
    }
}
