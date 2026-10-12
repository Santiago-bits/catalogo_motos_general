<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Setting;
use App\Support\Pdf;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * PDFs del panel: tabla genérica (exportaciones) y catálogo con fotos.
 * Basado en PdfService de SH Servicios, con los colores de RODADO.
 */
class PdfService
{
    private const RED = '#C8102E';

    private const INK = '#15161A';

    private const DARK = '#2A2C33';

    private const GRAY = '#6B6E77';

    private const LIGHT = '#F3F2EF';

    public static function response(Pdf $pdf, string $filename, bool $download = true): Response
    {
        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.$filename.'"',
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ]);
    }

    // =================================================================
    // Tabla genérica (botón "PDF" de cada conjunto en Exportar)
    // =================================================================

    /**
     * @param  array<int,string>  $headers
     * @param  array<int,array<int,mixed>>  $rows
     */
    public static function table(string $title, array $headers, array $rows): Pdf
    {
        $pdf = new Pdf('L');
        $pdf->setMargins(12, 16, 12, 16);
        $pdf->setMeta($title, self::companyName());

        $company = self::companyName();
        $generated = now()->format('d/m/Y H:i');

        $pdf->setFooter(static function (Pdf $pdf) use ($company, $generated): void {
            $y = $pdf->pageHeight() - 10;
            $pdf->setDrawColor('#DDDDDD');
            $pdf->line(12, $y - 4, $pdf->pageWidth() - 12, $y - 4);
            $pdf->setFont('', 7);
            $pdf->setTextColor(self::GRAY);
            $pdf->text(12, $y, $company.'  ·  Generado '.$generated);
            $page = 'Página '.$pdf->pageNumber();
            $pdf->text($pdf->pageWidth() - 12 - $pdf->textWidth($page, 7), $y, $page);
        });

        $pdf->addPage();

        $pdf->filledRect(12, $pdf->getY() - 3, 2, 8, self::RED);
        $pdf->setFont('B', 13);
        $pdf->setTextColor(self::INK);
        $pdf->text(16, $pdf->getY() + 2, mb_strtoupper($title));
        $pdf->moveY(8);

        $headers = array_values($headers);
        $colCount = max(1, count($headers));
        $available = $pdf->contentWidth();

        $fontSize = $colCount <= 6 ? 8.0 : ($colCount <= 10 ? 7.0 : 6.0);
        $headFont = $fontSize + 0.5;
        $lineH = $fontSize * 0.42 + 2.4;
        $pad = 1.4;

        // Ancho de columna proporcional al contenido (con un mínimo)
        $pdf->setFont('', $fontSize);
        $weights = [];
        foreach ($headers as $i => $label) {
            $max = $pdf->textWidth((string) $label, $headFont, 'B') + 4;
            foreach (array_slice($rows, 0, 80) as $r) {
                $max = max($max, $pdf->textWidth(mb_substr(self::cellText($r[$i] ?? ''), 0, 45), $fontSize) + 4);
            }
            $weights[$i] = max($max, 12.0);
        }
        $sum = array_sum($weights) ?: 1.0;
        $widths = array_map(static fn (float $w): float => $w / $sum * $available, $weights);
        $totalW = array_sum($widths);
        $x0 = 12.0;

        $drawHead = static function (Pdf $pdf) use ($headers, $widths, $totalW, $x0, $headFont): void {
            $y = $pdf->getY();
            $h = $headFont * 0.42 + 3.0;
            $pdf->filledRect($x0, $y, $totalW, $h, self::INK);
            $pdf->setFont('B', $headFont);
            $pdf->setTextColor('#FFFFFF');
            $x = $x0;
            foreach ($headers as $i => $label) {
                $pdf->cell($x, $y, $widths[$i], $h, $pdf->truncate((string) $label, $widths[$i] - 3), 'L', null, false, 1.4);
                $x += $widths[$i];
            }
            $pdf->setY($y + $h);
        };

        $drawHead($pdf);

        $alt = false;
        foreach ($rows as $row) {
            $pdf->setFont('', $fontSize);

            $wrapped = [];
            $maxLines = 1;
            foreach ($headers as $i => $_) {
                $lines = array_slice($pdf->wrap(self::cellText($row[$i] ?? ''), $widths[$i] - 2 * $pad), 0, 4);
                $wrapped[$i] = $lines === [] ? [''] : $lines;
                $maxLines = max($maxLines, count($wrapped[$i]));
            }
            $h = $maxLines * $lineH + 1.6;

            if ($pdf->getY() + $h > $pdf->pageHeight() - 16) {
                $pdf->addPage();
                $drawHead($pdf);
            }

            $y = $pdf->getY();
            if ($alt) {
                $pdf->filledRect($x0, $y, $totalW, $h, self::LIGHT);
            }
            $alt = ! $alt;

            $pdf->setFont('', $fontSize);
            $pdf->setTextColor(self::INK);
            $x = $x0;
            foreach ($headers as $i => $_) {
                $ly = $y + $lineH - 0.5;
                foreach ($wrapped[$i] as $line) {
                    $pdf->text($x + $pad, $ly, $line);
                    $ly += $lineH;
                }
                $x += $widths[$i];
            }
            $pdf->setY($y + $h);
        }

        if ($rows === []) {
            $pdf->setFont('', 9);
            $pdf->setTextColor(self::GRAY);
            $pdf->text($x0, $pdf->getY() + 8, 'No hay datos para exportar.');
        }

        return $pdf;
    }

    // =================================================================
    // Catálogo con fotos
    // =================================================================

    /** @param iterable<Product> $products */
    public static function catalog(iterable $products, string $title, bool $withPrices = true): Pdf
    {
        $pdf = new Pdf('P');
        $pdf->setMargins(14, 14, 14, 20);
        $pdf->setMeta($title, self::companyName());

        $company = [
            'name' => self::companyName(),
            'taxid' => (string) Setting::get('legal_cuit', ''),
            'address' => (string) Setting::get('contact_address', ''),
            'phone' => (string) Setting::get('contact_phone', ''),
            'email' => (string) Setting::get('contact_email', ''),
        ];

        $pdf->setHeader(static fn (Pdf $pdf) => self::header($pdf, $company, mb_strtoupper($title), now()->format('m/Y')));
        $pdf->setFooter(static fn (Pdf $pdf) => self::footer($pdf, $company['name']));
        $pdf->addPage();

        $cardHeight = 50.0;
        $count = 0;

        foreach ($products as $product) {
            $count++;
            $pdf->ensureSpace($cardHeight + 4);
            $y = $pdf->getY();
            $w = $pdf->contentWidth();

            $pdf->filledRect(14, $y, $w, $cardHeight, '#FAFAF8');
            $pdf->filledRect(14, $y, 2, $cardHeight, self::RED);

            // Foto (si el servidor tiene GD para procesarla)
            $textX = 20.0;
            $imagePath = self::localImagePath($product);
            if ($imagePath && $pdf->image($imagePath, 18, $y + 3, 46, 36)) {
                $textX = 68.0;
            }

            $textWidth = $w - ($textX - 14) - 4;

            $pdf->setFont('B', 10.5);
            $pdf->setTextColor(self::INK);
            $pdf->text($textX, $y + 8, $pdf->truncate((string) $product->name, $textWidth));

            $detail = $product->moto ?? $product->casco ?? $product->repuesto;
            $meta = array_filter([
                'Código: '.$product->code,
                $product->brand?->name,
                $product->moto?->model ? 'Modelo '.$product->moto->model : '',
                $product->moto?->year ? (string) $product->moto->year : '',
                $product->repuesto?->oem_code ? 'OEM '.$product->repuesto->oem_code : '',
            ]);
            $pdf->setFont('', 7.5);
            $pdf->setTextColor(self::GRAY);
            $pdf->text($textX, $y + 13, $pdf->truncate(implode('  ·  ', $meta), $textWidth));

            $description = (string) $product->short_description;
            if ($description !== '') {
                $pdf->setFont('', 8);
                $lineY = $y + 19;
                foreach (array_slice($pdf->wrap($description, $textWidth), 0, 2) as $line) {
                    $pdf->text($textX, $lineY, $line);
                    $lineY += 4;
                }
            }

            $specs = self::specs($product, $detail);
            if ($specs !== []) {
                $pdf->setFont('B', 7.5);
                $pdf->setTextColor(self::DARK);
                $lineY = $y + 30;
                foreach (array_slice($pdf->wrap(implode('   |   ', $specs), $textWidth), 0, 2) as $line) {
                    $pdf->text($textX, $lineY, $line);
                    $lineY += 4.5;
                }
            }

            if ($withPrices && $product->price_visible && $product->final_price > 0) {
                $amount = $product->is_offer && $product->offer_price ? $product->offer_price : $product->final_price;
                $price = ($product->currency === 'USD' ? 'US$ ' : '$ ').number_format((float) $amount, 0, ',', '.');
                $priceWidth = $pdf->textWidth($price, 11, 'B');

                $pdf->filledRect(14 + $w - $priceWidth - 12, $y + $cardHeight - 12, $priceWidth + 8, 9, self::RED);
                $pdf->setFont('B', 11);
                $pdf->setTextColor('#FFFFFF');
                $pdf->text(14 + $w - $priceWidth - 8, $y + $cardHeight - 5.5, $price);
            } else {
                $label = 'Consultar precio';
                $pdf->setFont('B', 8.5);
                $pdf->setTextColor(self::GRAY);
                $pdf->text(14 + $w - $pdf->textWidth($label, 8.5, 'B') - 4, $y + $cardHeight - 5.5, $label);
            }

            $pdf->setY($y + $cardHeight + 4);
        }

        if ($count === 0) {
            $pdf->setFont('', 10);
            $pdf->setTextColor(self::GRAY);
            $pdf->text(14, $pdf->getY() + 10, 'No hay productos que coincidan con la selección.');
        }

        return $pdf;
    }

    /** @return array<int,string> */
    private static function specs(Product $product, mixed $detail): array
    {
        $specs = [];
        if ($product->type === 'moto' && $detail) {
            if ($detail->km !== null && in_array($detail->condition_type, ['usada', 'reacondicionada'], true)) {
                $specs[] = number_format((int) $detail->km, 0, ',', '.').' km';
            }
            if ($detail->displacement_cc) {
                $specs[] = $detail->displacement_cc.' cc';
            }
            if ($detail->power_hp) {
                $specs[] = rtrim(rtrim((string) $detail->power_hp, '0'), '.').' HP';
            }
            if ($detail->transmission) {
                $specs[] = 'Transmisión: '.ucfirst($detail->transmission);
            }
            if ($detail->color) {
                $specs[] = 'Color: '.$detail->color;
            }
            if ($detail->warranty) {
                $specs[] = 'Garantía: '.$detail->warranty;
            }
        } elseif ($product->type === 'casco' && $detail) {
            foreach (['helmet_type' => 'Tipo', 'size' => 'Talle', 'certification' => 'Homologación', 'color' => 'Color'] as $field => $label) {
                if ($detail->{$field}) {
                    $specs[] = $label.': '.ucfirst((string) $detail->{$field});
                }
            }
        } elseif ($product->type === 'repuesto' && $detail) {
            if ($detail->manufacturer) {
                $specs[] = 'Fabricante: '.$detail->manufacturer;
            }
            if ($detail->origin) {
                $specs[] = 'Origen: '.ucfirst($detail->origin);
            }
        }

        return $specs;
    }

    /** Ruta en disco de la foto principal (las URLs públicas apuntan a storage/app/public). */
    private static function localImagePath(Product $product): ?string
    {
        $url = $product->mainImage?->path;
        if (! $url || ! Str::contains($url, '/storage/')) {
            return null;
        }

        $path = storage_path('app/public/'.Str::after($url, '/storage/'));

        return is_file($path) ? $path : null;
    }

    /** @param array<string,string> $company */
    private static function header(Pdf $pdf, array $company, string $documentType, string $number): void
    {
        $w = $pdf->contentWidth();

        $pdf->filledRect(0, 0, $pdf->pageWidth(), 26, self::INK);
        $pdf->filledRect(0, 26, $pdf->pageWidth(), 1.6, self::RED);

        $pdf->setFont('B', 16);
        $pdf->setTextColor('#FFFFFF');
        $pdf->text(14, 14, 'RODADO.');
        $pdf->setFont('', 8);
        $pdf->setTextColor('#9DA0A8');
        $pdf->text(14, 19.5, 'MOTOS · CONCESIONARIO');

        $pdf->setFont('', 7);
        $pdf->setTextColor('#BBBBBB');
        $lines = array_values(array_filter([
            $company['taxid'] !== '' ? 'CUIT '.$company['taxid'] : '',
            $company['address'],
            $company['phone'] !== '' ? 'Tel. '.$company['phone'] : '',
            $company['email'],
        ]));
        $y = 8;
        foreach (array_slice($lines, 0, 4) as $line) {
            $pdf->text($pdf->pageWidth() - 14 - $pdf->textWidth($line, 7), $y, $line);
            $y += 4;
        }

        $y = 34;
        $pdf->setFont('B', 16);
        $pdf->setTextColor(self::INK);
        $pdf->text(14, $y + 2, $documentType);

        $pdf->setFont('B', 12);
        $numberWidth = $pdf->textWidth($number, 12, 'B');
        $pdf->filledRect($pdf->pageWidth() - 14 - $numberWidth - 8, $y - 5, $numberWidth + 8, 9, self::RED);
        $pdf->setTextColor('#FFFFFF');
        $pdf->text($pdf->pageWidth() - 14 - $numberWidth - 4, $y + 1, $number);

        $pdf->setDrawColor('#DDDDDD');
        $pdf->line(14, $y + 6, 14 + $w, $y + 6);
        $pdf->setY($y + 11);
    }

    private static function footer(Pdf $pdf, string $company): void
    {
        $y = $pdf->pageHeight() - 14;
        $pdf->setDrawColor('#DDDDDD');
        $pdf->line(14, $y - 4, $pdf->pageWidth() - 14, $y - 4);
        $pdf->setFont('', 7);
        $pdf->setTextColor(self::GRAY);
        $pdf->text(14, $y, $company.'  ·  Precios y disponibilidad sujetos a cambios sin previo aviso.');
        $page = 'Página '.$pdf->pageNumber();
        $pdf->text($pdf->pageWidth() - 14 - $pdf->textWidth($page, 7), $y, $page);
    }

    private static function companyName(): string
    {
        $name = (string) Setting::get('site_name', '');

        return $name !== '' && $name !== 'Catálogo Motos' ? $name : 'RODADO Motos';
    }

    private static function cellText(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'Sí' : 'No';
        }
        if (is_float($value)) {
            return rtrim(rtrim(number_format($value, 2, ',', '.'), '0'), ',');
        }

        return trim((string) $value);
    }
}
