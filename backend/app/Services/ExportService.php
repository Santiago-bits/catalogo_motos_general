<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Inquiry;
use App\Models\Product;
use App\Models\Quote;
use App\Support\Xlsx;
use Illuminate\Database\Eloquent\Builder;
use Symfony\Component\HttpFoundation\Response;

/**
 * Conjuntos de datos exportables y su salida a CSV / Excel / PDF.
 * Misma lógica que ExportService de SH Servicios, adaptada a Eloquent.
 */
class ExportService
{
    /** Conjuntos disponibles: clave => [título, descripción]. */
    public const DATASETS = [
        'motos' => ['Motos 0 km', 'Stock de motos nuevas con precio, estado y ficha básica.'],
        'usadas' => ['Motos usadas', 'Motos usadas y reacondicionadas con año y kilómetros.'],
        'cascos' => ['Cascos y accesorios', 'Cascos con talle, homologación y precio.'],
        'repuestos' => ['Repuestos', 'Repuestos con códigos OEM / fabricante y precio.'],
        'consultas' => ['Consultas', 'Consultas recibidas desde el sitio con su estado.'],
        'cotizaciones' => ['Cotizaciones', 'Pedidos de cotización del cotizador online.'],
        'auditoria' => ['Auditoría', 'Registro de acciones hechas en el panel.'],
    ];

    /**
     * @return array{title:string,headers:array<int,string>,rows:array<int,array<int,mixed>>}
     */
    public static function dataset(string $dataset, ?Builder $auditQuery = null): array
    {
        return match ($dataset) {
            'motos' => self::motos(false),
            'usadas' => self::motos(true),
            'cascos' => self::cascos(),
            'repuestos' => self::repuestos(),
            'consultas' => self::inquiries(),
            'cotizaciones' => self::quotes(),
            'auditoria' => self::audit($auditQuery),
            default => abort(404, 'Ese conjunto de datos no existe.'),
        };
    }

    /** Productos del conjunto, para el catálogo en PDF. */
    public static function productsFor(string $dataset): Builder
    {
        $used = ['usada', 'reacondicionada'];

        return match ($dataset) {
            'motos' => Product::type('moto')->whereDoesntHave('moto', fn ($q) => $q->whereIn('condition_type', $used)),
            'usadas' => Product::type('moto')->whereHas('moto', fn ($q) => $q->whereIn('condition_type', $used)),
            'cascos' => Product::type('casco'),
            'repuestos' => Product::type('repuesto'),
            'motos-todas' => Product::type('moto'),
            default => abort(404, 'Ese conjunto no tiene catálogo.'),
        };
    }

    public static function respond(array $data, string $format, string $filename): Response
    {
        return match ($format) {
            'csv' => self::toCsv($data, $filename),
            'xlsx' => self::toXlsx($data, $filename),
            'pdf' => PdfService::response(PdfService::table($data['title'], $data['headers'], $data['rows']), self::ascii($filename).'.pdf'),
            default => abort(404, 'Formato no soportado.'),
        };
    }

    // ------------------------------------------------------------------
    // Conjuntos
    // ------------------------------------------------------------------

    private static function motos(bool $used): array
    {
        $headers = ['Codigo', 'Nombre', 'Marca', 'Modelo', 'Categoria', 'Año', 'Condicion', 'Km', 'Cilindrada (cc)', 'Color', 'Precio', 'Moneda', 'Oferta', 'Estado', 'Stock', 'Publicada', 'Destacada'];

        $rows = self::productsFor($used ? 'usadas' : 'motos')
            ->with(['brand', 'category', 'moto'])->orderByDesc('code')->get()
            ->map(fn (Product $p) => [
                $p->code, $p->name, $p->brand?->name, $p->moto?->model, $p->category?->name,
                self::int($p->moto?->year), self::cap($p->moto?->condition_type), self::int($p->moto?->km),
                self::int($p->moto?->displacement_cc), $p->moto?->color,
                self::num($p->final_price), $p->currency, self::num($p->is_offer ? $p->offer_price : null),
                self::cap($p->availability), (int) $p->stock_qty, self::yesNo($p->active), self::yesNo($p->featured),
            ])->all();

        return ['title' => $used ? 'Motos usadas' : 'Motos 0 km', 'headers' => $headers, 'rows' => $rows];
    }

    private static function cascos(): array
    {
        $headers = ['Codigo', 'Nombre', 'Marca', 'Categoria', 'Tipo', 'Talle', 'Homologacion', 'Color', 'Precio', 'Moneda', 'Estado', 'Stock', 'Publicado'];

        $rows = Product::type('casco')->with(['brand', 'category', 'casco'])->orderByDesc('code')->get()
            ->map(fn (Product $p) => [
                $p->code, $p->name, $p->brand?->name, $p->category?->name,
                self::cap($p->casco?->helmet_type), $p->casco?->size, $p->casco?->certification, $p->casco?->color,
                self::num($p->final_price), $p->currency, self::cap($p->availability), (int) $p->stock_qty, self::yesNo($p->active),
            ])->all();

        return ['title' => 'Cascos y accesorios', 'headers' => $headers, 'rows' => $rows];
    }

