<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index()
    {
        return Service::orderBy('sort_order')->orderBy('title')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['title']);

        $service = Service::create($data);
        ActivityLog::log($request->user()->id, 'crear', 'Service', $service->id, "Creó el servicio \"{$service->title}\"");

        return response()->json($service, 201);
    }

    public function update(Request $request, Service $service)
    {
        $data = $this->validated($request);
        if ($data['title'] !== $service->title) {
            $data['slug'] = $this->uniqueSlug($data['title'], $service->id);
        }

        $service->update($data);
        ActivityLog::log($request->user()->id, 'editar', 'Service', $service->id, "Editó el servicio \"{$service->title}\"", null, ActivityLog::diff($service));

        return $service;
    }

    /** Sube o quita (remove=1) la imagen del servicio. */
    public function image(Request $request, Service $service)
    {
        $this->deleteImage($service);

        if ($request->boolean('remove')) {
            $service->update(['image_path' => null]);
        } else {
            $request->validate(['image' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:6144']]);
            $service->update(['image_path' => Storage::disk('public')->url($request->file('image')->store('services', 'public'))]);
        }

        ActivityLog::log($request->user()->id, 'editar', 'Service', $service->id, "Cambió la imagen de \"{$service->title}\"");

        return $service;
    }

    public function destroy(Request $request, Service $service)
    {
        $this->deleteImage($service);
        ActivityLog::log($request->user()->id, 'eliminar', 'Service', $service->id, "Eliminó el servicio \"{$service->title}\"");
        $service->delete();

        return response()->json(['ok' => true]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'icon' => ['nullable', 'string', 'max:60'],
            'summary' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'active' => ['boolean'],
        ]);
        $data['sort_order'] ??= 0;

        return $data;
    }

    private function uniqueSlug(string $title, ?int $ignore = null): string
    {
        $base = Str::slug($title) ?: 'servicio';
        $slug = $base;
        $i = 2;
        while (Service::where('slug', $slug)->when($ignore, fn ($q) => $q->where('id', '!=', $ignore))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    private function deleteImage(Service $service): void
    {
        if ($service->image_path && Str::contains($service->image_path, '/storage/services/')) {
            Storage::disk('public')->delete(Str::after($service->image_path, '/storage/'));
        }
    }
}
