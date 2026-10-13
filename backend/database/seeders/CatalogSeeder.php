<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Casco;
use App\Models\Category;
use App\Models\Feature;
use App\Models\FeatureValue;
use App\Models\Moto;
use App\Models\Product;
use App\Models\Repuesto;
use App\Models\Service;
use App\Models\Setting;
use App\Models\Tag;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $motoBrands = collect(['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'Bajaj', 'Motomel'])
            ->mapWithKeys(fn ($name) => [$name => Brand::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'active' => true]
            )]);

        $helmetBrands = collect(['Shoei', 'LS2', 'AGV', 'Peels'])
            ->mapWithKeys(fn ($name) => [$name => Brand::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'active' => true]
            )]);

        $motoCategories = collect(['Naked', 'Scooter', 'Enduro', 'Cruiser'])
            ->mapWithKeys(fn ($name) => [$name => Category::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['group' => 'moto', 'name' => $name, 'active' => true]
            )]);

        $helmetCategories = collect(['Integral', 'Abierto', 'Modular', 'Cross'])
            ->mapWithKeys(fn ($name) => [$name => Category::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['group' => 'casco', 'name' => $name, 'active' => true]
            )]);

        $partCategories = collect(['Motor', 'Frenos', 'Suspensión', 'Eléctrico', 'Transmisión'])
            ->mapWithKeys(fn ($name) => [$name => Category::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['group' => 'repuesto', 'name' => $name, 'active' => true]
            )]);

        $motos = [
            ['Honda', 'Naked', 'CB 250 Twister', 2025, 250, 21, 'nafta', 'manual', 1350000],
            ['Yamaha', 'Naked', 'MT-03', 2025, 321, 42, 'nafta', 'manual', 2450000],
            ['Kawasaki', 'Cruiser', 'Vulcan S 650', 2024, 649, 61, 'nafta', 'manual', 4200000],
            ['Suzuki', 'Enduro', 'DR 650', 2024, 644, 46, 'nafta', 'manual', 3800000],
            ['Bajaj', 'Scooter', 'Rouser NS 200', 2025, 200, 24, 'nafta', 'manual', 1650000],
            ['Motomel', 'Scooter', 'Blitz 110', 2025, 110, 8, 'nafta', 'automatica', 780000],
        ];

        foreach ($motos as [$brand, $cat, $model, $year, $cc, $hp, $fuel, $trans, $price]) {
            $name = "{$brand} {$model}";
            $product = Product::firstOrCreate(
                ['slug' => Str::slug($name)],
                [
                    'type' => 'moto',
                    'code' => 'MOTO-'.strtoupper(Str::random(6)),
                    'name' => $name,
                    'brand_id' => $motoBrands[$brand]->id,
                    'category_id' => $motoCategories[$cat]->id,
                    'short_description' => "{$model} {$year} - {$cc}cc",
                    'description' => "Moto {$name} modelo {$year}, motor de {$cc}cc y {$hp}hp. Ideal para uso urbano y de ruta.",
                    'final_price' => $price,
                    'currency' => 'ARS',
                    'availability' => 'disponible',
                    'featured' => true,
                    'is_new' => true,
                    'active' => true,
                ]
            );

            Moto::firstOrCreate(
                ['product_id' => $product->id],
                [
                    'model' => $model,
                    'year' => $year,
                    'condition_type' => 'nueva',
                    'km' => 0,
                    'fuel_type' => $fuel,
                    'displacement_cc' => $cc,
                    'power_hp' => $hp,
                    'transmission' => $trans,
                    'cooling' => 'aire',
                    'starter' => 'electrico',
                ]
            );
        }

        $cascos = [
            ['Shoei', 'Integral', 'RF-1400', 'M', 320000],
            ['LS2', 'Modular', 'FF900 Valiant', 'L', 210000],
            ['AGV', 'Integral', 'K1', 'M', 180000],
            ['Peels', 'Abierto', 'Fusion', 'S', 65000],
        ];

        foreach ($cascos as [$brand, $type, $model, $size, $price]) {
            $name = "{$brand} {$model}";
            $product = Product::firstOrCreate(
                ['slug' => Str::slug($name)],
                [
                    'type' => 'casco',
                    'code' => 'CASCO-'.strtoupper(Str::random(6)),
                    'name' => $name,
                    'brand_id' => $helmetBrands[$brand]->id,
                    'category_id' => $helmetCategories[$type]->id,
                    'short_description' => "Casco {$type} talle {$size}",
                    'description' => "Casco {$name}, tipo {$type}, homologado y con certificación de seguridad vigente.",
                    'final_price' => $price,
                    'currency' => 'ARS',
                    'availability' => 'disponible',
                    'featured' => true,
                    'is_new' => true,
                    'active' => true,
                ]
            );

            Casco::firstOrCreate(
                ['product_id' => $product->id],
                [
                    'helmet_type' => Str::lower($type),
                    'size' => $size,
                    'certification' => 'DOT / ECE 22.06',
                    'material' => 'Policarbonato',
                    'weight_grams' => 1450,
                ]
            );
        }

        $repuestos = [
            ['Motor', 'Kit de arrastre', 'alternativo', 45000],
            ['Frenos', 'Juego de pastillas de freno delanteras', 'original', 18000],
            ['Suspensión', 'Amortiguador trasero', 'alternativo', 62000],
            ['Eléctrico', 'Batería 12V 9Ah', 'original', 38000],
            ['Transmisión', 'Cadena de transmisión 520', 'alternativo', 27000],
        ];

        foreach ($repuestos as [$cat, $name, $origin, $price]) {
            $product = Product::firstOrCreate(
                ['slug' => Str::slug($name.'-'.$cat)],
                [
                    'type' => 'repuesto',
                    'code' => 'REP-'.strtoupper(Str::random(6)),
                    'name' => $name,
                    'category_id' => $partCategories[$cat]->id,
                    'short_description' => "Repuesto de {$cat}",
                    'description' => "{$name}, compatible con múltiples modelos de motocicletas.",
                    'final_price' => $price,
                    'currency' => 'ARS',
                    'availability' => 'disponible',
                    'active' => true,
                ]
            );

            Repuesto::firstOrCreate(
                ['product_id' => $product->id],
                [
                    'origin' => $origin,
                    'unit' => 'unidad',
                ]
            );
        }

        // --- Etiquetas ---------------------------------------------------
        $tags = collect(['Más vendida', 'Oferta del mes', 'Recomendada', 'Últimas unidades'])
            ->mapWithKeys(fn ($name) => [$name => Tag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name]
            )]);

        Product::type('moto')->orderBy('id')->limit(2)->get()->each(
            fn ($p) => $p->tags()->syncWithoutDetaching([$tags['Más vendida']->id])
        );
        Product::type('moto')->orderBy('id')->skip(2)->limit(1)->get()->each(
            fn ($p) => $p->tags()->syncWithoutDetaching([$tags['Oferta del mes']->id])
        );

        // --- Características / specs --------------------------------------
        $tankFeature = Feature::firstOrCreate(
            ['slug' => 'tanque-litros'],
            ['name' => 'Tanque', 'unit' => 'L', 'value_type' => 'number', 'sort_order' => 1]
        );
        $absFeature = Feature::firstOrCreate(
            ['slug' => 'frenos-abs'],
            ['name' => 'Frenos ABS', 'value_type' => 'text', 'sort_order' => 2]
        );

        foreach (Product::type('moto')->get() as $index => $moto) {
            FeatureValue::updateOrCreate(
                ['product_id' => $moto->id, 'feature_id' => $tankFeature->id],
                ['value_number' => 12 + $index, 'value_text' => null]
            );
            FeatureValue::updateOrCreate(
                ['product_id' => $moto->id, 'feature_id' => $absFeature->id],
                ['value_text' => $index % 2 === 0 ? 'Sí' : 'No', 'value_number' => null]
            );
        }

        // --- Servicios institucionales -------------------------------------
        $services = [
            ['Financiación', 'money', 'Planes de financiación propios y con tarjetas.', 'Ofrecemos planes de financiación a tasa fija, adelantos flexibles y acuerdos con las principales tarjetas de crédito para que puedas acceder a tu moto sin complicaciones.'],
            ['Service Oficial', 'wrench', 'Mantenimiento y service para todas las marcas.', 'Contamos con taller propio y técnicos capacitados para el mantenimiento preventivo y correctivo de tu moto, usando repuestos originales y alternativos de calidad.'],
            ['Entrega a domicilio', 'truck', 'Recibí tu moto o repuesto en la puerta de tu casa.', 'Coordinamos la entrega de motos, cascos y repuestos en todo el país a través de transportes de confianza.'],
            ['Toma de usados', 'refresh', 'Entregá tu moto usada como parte de pago.', 'Tasamos tu moto usada al instante y la tomamos como parte de pago por una unidad 0km o usada seleccionada.'],
        ];

        foreach ($services as $order => [$title, $icon, $summary, $description]) {
            Service::firstOrCreate(
                ['slug' => Str::slug($title)],
                [
                    'title' => $title,
                    'icon' => $icon,
                    'summary' => $summary,
                    'description' => $description,
                    'sort_order' => $order,
                    'active' => true,
                ]
            );
        }

        // --- Configuración del sitio ---------------------------------------
        Setting::set('contact_phone', '+54 9 11 5555-5555');
        Setting::set('contact_whatsapp', '5491155555555');
        Setting::set('contact_address', 'Av. Siempre Viva 123, Buenos Aires');
        Setting::set('currency_default', 'ARS');
    }
}
