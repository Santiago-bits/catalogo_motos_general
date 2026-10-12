<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImageController extends Controller
{
    public function store(Request $request, Product $product)
    {
        $request->validate([
            'image' => ['required', 'image', 'max:5120'],
        ]);

        $path = $request->file('image')->store('products/'.$product->type, 'public');

        $image = $product->images()->create([
            'path' => Storage::disk('public')->url($path),
            'is_main' => ! $product->images()->exists(),
            'sort_order' => $product->images()->count(),
        ]);

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Subió una foto a \"{$product->name}\"");

        return response()->json($image, 201);
    }

    public function setMain(Product $product, ProductImage $image)
    {
        $product->images()->update(['is_main' => false]);
        $image->update(['is_main' => true]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Product $product, ProductImage $image)
    {
        $relative = Str::after($image->path, '/storage/');
        Storage::disk('public')->delete($relative);
        $image->delete();

        return response()->json(['ok' => true]);
    }
}
