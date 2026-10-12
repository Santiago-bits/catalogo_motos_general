<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;

class BrandController extends Controller
{
    public function index()
    {
        return Brand::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'logo_path']);
    }
}
