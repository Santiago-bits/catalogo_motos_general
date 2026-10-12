<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TagController extends Controller
{
    public const COLORS = ['red', 'dark', 'green', 'blue', 'orange', 'gray'];

    public function index()
    {
        return Tag::withCount('products')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = Str::slug($data['name']).'-'.Str::lower(Str::random(3));

        $tag = Tag::create($data);
        ActivityLog::log($request->user()->id, 'crear', 'Tag', $tag->id, "Creó la etiqueta \"{$tag->name}\"");

        return response()->json($tag->loadCount('products'), 201);
    }

    public function update(Request $request, Tag $tag)
    {
        $tag->update($this->validated($request, $tag));
        ActivityLog::log($request->user()->id, 'editar', 'Tag', $tag->id, "Editó la etiqueta \"{$tag->name}\"", null, ActivityLog::diff($tag));

        return $tag->loadCount('products');
    }

    public function destroy(Request $request, Tag $tag)
    {
        ActivityLog::log($request->user()->id, 'eliminar', 'Tag', $tag->id, "Eliminó la etiqueta \"{$tag->name}\"");
        $tag->products()->detach();
        $tag->delete();

        return response()->json(['ok' => true]);
    }

    private function validated(Request $request, ?Tag $tag = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('tags', 'name')->ignore($tag?->id)],
            'color' => ['nullable', 'in:'.implode(',', self::COLORS)],
        ], ['name.unique' => 'Ya existe una etiqueta con ese nombre.']);
        $data['color'] ??= 'red';

        return $data;
    }
}
