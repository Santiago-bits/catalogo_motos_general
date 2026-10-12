<?php
/**
 * ARCHIVO: app/Support/Pdf.php (portado de SH Servicios, lib/Pdf.php)
 * ---------------------------------------------------------------------
 * Generador de PDF propio, sin dependencias externas ni Composer.
 *
 * Soporta lo que el sistema necesita: texto (Helvetica normal/negrita),
 * colores, líneas, rectángulos, tablas, saltos de página automáticos e
 * imágenes JPEG/PNG (se normalizan con GD antes de incrustarlas).
 *
 * Unidades: milímetros. Origen de coordenadas: esquina superior
 * izquierda (como se piensa una hoja, no como lo hace PostScript).
 */

declare(strict_types=1);

namespace App\Support;

class Pdf
{
    private const MM_TO_PT = 2.834645669;

    /** Anchos de caracteres (unidades/1000) de las fuentes base. */
    private const WIDTHS_REGULAR = [
        32=>278,33=>278,34=>355,35=>556,36=>556,37=>889,38=>667,39=>191,40=>333,41=>333,
        42=>389,43=>584,44=>278,45=>333,46=>278,47=>278,48=>556,49=>556,50=>556,51=>556,
        52=>556,53=>556,54=>556,55=>556,56=>556,57=>556,58=>278,59=>278,60=>584,61=>584,
        62=>584,63=>556,64=>1015,65=>667,66=>667,67=>722,68=>722,69=>667,70=>611,71=>778,
        72=>722,73=>278,74=>500,75=>667,76=>556,77=>833,78=>722,79=>778,80=>667,81=>778,
        82=>722,83=>667,84=>611,85=>722,86=>667,87=>944,88=>667,89=>667,90=>611,91=>278,
        92=>278,93=>278,94=>469,95=>556,96=>333,97=>556,98=>556,99=>500,100=>556,101=>556,
        102=>278,103=>556,104=>556,105=>222,106=>222,107=>500,108=>222,109=>833,110=>556,
        111=>556,112=>556,113=>556,114=>333,115=>500,116=>278,117=>556,118=>500,119=>722,
        120=>500,121=>500,122=>500,123=>334,124=>260,125=>334,126=>584,
    ];

    private const WIDTHS_BOLD = [
        32=>278,33=>333,34=>474,35=>556,36=>556,37=>889,38=>722,39=>238,40=>333,41=>333,
        42=>389,43=>584,44=>278,45=>333,46=>278,47=>278,48=>556,49=>556,50=>556,51=>556,
        52=>556,53=>556,54=>556,55=>556,56=>556,57=>556,58=>333,59=>333,60=>584,61=>584,
        62=>584,63=>611,64=>975,65=>722,66=>722,67=>722,68=>722,69=>667,70=>611,71=>778,
        72=>722,73=>278,74=>556,75=>722,76=>611,77=>833,78=>722,79=>778,80=>667,81=>778,
        82=>722,83=>667,84=>611,85=>722,86=>667,87=>944,88=>667,89=>667,90=>611,91=>333,
        92=>278,93=>333,94=>584,95=>556,96=>333,97=>556,98=>611,99=>556,100=>611,101=>556,
        102=>333,103=>611,104=>611,105=>278,106=>278,107=>556,108=>278,109=>889,110=>611,
        111=>611,112=>611,113=>611,114=>389,115=>556,116=>333,117=>611,118=>556,119=>778,
        120=>556,121=>556,122=>500,123=>389,124=>280,125=>389,126=>584,
    ];

    private float $pageWidth  = 210.0;   // A4
    private float $pageHeight = 297.0;

    public float $marginLeft   = 15.0;
    public float $marginRight  = 15.0;
    public float $marginTop    = 15.0;
    public float $marginBottom = 18.0;

    private float $y = 15.0;

    /** @var array<int,string> Contenido de cada página */
    private array $pages = [];
    private int $current = -1;

    private string $fontFamily = 'F1';
    private float $fontSize    = 10.0;
    /** @var array{0:float,1:float,2:float} */
    private array $textColor = [0, 0, 0];
    private array $fillColor = [1, 1, 1];
    private array $drawColor = [0, 0, 0];

