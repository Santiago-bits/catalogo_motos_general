<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Service;

class ServiceController extends Controller
{
    public function index()
    {
        return Service::where('active', true)->orderBy('sort_order')->get();
    }

    public function show(string $slug)
    {
        return Service::where('active', true)->where('slug', $slug)->firstOrFail();
    }
}
