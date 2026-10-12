<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BrandController extends Controller
{
    public function index()
    {
        return Brand::withCount('products')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['name']);

        $brand = Brand::create($data);
        ActivityLog::log($request->user()->id, 'crear', 'Brand', $brand->id, "Creó la marca \"{$brand->name}\"");

        return response()->json($brand->loadCount('products'), 201);
    }

    public function update(Request $request, Brand $brand)
    {
        $data = $this->validated($request, $brand);
        if ($data['name'] !== $brand->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $brand->id);
        }

        $brand->update($data);
        ActivityLog::log($request->user()->id, 'editar', 'Brand', $brand->id, "Editó la marca \"{$brand->name}\"", null, ActivityLog::diff($brand));

        return $brand->loadCount('products');
    }

    /** Sube o quita (remove=1) el logo de la marca. */
    public function logo(Request $request, Brand $brand)
    {
        $this->deleteLogo($brand);

        if ($request->boolean('remove')) {
            $brand->update(['logo_path' => null]);
        } else {
            $request->validate(['logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp,svg', 'max:2048']]);
            $brand->update(['logo_path' => Storage::disk('public')->url($request->file('logo')->store('brands', 'public'))]);
        }

        ActivityLog::log($request->user()->id, 'editar', 'Brand', $brand->id, "Cambió el logo de \"{$brand->name}\"");

        return $brand->loadCount('products');
    }

    public function destroy(Request $request, Brand $brand)
    {
        abort_if($brand->products()->exists(), 422, 'La marca tiene productos asociados. Reasignalos o desactivá la marca en lugar de eliminarla.');

        $this->deleteLogo($brand);
        ActivityLog::log($request->user()->id, 'eliminar', 'Brand', $brand->id, "Eliminó la marca \"{$brand->name}\"");
        $brand->delete();

        return response()->json(['ok' => true]);
    }

    private function validated(Request $request, ?Brand $brand = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('brands', 'name')->ignore($brand?->id)],
            'active' => ['boolean'],
        ], ['name.unique' => 'Ya existe una marca con ese nombre.']);
    }

    private function uniqueSlug(string $name, ?int $ignore = null): string
    {
        $base = Str::slug($name) ?: 'marca';
        $slug = $base;
        $i = 2;
        while (Brand::where('slug', $slug)->when($ignore, fn ($q) => $q->where('id', '!=', $ignore))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    private function deleteLogo(Brand $brand): void
    {
        if ($brand->logo_path && Str::contains($brand->logo_path, '/storage/brands/')) {
            Storage::disk('public')->delete(Str::after($brand->logo_path, '/storage/'));
        }
    }
}