    private static function repuestos(): array
    {
        $headers = ['Codigo', 'Nombre', 'Marca', 'Categoria', 'Codigo OEM', 'Codigo fabricante', 'Fabricante', 'Origen', 'Unidad', 'Precio', 'Moneda', 'Estado', 'Stock', 'Publicado'];

        $rows = Product::type('repuesto')->with(['brand', 'category', 'repuesto'])->orderByDesc('code')->get()
            ->map(fn (Product $p) => [
                $p->code, $p->name, $p->brand?->name, $p->category?->name,
                $p->repuesto?->oem_code, $p->repuesto?->manufacturer_code, $p->repuesto?->manufacturer,
                self::cap($p->repuesto?->origin), $p->repuesto?->unit,
                self::num($p->final_price), $p->currency, self::cap($p->availability), (int) $p->stock_qty, self::yesNo($p->active),
            ])->all();

        return ['title' => 'Repuestos', 'headers' => $headers, 'rows' => $rows];
    }

    private static function inquiries(): array
    {
        $headers = ['Fecha', 'Nombre', 'Email', 'Telefono', 'Producto', 'Canal', 'Estado', 'Asignada a', 'Mensaje'];

        $rows = Inquiry::with(['product:id,name', 'assignee:id,name'])->latest()->get()
            ->map(fn (Inquiry $i) => [
                $i->created_at?->format('d/m/Y H:i'), $i->name, $i->email, $i->phone, $i->product?->name,
                self::cap($i->source), Inquiry::STATUSES[$i->status] ?? $i->status, $i->assignee?->name,
                self::text($i->message),
            ])->all();

        return ['title' => 'Consultas', 'headers' => $headers, 'rows' => $rows];
    }

    private static function quotes(): array
    {
        $headers = ['Numero', 'Fecha', 'Cliente', 'Email', 'Telefono', 'Items', 'Total', 'Moneda', 'Estado'];

        $rows = Quote::withCount('items')->latest()->get()
            ->map(fn (Quote $q) => [
                $q->number, $q->created_at?->format('d/m/Y H:i'), $q->name, $q->email, $q->phone,
                $q->items_count, self::num($q->total), $q->currency, self::cap($q->status),
            ])->all();

        return ['title' => 'Cotizaciones', 'headers' => $headers, 'rows' => $rows];
    }

    private static function audit(?Builder $query): array
    {
        $headers = ['Fecha', 'Usuario', 'Accion', 'Seccion', 'Descripcion', 'IP'];

        $rows = ($query ?? ActivityLog::query())->with('user:id,name')->latest('id')->limit(5000)->get()
            ->map(fn (ActivityLog $l) => [
                $l->created_at?->format('d/m/Y H:i'), $l->user?->name ?? 'Sistema', self::cap($l->action),
                self::cap($l->module), $l->description, $l->ip,
            ])->all();

        return ['title' => 'Auditoria', 'headers' => $headers, 'rows' => $rows];
    }

    // ------------------------------------------------------------------
    // Salidas
    // ------------------------------------------------------------------

    private static function toCsv(array $data, string $filename): Response
    {
        $handle = fopen('php://temp', 'w+b');
        // "sep=;" para que Excel separe en columnas en cualquier PC.
        fwrite($handle, "sep=;\r\n");
        fputcsv($handle, array_map([self::class, 'ascii'], $data['headers']), ';', '"', '\\');
        foreach ($data['rows'] as $row) {
            fputcsv($handle, array_map([self::class, 'ascii'], $row), ';', '"', '\\');
        }
        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.self::ascii($filename).'.csv"',
            'Cache-Control' => 'no-store',
        ]);
    }

    private static function toXlsx(array $data, string $filename): Response
    {
        // Sin la extensión zip el .xlsx no se puede armar: se entrega CSV, que Excel abre igual.
        if (! class_exists(\ZipArchive::class)) {
            return self::toCsv($data, $filename);
        }

        $xlsx = new Xlsx(self::ascii($data['title']));
        $xlsx->setHeaders(array_map([self::class, 'ascii'], $data['headers']));
        $xlsx->addRows(array_map(
            static fn (array $r): array => array_map(static fn (mixed $v): mixed => is_string($v) ? self::ascii($v) : $v, $r),
            $data['rows']
        ));

        return response($xlsx->output(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.self::ascii($filename).'.xlsx"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * Saca tildes y caracteres fuera del ASCII imprimible, y neutraliza celdas
     * que Excel interpretaría como fórmula (los datos de consultas los escribe
     * cualquier visitante del sitio).
     */
    public static function ascii(mixed $value): string
    {
        $s = strtr((string) $value, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
            'º' => '', 'ª' => '', '°' => '', '¿' => '', '¡' => '',
            '–' => '-', '—' => '-', '‘' => "'", '’' => "'", '“' => '"', '”' => '"', '…' => '...',
            '€' => 'EUR', '·' => '-', "\u{00A0}" => ' ',
        ]);
        $s = (string) preg_replace('/[^\x09\x0A\x0D\x20-\x7E]/', '', $s);

        if ($s !== '' && in_array($s[0], ['=', '+', '-', '@'], true)) {
            $s = "'".$s;
        }

        return $s;
    }

    private static function num(mixed $v): float|string
    {
        return $v === null || $v === '' ? '' : (float) $v;
    }

    private static function int(mixed $v): int|string
    {
        return $v === null || $v === '' ? '' : (int) $v;
    }

    private static function cap(?string $v): string
    {
        return $v ? ucfirst(str_replace('_', ' ', $v)) : '';
    }

    private static function yesNo(mixed $v): string
    {
        return $v ? 'Si' : 'No';
    }

    private static function text(?string $v, int $max = 500): string
    {
        $v = trim(preg_replace('/\s+/', ' ', (string) $v));

        return mb_strlen($v) > $max ? mb_substr($v, 0, $max - 1).'…' : $v;
    }
}
