<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Moto;
use App\Models\Product;
use App\Models\RepuestoCompatibility;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Importación de productos desde CSV, con el mismo flujo que el panel de
 * SH Servicios: parse() lee y valida sin escribir nada (previsualización)
 * y run() crea o actualiza por código.
 */
class ImportService
{
    /**
     * Columnas por tipo: columna => [destino, tipo, opciones].
     * Destinos: p.campo (products), d.campo (ficha del tipo), o especiales.
     */
    public const COLUMNS = [
        'moto' => [
            'codigo' => ['p.code', 'text'],
            'nombre' => ['p.name', 'text'],
            'marca' => ['brand', 'text'],
            'modelo' => ['d.model', 'text'],
            'categoria' => ['category', 'text'],
            'condicion' => ['d.condition_type', 'enum', ['nueva', 'usada', 'reacondicionada']],
            'anio' => ['d.year', 'int'],
            'km' => ['d.km', 'int'],
            'cilindrada_cc' => ['d.displacement_cc', 'int'],
            'potencia_hp' => ['d.power_hp', 'decimal'],
            'transmision' => ['d.transmission', 'enum', ['manual', 'automatica', 'semiautomatica']],
            'combustible' => ['d.fuel_type', 'enum', ['nafta', 'electrico', 'hibrido']],
            'refrigeracion' => ['d.cooling', 'enum', ['aire', 'liquido', 'aceite']],
            'arranque' => ['d.starter', 'enum', ['electrico', 'pedal', 'ambos']],
            'peso_kg' => ['d.weight_kg', 'decimal'],
            'tanque_l' => ['d.fuel_capacity_l', 'decimal'],
            'color' => ['d.color', 'text'],
            'garantia' => ['d.warranty', 'text'],
            'ubicacion' => ['d.location', 'text'],
            'moneda' => ['p.currency', 'currency'],
            'costo' => ['p.cost_price', 'decimal'],
            'ganancia' => ['p.profit_percent', 'decimal'],
            'precio' => ['p.final_price', 'decimal'],
            'precio_oferta' => ['p.offer_price', 'decimal'],
            'mostrar_precio' => ['p.price_visible', 'bool'],
            'estado' => ['p.availability', 'enum', ['disponible', 'reservado', 'vendido', 'consultar']],
            'stock' => ['stock', 'int'],
            'stock_minimo' => ['p.stock_min', 'int'],
            'publicado' => ['p.active', 'bool'],
            'destacado' => ['p.featured', 'bool'],
            'es_nuevo' => ['p.is_new', 'bool'],
            'resumen' => ['p.short_description', 'text'],
            'descripcion' => ['p.description', 'longtext'],
        ],
        'casco' => [
            'codigo' => ['p.code', 'text'],
            'nombre' => ['p.name', 'text'],
            'marca' => ['brand', 'text'],
            'categoria' => ['category', 'text'],
            'tipo' => ['d.helmet_type', 'enum', ['integral', 'abierto', 'modular', 'cross', 'infantil']],
            'talle' => ['d.size', 'enum', ['XS', 'S', 'M', 'L', 'XL', 'XXL']],
            'homologacion' => ['d.certification', 'text'],
            'visor' => ['d.visor_type', 'text'],
            'material' => ['d.material', 'text'],
            'color' => ['d.color', 'text'],
            'peso_g' => ['d.weight_grams', 'int'],
            'bluetooth' => ['d.has_bluetooth', 'bool'],
            'garantia' => ['d.warranty', 'text'],
            'moneda' => ['p.currency', 'currency'],
            'costo' => ['p.cost_price', 'decimal'],
            'ganancia' => ['p.profit_percent', 'decimal'],
            'precio' => ['p.final_price', 'decimal'],
            'precio_oferta' => ['p.offer_price', 'decimal'],
            'mostrar_precio' => ['p.price_visible', 'bool'],
            'estado' => ['p.availability', 'enum', ['disponible', 'reservado', 'vendido', 'consultar']],
            'stock' => ['stock', 'int'],
            'stock_minimo' => ['p.stock_min', 'int'],
            'publicado' => ['p.active', 'bool'],
            'destacado' => ['p.featured', 'bool'],
            'es_nuevo' => ['p.is_new', 'bool'],
            'resumen' => ['p.short_description', 'text'],
            'descripcion' => ['p.description', 'longtext'],
        ],
        'repuesto' => [
            'codigo' => ['p.code', 'text'],
            'nombre' => ['p.name', 'text'],
            'marca' => ['brand', 'text'],
            'categoria' => ['category', 'text'],
            'fabricante' => ['d.manufacturer', 'text'],
            'codigo_oem' => ['d.oem_code', 'text'],
            'codigo_fabricante' => ['d.manufacturer_code', 'text'],
            'origen' => ['d.origin', 'enum', ['original', 'alternativo', 'remanufacturado']],
            'unidad' => ['d.unit', 'text'],
            'peso_kg' => ['d.weight_kg', 'decimal'],
            'moneda' => ['p.currency', 'currency'],
            'costo' => ['p.cost_price', 'decimal'],
            'ganancia' => ['p.profit_percent', 'decimal'],
            'precio' => ['p.final_price', 'decimal'],
            'precio_oferta' => ['p.offer_price', 'decimal'],
            'mostrar_precio' => ['p.price_visible', 'bool'],
            'estado' => ['p.availability', 'enum', ['disponible', 'reservado', 'vendido', 'consultar']],
            'stock' => ['stock', 'int'],
            'stock_minimo' => ['p.stock_min', 'int'],
            'publicado' => ['p.active', 'bool'],
            'destacado' => ['p.featured', 'bool'],
            'compatibilidad' => ['compat', 'text'],
            'resumen' => ['p.short_description', 'text'],
            'descripcion' => ['p.description', 'longtext'],
        ],
    ];