    /** @var array<string,array{data:string,w:int,h:int,index:int}> */
    private array $images = [];

    /** @var callable|null */
    private $headerCallback = null;
    /** @var callable|null */
    private $footerCallback = null;

    private string $title  = '';
    private string $author = '';

    public function __construct(string $orientation = 'P')
    {
        if (strtoupper($orientation) === 'L') {
            [$this->pageWidth, $this->pageHeight] = [$this->pageHeight, $this->pageWidth];
        }
    }

    // ----------------------------------------------------------------
    // Configuración
    // ----------------------------------------------------------------

    public function setMeta(string $title, string $author = ''): void
    {
        $this->title  = $title;
        $this->author = $author;
    }

    public function setHeader(?callable $callback): void
    {
        $this->headerCallback = $callback;
    }

    public function setFooter(?callable $callback): void
    {
        $this->footerCallback = $callback;
    }

    public function setMargins(float $left, float $top, float $right, float $bottom): void
    {
        $this->marginLeft   = $left;
        $this->marginTop    = $top;
        $this->marginRight  = $right;
        $this->marginBottom = $bottom;
    }

    public function pageWidth(): float
    {
        return $this->pageWidth;
    }

    public function pageHeight(): float
    {
        return $this->pageHeight;
    }

    public function contentWidth(): float
    {
        return $this->pageWidth - $this->marginLeft - $this->marginRight;
    }

    public function getY(): float
    {
        return $this->y;
    }

    public function setY(float $y): void
    {
        $this->y = $y;
    }

    public function moveY(float $delta): void
    {
        $this->y += $delta;
    }

    public function pageNumber(): int
    {
        return $this->current + 1;
    }

    public function pageCount(): int
    {
        return count($this->pages);
    }

    // ----------------------------------------------------------------
    // Páginas
    // ----------------------------------------------------------------

    public function addPage(): void
    {
        $this->pages[] = '';
        $this->current = count($this->pages) - 1;
        $this->y = $this->marginTop;

        // Se reaplican los estados gráficos en la página nueva
        $this->applyFillColor();
        $this->applyDrawColor();

        if ($this->headerCallback !== null) {
            ($this->headerCallback)($this);
        }
    }

    /** Agrega una página si no entra el alto indicado. */
    public function ensureSpace(float $height): void
    {
        if ($this->current < 0) {
            $this->addPage();
            return;
        }
        if (($this->y + $height) > ($this->pageHeight - $this->marginBottom)) {
            $this->finishPage();
            $this->addPage();
        }
    }

    private function finishPage(): void
    {
        if ($this->footerCallback !== null) {
            ($this->footerCallback)($this);
        }
    }

    // ----------------------------------------------------------------
    // Estilos
    // ----------------------------------------------------------------

    public function setFont(string $style = '', float $size = 0): void
    {
        $this->fontFamily = str_contains(strtoupper($style), 'B') ? 'F2' : 'F1';
        if ($size > 0) {
            $this->fontSize = $size;
        }
    }

    /** @param array{0:int,1:int,2:int}|string $color RGB 0-255 o "#RRGGBB" */
    public function setTextColor(array|string $color): void
    {
        $this->textColor = $this->normalizeColor($color);
    }

    public function setFillColor(array|string $color): void
    {
        $this->fillColor = $this->normalizeColor($color);
        $this->applyFillColor();
    }

    public function setDrawColor(array|string $color): void
    {
        $this->drawColor = $this->normalizeColor($color);
        $this->applyDrawColor();
    }

    /** @return array{0:float,1:float,2:float} */
    private function normalizeColor(array|string $color): array
    {
        if (is_string($color)) {
            $hex = ltrim($color, '#');
            if (strlen($hex) === 3) {
                $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
            }
            $color = [
                (int) hexdec(substr($hex, 0, 2)),
                (int) hexdec(substr($hex, 2, 2)),
                (int) hexdec(substr($hex, 4, 2)),
            ];
        }

        return [
            max(0, min(255, (int) ($color[0] ?? 0))) / 255,
            max(0, min(255, (int) ($color[1] ?? 0))) / 255,
            max(0, min(255, (int) ($color[2] ?? 0))) / 255,
        ];
    }

