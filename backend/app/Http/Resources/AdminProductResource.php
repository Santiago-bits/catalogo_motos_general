<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Producto como lo ve el panel: lo público más costo, publicación,
 * quién lo editó por última vez, documentos y videos.
 */
class AdminProductResource extends ProductResource
{
    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'active' => (bool) $this->active,
            'stock_qty' => (int) $this->stock_qty,
            'stock_min' => (int) $this->stock_min,
            'cost_price' => $this->cost_price !== null ? (float) $this->cost_price : null,
            'profit_percent' => $this->profit_percent !== null ? (float) $this->profit_percent : null,
            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'updated_at' => $this->updated_at,
            'updated_by_name' => $this->whenLoaded('updater', fn () => $this->updater?->name),
            'documents' => $this->whenLoaded('documents', fn () => $this->documents->map(fn ($doc) => [
                'id' => $doc->id,
                'title' => $doc->title,
                'kind' => $doc->kind,
                'url' => Storage::disk('public')->url($doc->path),
                'original_name' => $doc->original_name,
                'size' => $doc->size,
                'is_public' => $doc->is_public,
                'created_at' => $doc->created_at,
            ])),
            'videos' => $this->whenLoaded('videos', fn () => $this->videos->map(fn ($video) => [
                'id' => $video->id,
                'title' => $video->title,
                'url' => $video->path ? Storage::disk('public')->url($video->path) : $video->url,
                'is_file' => $video->path !== null,
            ])),
        ]);
    }
}
