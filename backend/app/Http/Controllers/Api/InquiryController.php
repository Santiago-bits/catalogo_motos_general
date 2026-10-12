<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\Product;
use Illuminate\Http\Request;

class InquiryController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['nullable', 'exists:products,id'],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'message' => ['nullable', 'string', 'max:2000'],
            'source' => ['nullable', 'string', 'max:60'],
        ]);

        $inquiry = Inquiry::create($data);

        if (! empty($data['product_id'])) {
            Product::whereKey($data['product_id'])->increment('inquiries_count');
        }

        return response()->json(['ok' => true, 'id' => $inquiry->id], 201);
    }
}