    private function applyFillColor(): void
    {
        $this->out(sprintf('%.3F %.3F %.3F rg', ...$this->fillColor));
    }

    private function applyDrawColor(): void
    {
        $this->out(sprintf('%.3F %.3F %.3F RG', ...$this->drawColor));
    }

    // ----------------------------------------------------------------
    // Dibujo
    // ----------------------------------------------------------------

    public function line(float $x1, float $y1, float $x2, float $y2): void
    {
        $this->out(sprintf(
            '%.2F %.2F m %.2F %.2F l S',
            $x1 * self::MM_TO_PT,
            ($this->pageHeight - $y1) * self::MM_TO_PT,
            $x2 * self::MM_TO_PT,
            ($this->pageHeight - $y2) * self::MM_TO_PT
        ));
    }

    public function rect(float $x, float $y, float $w, float $h, string $style = 'F'): void
    {
        $op = match (strtoupper($style)) {
            'F'  => 'f',
            'D'  => 'S',
            'FD', 'DF' => 'B',
            default => 'f',
        };

        $this->out(sprintf(
            '%.2F %.2F %.2F %.2F re %s',
            $x * self::MM_TO_PT,
            ($this->pageHeight - $y - $h) * self::MM_TO_PT,
            $w * self::MM_TO_PT,
            $h * self::MM_TO_PT,
            $op
        ));
    }

    /** Rectángulo con color de relleno puntual (no cambia el estado). */
    public function filledRect(float $x, float $y, float $w, float $h, array|string $color): void
    {
        $previous = $this->fillColor;
        $this->setFillColor($color);
        $this->rect($x, $y, $w, $h, 'F');
        $this->fillColor = $previous;
        $this->applyFillColor();
    }

    // ----------------------------------------------------------------
    // Texto
    // ----------------------------------------------------------------

    public function textWidth(string $text, ?float $size = null, ?string $style = null): float
    {
        $size  = $size ?? $this->fontSize;
        $bold  = $style !== null ? str_contains(strtoupper($style), 'B') : $this->fontFamily === 'F2';
        $table = $bold ? self::WIDTHS_BOLD : self::WIDTHS_REGULAR;

        $encoded = $this->encode($text);
        $width   = 0;

        for ($i = 0, $len = strlen($encoded); $i < $len; $i++) {
            $code   = ord($encoded[$i]);
            $width += $table[$code] ?? 556;
        }

        return ($width / 1000) * $size / self::MM_TO_PT;
    }

    /** Escribe una línea de texto en la posición indicada. */
    public function text(float $x, float $y, string $text): void
    {
        $this->out(sprintf(
            'BT /%s %.2F Tf %.3F %.3F %.3F rg %.2F %.2F Td (%s) Tj ET',
            $this->fontFamily,
            $this->fontSize,
            $this->textColor[0],
            $this->textColor[1],
            $this->textColor[2],
            $x * self::MM_TO_PT,
            ($this->pageHeight - $y) * self::MM_TO_PT,
            $this->escape($text)
        ));
    }

    /**
     * Celda de texto con alineación y borde opcional.
     *
     * @param string $align L | C | R
     */
    public function cell(float $x, float $y, float $w, float $h, string $text, string $align = 'L', ?array $fill = null, bool $border = false, float $padding = 1.5): void
    {
        if ($fill !== null) {
            $this->filledRect($x, $y, $w, $h, $fill);
        }
        if ($border) {
            $this->rect($x, $y, $w, $h, 'D');
        }

        $textWidth = $this->textWidth($text);

        $textX = match ($align) {
            'C' => $x + ($w - $textWidth) / 2,
            'R' => $x + $w - $textWidth - $padding,
            default => $x + $padding,
        };

        // Línea base centrada verticalmente
        $textY = $y + ($h / 2) + ($this->fontSize / self::MM_TO_PT) * 0.35;

        $this->text($textX, $textY, $text);
    }

