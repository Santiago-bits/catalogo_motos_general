<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Moto;
use App\Models\Product;
use App\Models\Tag;
use App\Services\StockService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Carga motos comunes del mercado argentino con la ficha completa (sin fotos).
 * Se puede correr varias veces: si una moto con el mismo nombre ya existe, se saltea.
 *
 *   php artisan db:seed --class=MotosComunesSeeder
 *
 * Los precios son de referencia: revisalos antes de publicar.
 */
class MotosComunesSeeder extends Seeder
{
    /** Categorías de moto (en mayúsculas, como las que ya usa el panel). */
    private const CATEGORIES = ['MOTONETA', 'CALLE', 'TRAIL', 'SCOOTER', 'DEPORTIVA', 'CROSS', 'CUSTOM', 'ADVENTURE', 'ELÉCTRICA'];

    public function run(): void
    {
        $motos = $this->motos();
        $created = 0;

        foreach ($motos as $m) {
            if (Product::where('type', 'moto')->whereRaw('LOWER(name) = ?', [mb_strtolower($m['name'])])->exists()) {
                $this->command?->line("  · Ya existe, se saltea: {$m['name']}");

                continue;
            }

            DB::transaction(function () use ($m, &$created) {
                $product = Product::create([
                    'type' => 'moto',
                    'code' => $this->nextCode(),
                    'name' => $m['name'],
                    'slug' => Str::slug($m['name']).'-'.Str::lower(Str::random(4)),
                    'brand_id' => $this->brandId($m['brand']),
                    'category_id' => $this->categoryId($m['category']),
                    'short_description' => $m['short'],
                    'description' => $m['description'],
                    'final_price' => $m['price'],
                    'offer_price' => $m['offer'] ?? null,
                    'is_offer' => isset($m['offer']),
                    'currency' => 'ARS',
                    'price_visible' => true,
                    'price_updated_at' => now(),
                    'availability' => 'disponible',
                    'featured' => $m['featured'] ?? false,
                    'is_new' => $m['is_new'] ?? false,
                    'active' => true,
                    'stock_min' => $m['condition'] === 'nueva' ? 1 : 0,
                ]);

                Moto::create(['product_id' => $product->id] + $m['moto'] + ['condition_type' => $m['condition']]);

                if (! empty($m['tags'])) {
                    $product->tags()->sync(Tag::whereIn('name', $m['tags'])->pluck('id'));
                }

                StockService::move($product, 'ajuste', $m['stock'], 'stock_inicial', 'Carga inicial del catálogo');
                $created++;
            });

            $this->command?->info("  ✓ {$m['name']}");
        }

        $this->command?->info("Listo: {$created} moto(s) cargada(s).");
    }

    // ------------------------------------------------------------------

    private function brandId(string $name): int
    {
        $brand = Brand::whereRaw('UPPER(name) = ?', [mb_strtoupper($name)])->first();

        return $brand?->id ?? Brand::create([
            'name' => mb_strtoupper($name),
            'slug' => Str::slug($name),
            'active' => true,
        ])->id;
    }

    private function categoryId(string $name): int
    {
        $category = Category::where('group', 'moto')->whereRaw('UPPER(name) = ?', [mb_strtoupper($name)])->first();
        if ($category) {
            return $category->id;
        }

        $slug = Str::slug($name);
        if (Category::where('slug', $slug)->exists()) {
            $slug .= '-motos';
        }

        return Category::create([
            'group' => 'moto',
            'name' => mb_strtoupper($name),
            'slug' => $slug,
            'sort_order' => array_search(mb_strtoupper($name), self::CATEGORIES, true) ?: 0,
            'active' => true,
        ])->id;
    }

    private function nextCode(): string
    {
        $max = 0;
        Product::withTrashed()->where('code', 'like', 'MOTO-%')->pluck('code')->each(function ($code) use (&$max) {
            $n = substr($code, 5);
            if (ctype_digit($n)) {
                $max = max($max, (int) $n);
            }
        });

        return sprintf('MOTO-%04d', $max + 1);
    }

    // ------------------------------------------------------------------
    // Catálogo
    // ------------------------------------------------------------------