    /** Ejemplo de fila para cada plantilla. */
    private const EXAMPLES = [
        'moto' => ['codigo' => 'MOTO-0100', 'nombre' => 'Honda CB 250 Twister', 'marca' => 'Honda', 'modelo' => 'CB 250 Twister', 'categoria' => 'Naked', 'condicion' => 'nueva', 'anio' => '2026', 'km' => '0', 'cilindrada_cc' => '250', 'moneda' => 'ARS', 'precio' => '4500000', 'estado' => 'disponible', 'publicado' => 'si'],
        'casco' => ['codigo' => 'CASCO-0100', 'nombre' => 'LS2 FF800 Storm', 'marca' => 'LS2', 'categoria' => 'Integral', 'tipo' => 'integral', 'talle' => 'M', 'homologacion' => 'ECE 22.06', 'moneda' => 'ARS', 'precio' => '250000', 'publicado' => 'si'],
        'repuesto' => ['codigo' => 'REP-0100', 'nombre' => 'Filtro de aceite', 'marca' => 'Honda', 'categoria' => 'Filtros', 'codigo_oem' => '15410-KYJ-901', 'origen' => 'original', 'moneda' => 'ARS', 'precio' => '12000', 'compatibilidad' => 'Honda CB 250 Twister 2016-2026 | Honda XR 250 Tornado', 'publicado' => 'si'],
    ];

    /** Plantilla CSV con encabezado y una fila de ejemplo. */
    /**
     * Columnas de un tipo. Si la condición viene fijada (importar sólo 0 km o
     * sólo usadas), la columna "condicion" no hace falta y se saca.
     */
    public static function columnsFor(string $type, ?string $forcedCondition = null): array
    {
        $columns = self::COLUMNS[$type];
        if ($type === 'moto' && $forcedCondition) {
            unset($columns['condicion']);
        }

        return $columns;
    }

    public static function template(string $type, ?string $forcedCondition = null): string
    {
        $columns = array_keys(self::columnsFor($type, $forcedCondition));
        $example = self::EXAMPLES[$type];
        if ($forcedCondition === 'usada') {
            $example = ['codigo' => 'MOTO-0200', 'nombre' => 'Yamaha XTZ 250', 'marca' => 'Yamaha', 'modelo' => 'XTZ 250', 'categoria' => 'Enduro', 'anio' => '2021', 'km' => '18500', 'cilindrada_cc' => '250', 'color' => 'Azul', 'moneda' => 'ARS', 'precio' => '3200000', 'estado' => 'disponible', 'publicado' => 'si'];
        }

        $handle = fopen('php://temp', 'w+b');
        fwrite($handle, "sep=;\r\n");
        fputcsv($handle, $columns, ';', '"', '\\');
        fputcsv($handle, array_map(fn ($c) => $example[$c] ?? '', $columns), ';', '"', '\\');
        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return $content;
    }