    /** @return array<int,string> */
    public function wrap(string $text, float $maxWidth): array
    {
        $text  = str_replace(["\r\n", "\r"], "\n", $text);
        $lines = [];

        foreach (explode("\n", $text) as $paragraph) {
            $words   = preg_split('/\s+/', trim($paragraph)) ?: [];
            $current = '';

            foreach ($words as $word) {
                if ($word === '') {
                    continue;
                }
                $candidate = $current === '' ? $word : $current . ' ' . $word;

                if ($this->textWidth($candidate) <= $maxWidth) {
                    $current = $candidate;
                    continue;
                }

                if ($current !== '') {
                    $lines[] = $current;
                }

                // Palabra sola más ancha que la celda: se corta por letras
                while ($this->textWidth($word) > $maxWidth && mb_strlen($word) > 1) {
                    $cut = mb_strlen($word);
                    while ($cut > 1 && $this->textWidth(mb_substr($word, 0, $cut)) > $maxWidth) {
                        $cut--;
                    }
                    $lines[] = mb_substr($word, 0, $cut);
                    $word    = mb_substr($word, $cut);
                }
                $current = $word;
            }

            $lines[] = $current;
        }

        return $lines;
    }

    /** Texto recortado con puntos suspensivos si no entra. */
    public function truncate(string $text, float $maxWidth): string
    {
        if ($this->textWidth($text) <= $maxWidth) {
            return $text;
        }
        while (mb_strlen($text) > 1 && $this->textWidth($text . '...') > $maxWidth) {
            $text = mb_substr($text, 0, -1);
        }
        return rtrim($text) . '...';
    }

    // ----------------------------------------------------------------
    // Imágenes
    // ----------------------------------------------------------------

    /**
     * Inserta una imagen. Cualquier formato soportado por GD se
     * convierte a JPEG antes de incrustarlo.
     */
    public function image(string $file, float $x, float $y, float $w, float $h = 0): bool
    {
        // Sin GD no se pueden incrustar imágenes: el PDF se genera igual,
        // sólo que sin fotos. Nunca falla por esto.
        if (!is_file($file) || !extension_loaded('gd') || !function_exists('imagecreatetruecolor')) {
            return false;
        }

        // Clave de caché interna (no es un hash de seguridad).
        $key = hash('crc32b', $file . '|' . (string) filemtime($file));

        if (!isset($this->images[$key])) {
            $info = @getimagesize($file);
            if ($info === false) {
                return false;
            }

            $source = match ($info[2]) {
                IMAGETYPE_JPEG => @imagecreatefromjpeg($file),
                IMAGETYPE_PNG  => @imagecreatefrompng($file),
                IMAGETYPE_WEBP => @imagecreatefromwebp($file),
                IMAGETYPE_GIF  => @imagecreatefromgif($file),
                default        => false,
            };

            if ($source === false) {
                return false;
            }

            // Se limita la resolución para no inflar el PDF
            $maxPx  = 1200;
            $width  = imagesx($source);
            $height = imagesy($source);
            $ratio  = $width > $maxPx ? $maxPx / $width : 1.0;
            $newW   = max(1, (int) round($width * $ratio));
            $newH   = max(1, (int) round($height * $ratio));

            $canvas = imagecreatetruecolor($newW, $newH);
            $white  = imagecolorallocate($canvas, 255, 255, 255);
            imagefilledrectangle($canvas, 0, 0, $newW, $newH, $white);
            imagecopyresampled($canvas, $source, 0, 0, 0, 0, $newW, $newH, $width, $height);

            ob_start();
            imagejpeg($canvas, null, 85);
            $data = (string) ob_get_clean();

            imagedestroy($canvas);
            imagedestroy($source);

            $this->images[$key] = [
                'data'  => $data,
                'w'     => $newW,
                'h'     => $newH,
                'index' => count($this->images) + 1,
            ];
        }

        $image = $this->images[$key];

        if ($h <= 0) {
            $h = $w * ($image['h'] / $image['w']);
        }

        $this->out(sprintf(
            'q %.2F 0 0 %.2F %.2F %.2F cm /I%d Do Q',
            $w * self::MM_TO_PT,
            $h * self::MM_TO_PT,
            $x * self::MM_TO_PT,
            ($this->pageHeight - $y - $h) * self::MM_TO_PT,
            $image['index']
        ));

        return true;
    }

