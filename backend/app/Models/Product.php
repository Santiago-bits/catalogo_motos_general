<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'type', 'code', 'name', 'slug', 'brand_id', 'category_id',
        'short_description', 'description',
        'cost_price', 'profit_percent', 'profit_amount', 'final_price', 'offer_price',
        'currency', 'price_visible', 'price_updated_at',
        'availability', 'stock_qty', 'stock_min', 'featured', 'is_new', 'is_offer',
        'meta_title', 'meta_description', 'og_image',
        'views', 'inquiries_count', 'active', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'price_visible' => 'boolean',
        'featured' => 'boolean',
        'is_new' => 'boolean',
        'is_offer' => 'boolean',
        'active' => 'boolean',
        'price_updated_at' => 'datetime',
        'cost_price' => 'decimal:2',
        'profit_percent' => 'decimal:3',
        'profit_amount' => 'decimal:2',
        'final_price' => 'decimal:2',
        'offer_price' => 'decimal:2',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function codes(): HasMany
    {
        return $this->hasMany(RepuestoCode::class)->orderBy('id');
    }

    public function compatibilities(): HasMany
    {
        return $this->hasMany(RepuestoCompatibility::class, 'repuesto_id')->orderBy('id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProductDocument::class)->latest('id');
    }

    public function videos(): HasMany
    {
        return $this->hasMany(ProductVideo::class)->orderBy('sort_order')->orderBy('id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function mainImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->where('is_main', true);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'product_tags');
    }

    public function featureValues(): HasMany
    {
        return $this->hasMany(FeatureValue::class);
    }

    public function moto(): HasOne
    {
        return $this->hasOne(Moto::class);
    }

    public function casco(): HasOne
    {
        return $this->hasOne(Casco::class);
    }

    public function repuesto(): HasOne
    {
        return $this->hasOne(Repuesto::class);
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(Inquiry::class);
    }

    public function priceHistories(): HasMany
    {
        return $this->hasMany(PriceHistory::class)->latest('id');
    }

    public function compatibleRepuestos(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'moto_repuestos', 'moto_id', 'repuesto_id')
            ->withPivot(['note', 'recommended']);
    }

    public function compatibleMotos(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'moto_repuestos', 'repuesto_id', 'moto_id')
            ->withPivot(['note', 'recommended']);
    }

    public function scopeType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    public function scopeFeatured($query)
    {
        return $query->where('featured', true);
    }

    public function displayPrice(): ?string
    {
        return $this->is_offer && $this->offer_price ? $this->offer_price : $this->final_price;
    }

    protected static function booted(): void
    {
        static::updating(function (Product $product) {
            if ($product->isDirty('final_price')) {
                PriceHistory::create([
                    'product_id' => $product->id,
                    'old_price' => $product->getOriginal('final_price'),
                    'new_price' => $product->final_price,
                    'currency' => $product->currency,
                    'changed_by' => $product->updated_by,
                ]);
                $product->price_updated_at = now();
            }
        });
    }
}