    /**
     * Lee y valida un CSV. No escribe nada en la base.
     *
     * @return array{ok:bool,message:string,valid:array,invalid:array,columns:array<int,string>}
     */
    public static function parse(string $filePath, string $type, ?string $forcedCondition = null): array
    {
        $columns = self::columnsFor($type, $forcedCondition);
        $empty = ['ok' => false, 'message' => '', 'valid' => [], 'invalid' => [], 'columns' => array_keys($columns)];

        $raw = @file_get_contents($filePath);
        if ($raw === false) {
            return ['message' => 'No se pudo leer el archivo.'] + $empty;
        }

        $handle = fopen('php://temp', 'r+b');
        fwrite($handle, self::toUtf8($raw));
        rewind($handle);

        // Separador: línea "sep=;" de la plantilla o el más frecuente de la primera línea.
        $firstLine = rtrim((string) fgets($handle), "\r\n");
        if (preg_match('/^sep=(.)\s*$/i', $firstLine, $m)) {
            $separator = $m[1];
        } else {
            $separator = substr_count($firstLine, ';') >= substr_count($firstLine, ',') ? ';' : ',';
            rewind($handle);
        }

        $header = fgetcsv($handle, 0, $separator, '"', '\\');
        if ($header === false || $header === [null]) {
            fclose($handle);

            return ['message' => 'El archivo está vacío.'] + $empty;
        }

        $header = array_map(fn ($h) => str_replace('-', '_', Str::slug(str_replace(' ', '_', trim((string) $h)), '_')), $header);

        if (! in_array('codigo', $header, true) || ! in_array('nombre', $header, true)) {
            fclose($handle);

            return ['message' => 'Faltan las columnas obligatorias "codigo" y "nombre". Descargá la plantilla para ver el formato.'] + $empty;
        }

        $valid = [];
        $invalid = [];
        $seen = [];
        $line = 1;

        while (($row = fgetcsv($handle, 0, $separator, '"', '\\')) !== false) {
            $line++;
            if (count(array_filter($row, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $data = [];
            foreach ($header as $i => $name) {
                if (isset($columns[$name])) {
                    $data[$name] = isset($row[$i]) ? trim((string) $row[$i]) : '';
                }
            }

            [$parsed, $errors] = self::validateRow($data, $columns, $seen);

            // Importación de "sólo 0 km" o "sólo usadas": todas las filas toman esa condición.
            if ($type === 'moto' && $forcedCondition) {
                $parsed['d']['condition_type'] = $forcedCondition;
                if ($forcedCondition === 'nueva' && ! isset($parsed['d']['km'])) {
                    $parsed['d']['km'] = 0;
                }
            }

            if ($errors === []) {
                $seen[] = mb_strtoupper($parsed['p']['code']);
                $valid[] = ['line' => $line, 'data' => $parsed, 'raw' => $data];
            } else {
                $invalid[] = ['line' => $line, 'errors' => $errors, 'raw' => $data];
            }

            if (count($valid) + count($invalid) >= 5000) {
                break; // límite de seguridad
            }
        }
        fclose($handle);

        return [
            'ok' => true,
            'message' => sprintf('%d fila(s) correcta(s), %d con error.', count($valid), count($invalid)),
            'valid' => $valid,
            'invalid' => $invalid,
            'columns' => array_keys($columns),
        ];
    }

    /**
     * Crea o actualiza los productos de las filas válidas.
     *
     * @return array{created:int,updated:int,skipped:int,errors:array<int,string>}
     */
    public static function run(array $rows, string $type, bool $updateExisting, int $userId): array
    {
        $result = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];

        foreach ($rows as $row) {
            $data = $row['data'];
            try {
                DB::transaction(function () use ($data, $type, $updateExisting, $userId, &$result) {
                    $productData = $data['p'];
                    if (! empty($data['brand'])) {
                        $productData['brand_id'] = self::brandId($data['brand']);
                    }
                    if (! empty($data['category'])) {
                        $productData['category_id'] = self::categoryId($data['category'], $type);
                    }

                    $product = Product::withTrashed()->where('code', $productData['code'])->first();

                    if ($product) {
                        if (! $updateExisting) {
                            $result['skipped']++;

                            return;
                        }
                        if ($product->type !== $type) {
                            throw new \RuntimeException("el código {$product->code} ya existe como {$product->type}");
                        }
                        if ($product->trashed()) {
                            $product->restore();
                        }
                        $productData['updated_by'] = $userId;
                        $product->update($productData);
                        $result['updated']++;
                    } else {
                        $productData += [
                            'type' => $type,
                            'final_price' => 0,
                            'currency' => 'ARS',
                            'price_visible' => true,
                            'availability' => 'disponible',
                            'active' => true,
                        ];
                        $productData['slug'] = Str::slug($productData['name']).'-'.Str::lower(Str::random(4));
                        $productData['created_by'] = $userId;
                        $productData['updated_by'] = $userId;
                        $product = Product::create($productData);
                        $result['created']++;
                    }

                    if (! empty($data['d']) || $type === 'moto') {
                        $detailClass = ['moto' => Moto::class, 'casco' => \App\Models\Casco::class, 'repuesto' => \App\Models\Repuesto::class][$type];
                        $detail = $detailClass::firstOrNew(['product_id' => $product->id]);
                        if ($type === 'moto' && ! $detail->exists && empty($data['d']['condition_type'])) {
                            $detail->condition_type = 'nueva';
                        }
                        $detail->fill($data['d'] ?? []);
                        $detail->save();
                    }

                    // Stock: se registra como ajuste para que quede en el historial.
                    if (isset($data['stock']) && (int) $data['stock'] !== (int) $product->stock_qty) {
                        StockService::move($product, 'ajuste', (int) $data['stock'], 'importacion', 'Cargado desde importación CSV', $userId);
                    }

                    if ($type === 'repuesto' && ! empty($data['compat'])) {
                        self::syncCompatibility($product, $data['compat']);
                    }
                });
            } catch (\Throwable $e) {
                $result['errors'][] = "Línea {$row['line']}: ".$e->getMessage();
            }
        }

        return $result;
    }

    // ------------------------------------------------------------------
    // Validación
    // ------------------------------------------------------------------

    /** @return array{0:array,1:array<int,string>} */
    private static function validateRow(array $data, array $columns, array $seen): array
    {
        $errors = [];
        $parsed = ['p' => [], 'd' => [], 'brand' => null, 'category' => null, 'compat' => null, 'stock' => null];

        foreach ($columns as $column => $def) {
            [$target, $kind] = $def;
            $options = $def[2] ?? [];
            $value = $data[$column] ?? '';

            if ($value === '') {
                continue; // columna vacía: no se toca
            }

            $clean = match ($kind) {
                'text' => mb_substr($value, 0, 190),
                'longtext' => mb_substr($value, 0, 20000),
                'int' => self::parseNumber($value, true),
                'decimal' => self::parseNumber($value, false),
                'bool' => self::parseBool($value),
                'currency' => self::parseCurrency($value),
                'enum' => self::parseEnum($value, $options),
                default => $value,
            };

            if ($clean === null) {
                $hint = $kind === 'enum' ? ' (valores: '.implode(', ', $options).')' : '';
                $errors[] = "\"{$column}\" tiene un valor inválido: {$value}{$hint}";

                continue;
            }

            if (str_starts_with($target, 'p.')) {
                $parsed['p'][substr($target, 2)] = $clean;
            } elseif (str_starts_with($target, 'd.')) {
                $parsed['d'][substr($target, 2)] = $clean;
            } else {
                $parsed[$target] = $clean;
            }
        }

        $code = $parsed['p']['code'] ?? '';
        if ($code === '') {
            $errors[] = 'Falta el código.';
        } elseif (in_array(mb_strtoupper($code), $seen, true)) {
            $errors[] = "El código {$code} está repetido en el archivo.";
        }
        if (($parsed['p']['name'] ?? '') === '') {
            $errors[] = 'Falta el nombre.';
        }

        return [$parsed, $errors];
    }

    private static function parseNumber(string $value, bool $integer): int|float|null
    {
        $v = str_replace([' ', '$', 'US', 'u$s'], '', $value);
        // Formato argentino "1.234.567,50" → 1234567.50
        if (preg_match('/^-?\d{1,3}(\.\d{3})+(,\d+)?$/', $v) || str_contains($v, ',')) {
            $v = str_replace(['.', ','], ['', '.'], $v);
        }
        if (! is_numeric($v) || (float) $v < 0) {
            return null;
        }

        return $integer ? (int) round((float) $v) : round((float) $v, 2);
    }

    private static function parseBool(string $value): ?bool
    {
        $v = mb_strtolower(trim($value));

        return match (true) {
            in_array($v, ['si', 'sí', 'x', '1', 'true', 'verdadero', 'yes', 'y'], true) => true,
            in_array($v, ['no', '0', 'false', 'falso', 'n'], true) => false,
            default => null,
        };
    }

    private static function parseCurrency(string $value): ?string
    {
        $v = Str::slug($value);

        return match (true) {
            trim($value) === '$', $v === 'ars', str_starts_with($v, 'peso') => 'ARS',
            in_array($v, ['usd', 'us', 'u-s-s', 'us-'], true), str_starts_with($v, 'dolar') => 'USD',
            default => null,
        };
    }

    private static function parseEnum(string $value, array $options): ?string
    {
        $v = Str::slug($value, '');
        foreach ($options as $option) {
            if (Str::slug($option, '') === $v) {
                return $option;
            }
        }
        // Equivalencias comunes: "nuevo" → "nueva", "usado" → "usada", etc.
        $aliases = ['nuevo' => 'nueva', '0km' => 'nueva', 'usado' => 'usada', 'reacondicionado' => 'reacondicionada', 'reservada' => 'reservado', 'vendida' => 'vendido', 'automatico' => 'automatica', 'oem' => 'original', 'genuino' => 'original', 'generico' => 'alternativo'];
        $alias = $aliases[$v] ?? null;

        return $alias && in_array($alias, $options, true) ? $alias : null;
    }

    // ------------------------------------------------------------------
    // Auxiliares
    // ------------------------------------------------------------------

    private static function brandId(string $name): int
    {
        $brand = Brand::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();

        return $brand?->id ?? Brand::create(['name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(3)), 'active' => true])->id;
    }

    private static function categoryId(string $name, string $type): int
    {
        $category = Category::where('group', $type)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();

        return $category?->id ?? Category::create(['group' => $type, 'name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(3)), 'active' => true])->id;
    }

    /** "Honda CB 250 2016-2020 | Yamaha YBR 125" → filas de compatibilidad. */
    private static function syncCompatibility(Product $product, string $value): void
    {
        RepuestoCompatibility::where('repuesto_id', $product->id)->delete();

        foreach (array_filter(array_map('trim', preg_split('/[|\n]/', $value))) as $item) {
            $yearFrom = $yearTo = null;
            if (preg_match('/(\d{4})\s*-\s*(\d{4})\s*$/', $item, $m)) {
                [$yearFrom, $yearTo] = [(int) $m[1], (int) $m[2]];
                $item = trim(substr($item, 0, -strlen($m[0])));
            } elseif (preg_match('/(\d{4})\s*$/', $item, $m)) {
                $yearFrom = $yearTo = (int) $m[1];
                $item = trim(substr($item, 0, -strlen($m[0])));
            }

            $brandId = null;
            $model = $item;
            foreach (Brand::pluck('name', 'id') as $id => $name) {
                if (Str::startsWith(mb_strtolower($item), mb_strtolower($name).' ')) {
                    $brandId = $id;
                    $model = trim(mb_substr($item, mb_strlen($name)));
                    break;
                }
            }

            RepuestoCompatibility::create([
                'repuesto_id' => $product->id,
                'brand_id' => $brandId,
                'model' => mb_substr($model ?: $item, 0, 120),
                'year_from' => $yearFrom,
                'year_to' => $yearTo,
            ]);
        }
    }

    /** Deja el CSV en UTF-8 aunque Excel lo haya guardado en ANSI (Windows-1252). */
    private static function toUtf8(string $content): string
    {
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }

        if (! mb_check_encoding($content, 'UTF-8')) {
            $content = (string) mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
        }

        return $content;
    }
}