    private function motos(): array
    {
        $base = fn (array $o) => $o + ['fuel_type' => 'nafta', 'location' => 'Showroom'];

        return [
            // ================= MOTONETAS =================
            [
                'name' => 'Honda Wave 110 S', 'brand' => 'HONDA', 'category' => 'MOTONETA', 'condition' => 'nueva', 'stock' => 4,
                'price' => 2700000, 'featured' => true, 'tags' => ['Más vendida'],
                'short' => 'La motoneta más confiable para el día a día: bajo consumo y mantenimiento mínimo.',
                'description' => "La Honda Wave 110 S es la motoneta ideal para moverse por la ciudad todos los días. Su motor de 109 cc es reconocido por su durabilidad y por un consumo muy bajo, y la caja semiautomática de 4 marchas no necesita embrague, así que es muy fácil de manejar.\n\nTiene arranque eléctrico y a pedal, tablero analógico con indicador de combustible y portaequipaje trasero. Ideal para trabajo, delivery o para quien busca su primera moto.",
                'moto' => $base(['model' => 'Wave 110 S', 'year' => 2026, 'km' => 0, 'displacement_cc' => 109, 'cylinders' => 1, 'power_hp' => 8.4, 'torque_nm' => 8.7, 'transmission' => 'semiautomatica', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Tambor 130 mm', 'brakes_rear' => 'Tambor 110 mm', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 3.7, 'weight_kg' => 99, 'seat_height_mm' => 760, 'color' => 'Rojo', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Motomel Blitz 110 Tunning', 'brand' => 'MOTOMEL', 'category' => 'MOTONETA', 'condition' => 'nueva', 'stock' => 5,
                'price' => 1650000, 'tags' => ['Más vendida'],
                'short' => 'Económica, liviana y con llantas de aleación. La motoneta más elegida para empezar.',
                'description' => "La Motomel Blitz 110 Tunning combina precio accesible y equipamiento completo: llantas de aleación, freno delantero a disco y arranque eléctrico y a pedal.\n\nSu caja semiautomática de 4 velocidades la hace muy simple de manejar en el tránsito. Es liviana, gasta poco y tiene repuestos fáciles de conseguir en todo el país.",
                'moto' => $base(['model' => 'Blitz 110 Tunning', 'year' => 2026, 'km' => 0, 'displacement_cc' => 107, 'cylinders' => 1, 'power_hp' => 7, 'torque_nm' => 7.2, 'transmission' => 'semiautomatica', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 4, 'weight_kg' => 90, 'seat_height_mm' => 765, 'color' => 'Negro y rojo', 'warranty' => '12 meses de fábrica']),
            ],
            [
                'name' => 'Corven Energy 110', 'brand' => 'CORVEN', 'category' => 'MOTONETA', 'condition' => 'nueva', 'stock' => 3,
                'price' => 1550000,
                'short' => 'Motoneta práctica y económica, con caja semiautomática y bajo consumo.',
                'description' => "La Corven Energy 110 es una opción simple y económica para moverse todos los días. Motor de 107 cc, caja semiautomática de 4 marchas y arranque eléctrico y a pedal.\n\nTiene un asiento cómodo para dos personas, portaequipaje y un consumo muy bajo. Ideal para trámites, trabajo o estudio.",
                'moto' => $base(['model' => 'Energy 110', 'year' => 2026, 'km' => 0, 'displacement_cc' => 107, 'cylinders' => 1, 'power_hp' => 6.8, 'torque_nm' => 7, 'transmission' => 'semiautomatica', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Tambor', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 4, 'weight_kg' => 92, 'seat_height_mm' => 760, 'color' => 'Azul', 'warranty' => '12 meses de fábrica']),
            ],
            [
                'name' => 'Zanella ZB 110', 'brand' => 'ZANELLA', 'category' => 'MOTONETA', 'condition' => 'nueva', 'stock' => 3,
                'price' => 1600000,
                'short' => 'La clásica motoneta Zanella: sencilla, rendidora y fácil de mantener.',
                'description' => "La Zanella ZB 110 es una motoneta pensada para el uso diario. Motor de 107 cc con caja semiautomática de 4 marchas, arranque eléctrico y a pedal, y llantas de aleación.\n\nFrena con disco adelante y tambor atrás. Es liviana y ágil en la ciudad, con un consumo mínimo y repuestos accesibles.",
                'moto' => $base(['model' => 'ZB 110', 'year' => 2026, 'km' => 0, 'displacement_cc' => 107, 'cylinders' => 1, 'power_hp' => 7, 'torque_nm' => 7.1, 'transmission' => 'semiautomatica', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 4.2, 'weight_kg' => 93, 'seat_height_mm' => 770, 'color' => 'Gris', 'warranty' => '12 meses de fábrica']),
            ],

            // ================= SCOOTER =================
            [
                'name' => 'Honda Elite 125', 'brand' => 'HONDA', 'category' => 'SCOOTER', 'condition' => 'nueva', 'stock' => 2,
                'price' => 3600000, 'is_new' => true,
                'short' => 'Scooter automático, cómodo y con baulera bajo el asiento. Ideal para la ciudad.',
                'description' => "El Honda Elite 125 es un scooter automático pensado para moverse cómodo por la ciudad: no hay que hacer cambios, sólo acelerar y frenar.\n\nTiene frenado combinado (CBS), que frena las dos ruedas a la vez con una sola mano, baulera bajo el asiento, piso plano y luces LED. Motor de 124 cc con inyección electrónica, muy económico y silencioso.",
                'moto' => $base(['model' => 'Elite 125', 'year' => 2026, 'km' => 0, 'displacement_cc' => 124, 'cylinders' => 1, 'power_hp' => 9, 'torque_nm' => 9.7, 'transmission' => 'automatica', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco con frenado combinado (CBS)', 'brakes_rear' => 'Tambor con frenado combinado (CBS)', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 5.3, 'weight_kg' => 103, 'seat_height_mm' => 760, 'color' => 'Blanco', 'warranty' => '2 años de fábrica']),
            ],

            // ================= CALLE =================
            [
                'name' => 'Honda CB 125F', 'brand' => 'HONDA', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 3,
                'price' => 3900000,
                'short' => 'Moto de calle con caja de 5 marchas, liviana y muy económica. Perfecta como primera moto.',
                'description' => "La Honda CB 125F es una moto de calle simple y confiable, ideal para quien da el salto desde una motoneta. Motor de 124 cc con caja manual de 5 velocidades, arranque eléctrico y tablero digital con indicador de marcha.\n\nFreno a disco adelante, posición de manejo cómoda y un consumo muy bajo. Aguanta perfecto el uso diario en ciudad y alguna salida por ruta.",
                'moto' => $base(['model' => 'CB 125F', 'year' => 2026, 'km' => 0, 'displacement_cc' => 124, 'cylinders' => 1, 'power_hp' => 10.6, 'torque_nm' => 10.5, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 240 mm', 'brakes_rear' => 'Tambor 130 mm', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 11, 'weight_kg' => 117, 'seat_height_mm' => 789, 'color' => 'Negro', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Honda CB 190R', 'brand' => 'HONDA', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 2,
                'price' => 5600000, 'featured' => true, 'tags' => ['Recomendada'],
                'short' => 'Naked de 184 cc con frenos a disco en ambas ruedas, inyección y diseño agresivo.',
                'description' => "La Honda CB 190R es una naked con muy buena relación entre potencia, consumo y confiabilidad. Su motor de 184 cc con inyección electrónica entrega 15,4 HP y tiene caja de 5 marchas.\n\nFrena a disco en ambas ruedas, tiene horquilla delantera robusta, monoamortiguador trasero, tablero digital completo e iluminación LED. Una moto para la ciudad y para la ruta, con la garantía Honda.",
                'moto' => $base(['model' => 'CB 190R', 'year' => 2026, 'km' => 0, 'displacement_cc' => 184, 'cylinders' => 1, 'power_hp' => 15.4, 'torque_nm' => 15.8, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 276 mm', 'brakes_rear' => 'Disco 220 mm', 'suspension_front' => 'Horquilla telescópica 37 mm', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 15, 'weight_kg' => 139, 'seat_height_mm' => 790, 'color' => 'Gris mate', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Yamaha YBR 125Z', 'brand' => 'YAMAHA', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 3,
                'price' => 3950000,
                'short' => 'La clásica YBR: confiable, económica y con el respaldo Yamaha.',
                'description' => "La Yamaha YBR 125Z es una de las motos de calle más vendidas por su confiabilidad. Motor de 124 cc, caja de 5 velocidades y arranque eléctrico y a pedal.\n\nFreno a disco adelante, asiento cómodo para dos personas y un tanque de 13 litros que da mucha autonomía. Ideal para trabajo y uso diario.",
                'moto' => $base(['model' => 'YBR 125Z', 'year' => 2026, 'km' => 0, 'displacement_cc' => 124, 'cylinders' => 1, 'power_hp' => 10.1, 'torque_nm' => 10, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Disco 245 mm', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 13, 'weight_kg' => 125, 'seat_height_mm' => 785, 'color' => 'Azul', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Yamaha FZ-S 150 FI', 'brand' => 'YAMAHA', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 2,
                'price' => 5200000, 'featured' => true,
                'short' => 'Naked con inyección, cubiertas anchas y diseño deportivo. Ágil y muy estable.',
                'description' => "La Yamaha FZ-S 150 FI es una naked de estilo deportivo con motor de 149 cc e inyección electrónica, que la hace más eficiente y fácil de arrancar.\n\nTiene frenos a disco en ambas ruedas, cubiertas traseras anchas que le dan mucha estabilidad, monoamortiguador y tablero digital. Una moto cómoda para todos los días con una estética muy atractiva.",
                'moto' => $base(['model' => 'FZ-S 150 FI', 'year' => 2026, 'km' => 0, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 12.2, 'torque_nm' => 13.3, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 282 mm', 'brakes_rear' => 'Disco 220 mm', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 135, 'seat_height_mm' => 790, 'color' => 'Negro', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Keller Stratus 150', 'brand' => 'KELLER', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 3,
                'price' => 2300000,
                'short' => 'Moto de calle de 150 cc con muy buen equipamiento a un precio accesible.',
                'description' => "La Keller Stratus 150 ofrece la potencia de un motor de 149 cc a un precio muy competitivo. Caja de 5 velocidades, arranque eléctrico y llantas de aleación.\n\nFreno a disco adelante, tablero digital y asiento amplio para dos. Una opción económica para quien necesita más potencia que una 110.",
                'moto' => $base(['model' => 'Stratus 150', 'year' => 2026, 'km' => 0, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 11, 'torque_nm' => 10.8, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 13, 'weight_kg' => 120, 'seat_height_mm' => 780, 'color' => 'Rojo', 'warranty' => '12 meses de fábrica']),
            ],
            [
                'name' => 'Suzuki GN 125', 'brand' => 'SUZUKI', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 2,
                'price' => 3500000,
                'short' => 'Estilo clásico, motor probado y manejo muy cómodo. Un ícono de Suzuki.',
                'description' => "La Suzuki GN 125 es una moto de estilo clásico con un motor de 124 cc conocido por su resistencia. Caja de 5 marchas, arranque eléctrico y a pedal.\n\nPosición de manejo relajada, asiento escalonado, freno a disco adelante y una estética retro que nunca pasa de moda. Muy económica de mantener.",
                'moto' => $base(['model' => 'GN 125', 'year' => 2026, 'km' => 0, 'displacement_cc' => 124, 'cylinders' => 1, 'power_hp' => 11, 'torque_nm' => 9.8, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 10, 'weight_kg' => 113, 'seat_height_mm' => 735, 'color' => 'Negro', 'warranty' => '2 años de fábrica']),
            ],

            // ================= TRAIL =================
            [
                'name' => 'Honda XR 150L', 'brand' => 'HONDA', 'category' => 'TRAIL', 'condition' => 'nueva', 'stock' => 3,
                'price' => 4900000, 'featured' => true, 'tags' => ['Más vendida'],
                'short' => 'Trail para ciudad, ripio y campo. Robusta, alta y con suspensión de largo recorrido.',
                'description' => "La Honda XR 150L es una trail pensada para cualquier camino: asfalto, ripio o tierra. Motor de 149 cc con caja de 5 marchas y arranque eléctrico.\n\nTiene suspensiones de largo recorrido, rueda delantera de 19\", buena altura libre al piso y freno a disco adelante. Muy resistente y con el respaldo de Honda, ideal para trabajo rural o para salir de paseo.",
                'moto' => $base(['model' => 'XR 150L', 'year' => 2026, 'km' => 0, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 12.6, 'torque_nm' => 12.5, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 240 mm', 'brakes_rear' => 'Tambor 130 mm', 'suspension_front' => 'Horquilla telescópica 180 mm de recorrido', 'suspension_rear' => 'Monoamortiguador Pro-Link', 'fuel_capacity_l' => 12, 'weight_kg' => 129, 'seat_height_mm' => 825, 'color' => 'Rojo y blanco', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Yamaha XTZ 150', 'brand' => 'YAMAHA', 'category' => 'TRAIL', 'condition' => 'nueva', 'stock' => 2,
                'price' => 5700000,
                'short' => 'Trail Yamaha con inyección, cómoda y confiable para todo terreno.',
                'description' => "La Yamaha XTZ 150 es una trail versátil con motor de 149 cc e inyección electrónica. Caja de 5 marchas, arranque eléctrico y tablero digital.\n\nSuspensión de largo recorrido, rueda delantera de 19\", freno a disco adelante y posición de manejo erguida y cómoda. Rinde igual de bien en la ciudad que en caminos de tierra.",
                'moto' => $base(['model' => 'XTZ 150', 'year' => 2026, 'km' => 0, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 12.2, 'torque_nm' => 12.8, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 245 mm', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 128, 'seat_height_mm' => 840, 'color' => 'Blanco', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Motomel Skua 150', 'brand' => 'MOTOMEL', 'category' => 'TRAIL', 'condition' => 'nueva', 'stock' => 4,
                'price' => 2650000, 'offer' => 2490000, 'tags' => ['Oferta del mes'],
                'short' => 'La trail más vendida del país: económica, alta y lista para el ripio.',
                'description' => "La Motomel Skua 150 es una trail accesible y muy elegida por su versatilidad. Motor de 149 cc, caja de 5 velocidades y arranque eléctrico.\n\nSuspensión de buen recorrido, rueda delantera de 19\", freno a disco adelante y guardabarros altos. Ideal para la ciudad, el ripio y el campo, con un costo de mantenimiento muy bajo.",
                'moto' => $base(['model' => 'Skua 150', 'year' => 2026, 'km' => 0, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 11.5, 'torque_nm' => 11, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 122, 'seat_height_mm' => 830, 'color' => 'Rojo', 'warranty' => '12 meses de fábrica']),
            ],
            [
                'name' => 'Corven Triax 150', 'brand' => 'CORVEN', 'category' => 'TRAIL', 'condition' => 'nueva', 'stock' => 2,
                'price' => 2450000,
                'short' => 'Trail económica de 150 cc, cómoda para la ciudad y los caminos de tierra.',
                'description' => "La Corven Triax 150 es una trail de buen precio con motor de 149 cc y caja de 5 marchas. Arranque eléctrico, freno a disco adelante y suspensión de largo recorrido.\n\nSu altura y su rueda delantera de 19\" la hacen ideal para calles en mal estado, ripio y caminos rurales.",
                'moto' => $base(['model' => 'Triax 150', 'year' => 2026, 'km' => 0, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 11, 'torque_nm' => 10.5, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 125, 'seat_height_mm' => 830, 'color' => 'Negro y verde', 'warranty' => '12 meses de fábrica']),
            ],

            // ================= DEPORTIVA =================
            [
                'name' => 'Bajaj Rouser NS 200', 'brand' => 'BAJAJ', 'category' => 'DEPORTIVA', 'condition' => 'nueva', 'stock' => 2,
                'price' => 5800000, 'featured' => true, 'is_new' => true,
                'short' => 'Naked deportiva de 200 cc refrigerada por líquido, 6 marchas y frenos a disco.',
                'description' => "La Bajaj Rouser NS 200 es una naked deportiva con mucha potencia para su cilindrada: 199,5 cc, refrigeración líquida, inyección y 23,5 HP.\n\nTiene caja de 6 velocidades, frenos a disco en ambas ruedas, chasis perimetral, monoamortiguador trasero y tablero digital. Una de las motos con mejor relación precio/prestaciones del mercado.",
                'moto' => $base(['model' => 'Rouser NS 200', 'year' => 2026, 'km' => 0, 'displacement_cc' => 199, 'cylinders' => 1, 'power_hp' => 23.5, 'torque_nm' => 18.3, 'transmission' => 'manual', 'cooling' => 'liquido', 'starter' => 'electrico', 'brakes_front' => 'Disco 300 mm', 'brakes_rear' => 'Disco 230 mm', 'suspension_front' => 'Horquilla telescópica 37 mm', 'suspension_rear' => 'Monoamortiguador Nitrox', 'fuel_capacity_l' => 12, 'weight_kg' => 156, 'seat_height_mm' => 805, 'color' => 'Negro', 'warranty' => '2 años de fábrica']),
            ],

            [
                'name' => 'TVS Apache RTR 200 4V', 'brand' => 'TVS', 'category' => 'DEPORTIVA', 'condition' => 'nueva', 'stock' => 2,
                'price' => 4600000,
                'short' => 'Naked deportiva de 200 cc con 4 válvulas, ABS de un canal y modos de manejo.',
                'description' => "La TVS Apache RTR 200 4V viene del mundo de las carreras: motor de 197,75 cc con 4 válvulas, refrigerado por aceite, que entrega 20,5 HP.\n\nTiene frenos a disco en ambas ruedas con ABS en la delantera, caja de 5 marchas, tablero digital con conectividad y monoamortiguador trasero. Ágil, potente y con gran equipamiento para su precio.",
                'moto' => $base(['model' => 'Apache RTR 200 4V', 'year' => 2026, 'km' => 0, 'displacement_cc' => 198, 'cylinders' => 1, 'power_hp' => 20.5, 'torque_nm' => 17.3, 'transmission' => 'manual', 'cooling' => 'aceite', 'starter' => 'electrico', 'brakes_front' => 'Disco 270 mm con ABS', 'brakes_rear' => 'Disco 240 mm', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 152, 'seat_height_mm' => 800, 'color' => 'Negro y rojo', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Kawasaki Ninja 400', 'brand' => 'KAWASAKI', 'category' => 'DEPORTIVA', 'condition' => 'nueva', 'stock' => 1,
                'price' => 14500000, 'featured' => true,
                'short' => 'Deportiva bicilíndrica de 399 cc con ABS. La puerta de entrada al mundo Ninja.',
                'description' => "La Kawasaki Ninja 400 es una deportiva liviana y muy fácil de manejar. Motor bicilíndrico de 399 cc refrigerado por líquido, con 45 HP y caja de 6 marchas con embrague asistido y antirrebote.\n\nTiene ABS de serie, carenado completo, iluminación LED y una posición de manejo cómoda para usar todos los días o salir a la ruta.",
                'moto' => $base(['model' => 'Ninja 400', 'year' => 2026, 'km' => 0, 'displacement_cc' => 399, 'cylinders' => 2, 'power_hp' => 45, 'torque_nm' => 38, 'transmission' => 'manual', 'cooling' => 'liquido', 'starter' => 'electrico', 'brakes_front' => 'Disco 310 mm con ABS', 'brakes_rear' => 'Disco 220 mm con ABS', 'suspension_front' => 'Horquilla telescópica 41 mm', 'suspension_rear' => 'Monoamortiguador Uni-Trak', 'fuel_capacity_l' => 14, 'weight_kg' => 168, 'seat_height_mm' => 785, 'color' => 'Verde Kawasaki', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'KTM 200 Duke', 'brand' => 'KTM', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 1,
                'price' => 7800000,
                'short' => 'Naked liviana y filosa: chasis de acero, ABS y la personalidad de KTM.',
                'description' => "La KTM 200 Duke es una naked liviana con carácter deportivo. Motor monocilíndrico de 199,5 cc refrigerado por líquido, con 25 HP y caja de 6 marchas.\n\nChasis multitubular de acero, horquilla invertida WP, frenos ByBre con ABS y un peso muy contenido que la hace ideal para la ciudad y las curvas.",
                'moto' => $base(['model' => '200 Duke', 'year' => 2026, 'km' => 0, 'displacement_cc' => 200, 'cylinders' => 1, 'power_hp' => 25, 'torque_nm' => 19.3, 'transmission' => 'manual', 'cooling' => 'liquido', 'starter' => 'electrico', 'brakes_front' => 'Disco 300 mm con ABS', 'brakes_rear' => 'Disco 230 mm con ABS', 'suspension_front' => 'Horquilla invertida WP 43 mm', 'suspension_rear' => 'Monoamortiguador WP', 'fuel_capacity_l' => 13.4, 'weight_kg' => 148, 'seat_height_mm' => 822, 'color' => 'Naranja y negro', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Benelli Leoncino 250', 'brand' => 'BENELLI', 'category' => 'CALLE', 'condition' => 'nueva', 'stock' => 2,
                'price' => 6200000,
                'short' => 'Naked de estilo neo-retro con motor de 250 cc refrigerado por líquido.',
                'description' => "La Benelli Leoncino 250 combina un diseño neo-retro con tecnología actual. Motor de 249 cc refrigerado por líquido, inyección electrónica y caja de 6 marchas.\n\nHorquilla invertida, frenos a disco en ambas ruedas, iluminación LED y tablero digital. Una moto con mucha personalidad para la ciudad.",
                'moto' => $base(['model' => 'Leoncino 250', 'year' => 2026, 'km' => 0, 'displacement_cc' => 249, 'cylinders' => 1, 'power_hp' => 25.8, 'torque_nm' => 21, 'transmission' => 'manual', 'cooling' => 'liquido', 'starter' => 'electrico', 'brakes_front' => 'Disco 280 mm', 'brakes_rear' => 'Disco 240 mm', 'suspension_front' => 'Horquilla invertida 41 mm', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12.5, 'weight_kg' => 155, 'seat_height_mm' => 795, 'color' => 'Gris', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Gilera Smash 110', 'brand' => 'GILERA', 'category' => 'MOTONETA', 'condition' => 'nueva', 'stock' => 4,
                'price' => 1700000,
                'short' => 'Motoneta Gilera de 110 cc: económica, liviana y con arranque eléctrico.',
                'description' => "La Gilera Smash 110 es una motoneta pensada para el uso diario. Motor de 107 cc con caja semiautomática de 4 marchas y arranque eléctrico y a pedal.\n\nLlantas de aleación, freno a disco adelante, asiento cómodo para dos y un consumo muy bajo. Repuestos fáciles de conseguir y mantenimiento económico.",
                'moto' => $base(['model' => 'Smash 110', 'year' => 2026, 'km' => 0, 'displacement_cc' => 107, 'cylinders' => 1, 'power_hp' => 7, 'torque_nm' => 7.2, 'transmission' => 'semiautomatica', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 4, 'weight_kg' => 92, 'seat_height_mm' => 765, 'color' => 'Negro', 'warranty' => '12 meses de fábrica']),
            ],
            [
                'name' => 'Mondial LD 110', 'brand' => 'MONDIAL', 'category' => 'MOTONETA', 'condition' => 'nueva', 'stock' => 3,
                'price' => 1500000,
                'short' => 'La motoneta más económica del showroom, ideal para delivery y trámites.',
                'description' => "La Mondial LD 110 es una motoneta simple y muy económica. Motor de 107 cc con caja semiautomática de 4 marchas, arranque eléctrico y a pedal.\n\nEs liviana, ágil en el tránsito y gasta muy poco. Una herramienta de trabajo confiable a un precio accesible.",
                'moto' => $base(['model' => 'LD 110', 'year' => 2026, 'km' => 0, 'displacement_cc' => 107, 'cylinders' => 1, 'power_hp' => 6.8, 'torque_nm' => 7, 'transmission' => 'semiautomatica', 'cooling' => 'aire', 'starter' => 'ambos', 'brakes_front' => 'Tambor', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 4, 'weight_kg' => 90, 'seat_height_mm' => 760, 'color' => 'Rojo', 'warranty' => '12 meses de fábrica']),
            ],

            // ================= CROSS =================
            [
                'name' => 'Honda CRF 250F', 'brand' => 'HONDA', 'category' => 'CROSS', 'condition' => 'nueva', 'stock' => 1,
                'price' => 9800000,
                'short' => 'Moto de enduro/cross de 250 cc para tierra, con arranque eléctrico y suspensión Showa.',
                'description' => "La Honda CRF 250F es una moto off-road pensada para la tierra y los senderos. Motor de 249 cc refrigerado por aire, con arranque eléctrico y caja de 5 marchas.\n\nSuspensiones Showa de largo recorrido, ruedas de 21\" y 18\", frenos a disco y un manejo muy amigable para quien empieza o para salidas recreativas. Uso exclusivo fuera de ruta (no patentable).",
                'moto' => $base(['model' => 'CRF 250F', 'year' => 2026, 'km' => 0, 'displacement_cc' => 249, 'cylinders' => 1, 'power_hp' => 20, 'torque_nm' => 21.5, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 240 mm', 'brakes_rear' => 'Disco 220 mm', 'suspension_front' => 'Horquilla Showa 41 mm', 'suspension_rear' => 'Monoamortiguador Pro-Link', 'fuel_capacity_l' => 6.3, 'weight_kg' => 119, 'seat_height_mm' => 881, 'color' => 'Rojo', 'warranty' => '6 meses de fábrica']),
            ],
            [
                'name' => 'Motomel X3M 250', 'brand' => 'MOTOMEL', 'category' => 'CROSS', 'condition' => 'nueva', 'stock' => 2,
                'price' => 3400000,
                'short' => 'Cross/enduro de 250 cc con mucha suspensión y precio accesible.',
                'description' => "La Motomel X3M 250 es una moto de enduro de 250 cc ideal para tierra, ripio y travesías. Caja de 5 marchas, arranque eléctrico y suspensiones de largo recorrido.\n\nRuedas de 21\" adelante y 18\" atrás, frenos a disco y guardabarros altos. Una forma accesible de empezar en el off-road.",
                'moto' => $base(['model' => 'X3M 250', 'year' => 2026, 'km' => 0, 'displacement_cc' => 229, 'cylinders' => 1, 'power_hp' => 16, 'torque_nm' => 17, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Disco', 'suspension_front' => 'Horquilla invertida', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 8, 'weight_kg' => 118, 'seat_height_mm' => 890, 'color' => 'Blanco y azul', 'warranty' => '12 meses de fábrica']),
            ],

            // ================= CUSTOM =================
            [
                'name' => 'Royal Enfield Classic 350', 'brand' => 'ROYAL ENFIELD', 'category' => 'CUSTOM', 'condition' => 'nueva', 'stock' => 2,
                'price' => 8900000, 'featured' => true, 'tags' => ['Recomendada'],
                'short' => 'Clásica de verdad: motor de 349 cc de bajo régimen, ABS y estética atemporal.',
                'description' => "La Royal Enfield Classic 350 es una moto de estilo clásico con un motor monocilíndrico de 349 cc que entrega mucho torque desde abajo, ideal para pasear tranquilo.\n\nTiene ABS de doble canal, frenos a disco en ambas ruedas, asiento muy cómodo, tablero analógico/digital con navegación (según versión) y una terminación cuidada en cada detalle.",
                'moto' => $base(['model' => 'Classic 350', 'year' => 2026, 'km' => 0, 'displacement_cc' => 349, 'cylinders' => 1, 'power_hp' => 20.2, 'torque_nm' => 27, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 300 mm con ABS', 'brakes_rear' => 'Disco 270 mm con ABS', 'suspension_front' => 'Horquilla telescópica 41 mm', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 13, 'weight_kg' => 195, 'seat_height_mm' => 805, 'color' => 'Verde oscuro', 'warranty' => '3 años de fábrica']),
            ],
            [
                'name' => 'Zanella Patagonian Eagle 250', 'brand' => 'ZANELLA', 'category' => 'CUSTOM', 'condition' => 'nueva', 'stock' => 2,
                'price' => 3800000,
                'short' => 'Custom de 250 cc, bicilíndrica, cómoda y con mucha presencia.',
                'description' => "La Zanella Patagonian Eagle 250 es la custom más accesible del mercado. Motor bicilíndrico en V de 250 cc, caja de 5 marchas y arranque eléctrico.\n\nPosición de manejo relajada, asiento bajo, guardabarros envolventes y muchos cromados. Ideal para paseos y viajes tranquilos.",
                'moto' => $base(['model' => 'Patagonian Eagle 250', 'year' => 2026, 'km' => 0, 'displacement_cc' => 250, 'cylinders' => 2, 'power_hp' => 17, 'torque_nm' => 17, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => 14, 'weight_kg' => 165, 'seat_height_mm' => 700, 'color' => 'Negro', 'warranty' => '12 meses de fábrica']),
            ],

            // ================= ADVENTURE =================
            [
                'name' => 'Benelli TRK 251', 'brand' => 'BENELLI', 'category' => 'ADVENTURE', 'condition' => 'nueva', 'stock' => 2,
                'price' => 6900000, 'is_new' => true,
                'short' => 'Adventure de 250 cc para viajar: parabrisas, protecciones y posición cómoda.',
                'description' => "La Benelli TRK 251 es una adventure de media cilindrada pensada para viajar. Motor de 249 cc refrigerado por líquido, inyección y caja de 6 marchas.\n\nTrae parabrisas, cubrecárter, defensas laterales, horquilla invertida, frenos a disco con ABS y un tanque de 18 litros que le da mucha autonomía. Ideal para rutas y caminos de ripio.",
                'moto' => $base(['model' => 'TRK 251', 'year' => 2026, 'km' => 0, 'displacement_cc' => 249, 'cylinders' => 1, 'power_hp' => 25.8, 'torque_nm' => 21, 'transmission' => 'manual', 'cooling' => 'liquido', 'starter' => 'electrico', 'brakes_front' => 'Disco 280 mm con ABS', 'brakes_rear' => 'Disco 240 mm con ABS', 'suspension_front' => 'Horquilla invertida 41 mm', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 18, 'weight_kg' => 164, 'seat_height_mm' => 800, 'color' => 'Blanco', 'warranty' => '2 años de fábrica']),
            ],
            [
                'name' => 'Honda XR 300L Tornado', 'brand' => 'HONDA', 'category' => 'ADVENTURE', 'condition' => 'nueva', 'stock' => 2,
                'price' => 9200000,
                'short' => 'La Tornado de 300 cc: inyección, ABS y suspensión para cualquier camino.',
                'description' => "La Honda XR 300L Tornado es una doble propósito robusta, con motor de 293 cc e inyección electrónica, caja de 6 marchas y arranque eléctrico.\n\nSuspensiones Showa de largo recorrido, ruedas de 21\" y 18\", frenos a disco con ABS y gran altura libre al piso. Perfecta para viajar, trabajar en el campo o salir al ripio.",
                'moto' => $base(['model' => 'XR 300L Tornado', 'year' => 2026, 'km' => 0, 'displacement_cc' => 293, 'cylinders' => 1, 'power_hp' => 25, 'torque_nm' => 26.7, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 256 mm con ABS', 'brakes_rear' => 'Disco 220 mm con ABS', 'suspension_front' => 'Horquilla Showa 41 mm', 'suspension_rear' => 'Monoamortiguador Pro-Link', 'fuel_capacity_l' => 12.8, 'weight_kg' => 147, 'seat_height_mm' => 875, 'color' => 'Rojo', 'warranty' => '2 años de fábrica']),
            ],

            // ================= ELÉCTRICA =================
            [
                'name' => 'Super Soco CUx', 'brand' => 'SUPER SOCO', 'category' => 'ELÉCTRICA', 'condition' => 'nueva', 'stock' => 2,
                'price' => 3900000, 'is_new' => true,
                'short' => 'Scooter eléctrico silencioso, con batería extraíble y hasta 75 km de autonomía.',
                'description' => "El Super Soco CUx es un scooter 100% eléctrico ideal para la ciudad: no usa nafta, no hace ruido y su mantenimiento es mínimo.\n\nMotor Bosch de 2,5 kW (velocidad máxima 45 km/h), batería de litio extraíble de 60V que se carga en un enchufe común y una autonomía de hasta 75 km. Tablero digital, luces LED y alarma con control remoto.",
                'moto' => ['model' => 'CUx', 'year' => 2026, 'km' => 0, 'displacement_cc' => null, 'cylinders' => null, 'power_hp' => 3.4, 'torque_nm' => 120, 'transmission' => 'automatica', 'cooling' => null, 'starter' => 'electrico', 'fuel_type' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Doble amortiguador', 'fuel_capacity_l' => null, 'weight_kg' => 77, 'seat_height_mm' => 760, 'color' => 'Blanco', 'warranty' => '2 años (batería 1 año)', 'location' => 'Showroom'],
            ],

            // ================= USADAS =================
            [
                'name' => 'Honda CB 190R 2021 usada', 'brand' => 'HONDA', 'category' => 'CALLE', 'condition' => 'usada', 'stock' => 1,
                'price' => 3900000,
                'short' => 'CB 190R 2021 con 18.000 km, service al día y papeles listos para transferir.',
                'description' => "Honda CB 190R modelo 2021 en muy buen estado, con 18.000 km reales. Services hechos en concesionario, cubiertas en buen estado y kit de arrastre con poco uso.\n\nRevisada en nuestro taller antes de la venta. Se entrega con los papeles al día y lista para transferir. Aceptamos tu usada como parte de pago.",
                'moto' => $base(['model' => 'CB 190R', 'year' => 2021, 'km' => 18000, 'displacement_cc' => 184, 'cylinders' => 1, 'power_hp' => 15.4, 'torque_nm' => 15.8, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 276 mm', 'brakes_rear' => 'Disco 220 mm', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 15, 'weight_kg' => 139, 'seat_height_mm' => 790, 'color' => 'Rojo', 'warranty' => '3 meses de garantía del concesionario']),
            ],
            [
                'name' => 'Yamaha FZ-S 150 FI 2020 usada', 'brand' => 'YAMAHA', 'category' => 'CALLE', 'condition' => 'usada', 'stock' => 1,
                'price' => 3300000,
                'short' => 'FZ-S 2020 con 25.400 km, único dueño. Revisada en taller.',
                'description' => "Yamaha FZ-S 150 FI modelo 2020, único dueño, con 25.400 km. Muy cuidada, nunca usada para trabajo.\n\nPasó por la revisión completa de nuestro taller: aceite, filtros, frenos y transmisión. Se entrega con los papeles al día. Financiación disponible.",
                'moto' => $base(['model' => 'FZ-S 150 FI', 'year' => 2020, 'km' => 25400, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 12.2, 'torque_nm' => 13.3, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco 282 mm', 'brakes_rear' => 'Disco 220 mm', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 135, 'seat_height_mm' => 790, 'color' => 'Azul', 'warranty' => '3 meses de garantía del concesionario']),
            ],
            [
                'name' => 'Motomel Skua 150 2022 usada', 'brand' => 'MOTOMEL', 'category' => 'TRAIL', 'condition' => 'usada', 'stock' => 1,
                'price' => 1750000,
                'short' => 'Skua 150 2022 con 12.300 km, ideal para ciudad y ripio. Lista para transferir.',
                'description' => "Motomel Skua 150 modelo 2022 con 12.300 km. Muy buen estado general, cubiertas con buen dibujo y service recién hecho.\n\nRevisada en nuestro taller y lista para transferir. Una trail económica para la ciudad, el ripio y el campo.",
                'moto' => $base(['model' => 'Skua 150', 'year' => 2022, 'km' => 12300, 'displacement_cc' => 149, 'cylinders' => 1, 'power_hp' => 11.5, 'torque_nm' => 11, 'transmission' => 'manual', 'cooling' => 'aire', 'starter' => 'electrico', 'brakes_front' => 'Disco', 'brakes_rear' => 'Tambor', 'suspension_front' => 'Horquilla telescópica', 'suspension_rear' => 'Monoamortiguador', 'fuel_capacity_l' => 12, 'weight_kg' => 122, 'seat_height_mm' => 830, 'color' => 'Negro', 'warranty' => '3 meses de garantía del concesionario']),
            ],
        ];
    }
}
