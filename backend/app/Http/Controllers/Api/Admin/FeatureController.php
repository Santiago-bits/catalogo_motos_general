<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Feature;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FeatureController extends Controller
{
    public function index()
    {
        return Feature::orderBy('sort_order')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'unit' => ['nullable', 'string', 'max:20'],
            'value_type' => ['required', 'in:text,number'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $data['slug'] = Str::slug($data['name']);

        $feature = Feature::create($data);
        ActivityLog::log($request->user()->id, 'crear', 'Feature', $feature->id, "Creó la característica \"{$feature->name}\"");

        return $feature;
    }

    public function update(Request $request, Feature $feature)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'unit' => ['nullable', 'string', 'max:20'],
            'value_type' => ['required', 'in:text,number'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $data['slug'] = Str::slug($data['name']);
        $feature->update($data);
        ActivityLog::log($request->user()->id, 'editar', 'Feature', $feature->id, "Editó la característica \"{$feature->name}\"", null, ActivityLog::diff($feature));

        return $feature;
    }

    public function destroy(Request $request, Feature $feature)
    {
        ActivityLog::log($request->user()->id, 'eliminar', 'Feature', $feature->id, "Eliminó la característica \"{$feature->name}\"");
        $feature->delete();

        return response()->json(['ok' => true]);
    }
}