    // ----------------------------------------------------------------
    // Salida
    // ----------------------------------------------------------------

    public function output(): string
    {
        if ($this->current >= 0) {
            $this->finishPage();
        }
        if ($this->pages === []) {
            $this->addPage();
        }

        $objects   = [];
        $pageCount = count($this->pages);

        // 1 Catalog · 2 Pages · 3..(2+n) Page · (3+n).. Contents
        $kids = [];
        for ($i = 0; $i < $pageCount; $i++) {
            $kids[] = (3 + $i) . ' 0 R';
        }

        $fontRegular = 3 + ($pageCount * 2);
        $fontBold    = $fontRegular + 1;
        $imageBase   = $fontBold + 1;

        $imageRefs = '';
        foreach ($this->images as $image) {
            $imageRefs .= sprintf('/I%d %d 0 R ', $image['index'], $imageBase + $image['index'] - 1);
        }

        $resources = sprintf(
            '<< /Font << /F1 %d 0 R /F2 %d 0 R >> %s/ProcSet [/PDF /Text /ImageC] >>',
            $fontRegular,
            $fontBold,
            $imageRefs === '' ? '' : '/XObject << ' . $imageRefs . '>> '
        );

        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objects[2] = sprintf(
            '<< /Type /Pages /Kids [%s] /Count %d /MediaBox [0 0 %.2F %.2F] >>',
            implode(' ', $kids),
            $pageCount,
            $this->pageWidth * self::MM_TO_PT,
            $this->pageHeight * self::MM_TO_PT
        );

        foreach ($this->pages as $i => $content) {
            $contentId = 3 + $pageCount + $i;

            $objects[3 + $i] = sprintf(
                '<< /Type /Page /Parent 2 0 R /Resources %s /Contents %d 0 R >>',
                $resources,
                $contentId
            );

            $objects[$contentId] = sprintf(
                "<< /Length %d >>\nstream\n%s\nendstream",
                strlen($content) + 1,
                $content
            );
        }

        $objects[$fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[$fontBold]    = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

        foreach ($this->images as $image) {
            $objects[$imageBase + $image['index'] - 1] = sprintf(
                "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
                $image['w'],
                $image['h'],
                strlen($image['data']),
                $image['data']
            );
        }

        // Información del documento
        $infoId = max(array_keys($objects)) + 1;
        $objects[$infoId] = sprintf(
            '<< /Title (%s) /Author (%s) /Producer (RODADO Motos) /CreationDate (D:%s) >>',
            $this->escape($this->title),
            $this->escape($this->author),
            date('YmdHis')
        );

        ksort($objects);

        $pdf     = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];

        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= $id . " 0 obj\n" . $body . "\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $maxId      = max(array_keys($objects));

        $pdf .= "xref\n0 " . ($maxId + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $maxId; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i] ?? 0);
        }

        $pdf .= sprintf(
            "trailer\n<< /Size %d /Root 1 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF",
            $maxId + 1,
            $infoId,
            $xrefOffset
        );

        return $pdf;
    }

    public function save(string $path): bool
    {
        return file_put_contents($path, $this->output()) !== false;
    }

    /** Envía el PDF al navegador. */
    public function stream(string $filename, bool $download = false): never
    {
        $content = $this->output();

        if (!headers_sent()) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($content));
            header('Cache-Control: private, max-age=0, must-revalidate');
        }

        echo $content;
        exit;
    }

    // ----------------------------------------------------------------
    // Internos
    // ----------------------------------------------------------------

    private function out(string $command): void
    {
        if ($this->current < 0) {
            $this->addPage();
        }
        $this->pages[$this->current] .= $command . "\n";
    }

    private function encode(string $text): string
    {
        $converted = @iconv('UTF-8', 'CP1252//TRANSLIT//IGNORE', $text);
        return $converted === false ? $text : $converted;
    }

    private function escape(string $text): string
    {
        return str_replace(['\\', '(', ')', "\r"], ['\\\\', '\\(', '\\)', ''], $this->encode($text));
    }
}
