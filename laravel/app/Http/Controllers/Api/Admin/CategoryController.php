<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = Category::withCount('products')->with('parent:id,name');

        if ($group = $request->query('grupo')) {
            $query->where('group', $group);
        }

        return $query->orderBy('group')->orderBy('sort_order')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['name']);

        $category = Category::create($data);
        ActivityLog::log($request->user()->id, 'crear', 'Category', $category->id, "Creó la categoría \"{$category->name}\"");

        return response()->json($category->loadCount('products')->load('parent:id,name'), 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $this->validated($request, $category);
        if ($data['name'] !== $category->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $category->id);
        }

        $category->update($data);
        ActivityLog::log($request->user()->id, 'editar', 'Category', $category->id, "Editó la categoría \"{$category->name}\"", null, ActivityLog::diff($category));

        return $category->loadCount('products')->load('parent:id,name');
    }

    /** Sube o quita (remove=1) la imagen de la categoría. */
    public function image(Request $request, Category $category)
    {
        if (! $request->boolean('remove')) {
            $request->validate(['image' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:6144']]);
        }

        $this->deleteImage($category);
        $category->update([
            'image_path' => $request->boolean('remove')
                ? null
                : Storage::disk('public')->url($request->file('image')->store('categories', 'public')),
        ]);

        ActivityLog::log($request->user()->id, 'editar', 'Category', $category->id, "Cambió la imagen de la categoría \"{$category->name}\"");

        return $category->loadCount('products')->load('parent:id,name');
    }

    /**
     * Elimina la categoría. Si tiene productos hay que confirmarlo (force=1) y
     * elegir a dónde pasan: move_to = otra categoría del mismo grupo, o vacío
     * para dejarlos sin categoría. Los productos nunca se borran.
     */
    public function destroy(Request $request, Category $category)
    {
        $data = $request->validate([
            'force' => ['nullable', 'boolean'],
            'move_to' => ['nullable', 'integer', 'exists:categories,id'],
        ]);

        $count = $category->products()->withTrashed()->count();
        if ($count > 0 && ! $request->boolean('force')) {
            return response()->json([
                'message' => "La categoría tiene {$count} producto(s). Confirmá a dónde pasan antes de eliminarla.",
                'products_count' => $count,
            ], 409);
        }

        $target = null;
        if (! empty($data['move_to'])) {
            $target = Category::find($data['move_to']);
            abort_if($target->id === $category->id, 422, 'Elegí una categoría distinta a la que vas a eliminar.');
            abort_if($target->group !== $category->group, 422, 'La categoría de destino tiene que ser de la misma sección.');
        }

        DB::transaction(function () use ($category, $target) {
            $category->products()->withTrashed()->update(['category_id' => $target?->id]);
            // Las subcategorías pasan a ser principales.
            $category->children()->update(['parent_id' => null]);
            $this->deleteImage($category);
            $category->delete();
        });

        $moved = $count > 0 ? ($target ? " y pasó {$count} producto(s) a \"{$target->name}\"" : " y dejó {$count} producto(s) sin categoría") : '';
        ActivityLog::log($request->user()->id, 'eliminar', 'Category', $category->id, "Eliminó la categoría \"{$category->name}\"{$moved}");

        return response()->json(['ok' => true, 'moved' => $count, 'target' => $target?->name]);
    }

    private function validated(Request $request, ?Category $category = null): array
    {
        $data = $request->validate([
            'group' => ['required', 'in:moto,casco,repuesto'],
            'name' => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'exists:categories,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'active' => ['boolean'],
        ]);

        abort_if($category && (int) ($data['parent_id'] ?? 0) === $category->id, 422, 'Una categoría no puede ser su propia madre.');
        $data['sort_order'] ??= 0;

        return $data;
    }

    private function deleteImage(Category $category): void
    {
        if ($category->image_path && Str::contains($category->image_path, '/storage/categories/')) {
            Storage::disk('public')->delete(Str::after($category->image_path, '/storage/'));
        }
    }

    private function uniqueSlug(string $name, ?int $ignore = null): string
    {
        $base = Str::slug($name) ?: 'categoria';
        $slug = $base;
        $i = 2;
        while (Category::where('slug', $slug)->when($ignore, fn ($q) => $q->where('id', '!=', $ignore))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
