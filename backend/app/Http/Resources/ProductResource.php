<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'code' => $this->code,
            'name' => $this->name,
            'slug' => $this->slug,
            'brand' => $this->whenLoaded('brand', fn () => [
                'id' => $this->brand?->id,
                'name' => $this->brand?->name,
                'slug' => $this->brand?->slug,
            ]),
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'slug' => $this->category?->slug,
            ]),
            'short_description' => $this->short_description,
            'description' => $this->description,
            'price' => [
                'final' => (float) $this->final_price,
                'offer' => $this->offer_price ? (float) $this->offer_price : null,
                'currency' => $this->currency,
                'visible' => (bool) $this->price_visible,
                'is_offer' => (bool) $this->is_offer,
            ],
            'availability' => $this->availability,
            'featured' => (bool) $this->featured,
            'is_new' => (bool) $this->is_new,
            'images' => $this->when(
                $this->relationLoaded('images') || $this->relationLoaded('mainImage'),
                fn () => ($this->relationLoaded('images') ? $this->images : collect([$this->mainImage])->filter())
                    ->values()
                    ->map(fn ($img) => [
                        'id' => $img->id,
                        'path' => $img->path,
                        'thumb_path' => $img->thumb_path,
                        'alt' => $img->alt,
                        'is_main' => (bool) $img->is_main,
                    ])
            ),
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->map(fn ($tag) => ['id' => $tag->id, 'name' => $tag->name, 'slug' => $tag->slug])),
            'specs' => $this->whenLoaded('featureValues', fn () => $this->featureValues->map(fn ($fv) => [
                'feature' => $fv->feature?->name,
                'unit' => $fv->feature?->unit,
                'value' => $fv->value_number ?? $fv->value_text,
            ])),
            'moto' => $this->whenLoaded('moto', fn () => $this->moto),
            'casco' => $this->whenLoaded('casco', fn () => $this->casco),
            'repuesto' => $this->whenLoaded('repuesto', fn () => $this->repuesto),
            'public_documents' => $this->when(! $this instanceof AdminProductResource && $this->relationLoaded('documents'), fn () => $this->documents->map(fn ($doc) => [
                'title' => $doc->title,
                'kind' => $doc->kind,
                'url' => \Illuminate\Support\Facades\Storage::disk('public')->url($doc->path),
            ])),
            'public_videos' => $this->when(! $this instanceof AdminProductResource && $this->relationLoaded('videos'), fn () => $this->videos->map(fn ($video) => [
                'title' => $video->title,
                'url' => $video->path ? \Illuminate\Support\Facades\Storage::disk('public')->url($video->path) : $video->url,
                'is_file' => $video->path !== null,
            ])),
            'views' => $this->views,
            'created_at' => $this->created_at,
        ];
    }
}
