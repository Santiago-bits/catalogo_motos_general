<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index(Request $request)
    {
        return Brand::query()
            ->where('active', true)
            ->inGroup($request->query('grupo'))
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'logo_path']);
    }
}
