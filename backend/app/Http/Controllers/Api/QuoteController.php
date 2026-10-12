<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class QuoteController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'message' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $products = Product::whereIn('id', collect($data['items'])->pluck('product_id'))->get()->keyBy('id');

        $total = 0;
        $currency = 'ARS';
        $items = [];

        foreach ($data['items'] as $item) {
            $product = $products->get($item['product_id']);
            if (! $product) {
                continue;
            }

            $unitPrice = $product->is_offer && $product->offer_price ? $product->offer_price : $product->final_price;
            $total += $unitPrice * $item['quantity'];
            $currency = $product->currency;

            $items[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => $item['quantity'],
                'unit_price' => $unitPrice,
            ];

            $product->increment('inquiries_count');
        }

        $quote = Quote::create([
            'number' => 'COT-'.now()->format('ymd').'-'.strtoupper(Str::random(4)),
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'message' => $data['message'] ?? null,
            'total' => $total,
            'currency' => $currency,
        ]);

        $quote->items()->createMany($items);

        return response()->json(['ok' => true, 'number' => $quote->number], 201);
    }
}
