<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = Category::query()->where('active', true);

        if ($group = $request->query('grupo')) {
            $query->where('group', $group);
        }

        return $query->orderBy('sort_order')->orderBy('name')
            ->get(['id', 'group', 'name', 'slug', 'image_path', 'parent_id']);
    }
}
