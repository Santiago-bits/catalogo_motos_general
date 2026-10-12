<?php
/**
 * ARCHIVO: app/Support/Xlsx.php (portado de SH Servicios, lib/Xlsx.php)
 * ---------------------------------------------------------------------
 * Escritor de archivos .xlsx sin dependencias externas (usa la
 * extensión zip, incluida en XAMPP). Genera una planilla con encabezado
 * con formato, anchos de columna y tipos numéricos correctos.
 */

declare(strict_types=1);

namespace App\Support;

use ZipArchive;

class Xlsx
{
    /** @var array<int,string> */
    private array $headers = [];
    /** @var array<int,array<int,mixed>> */
    private array $rows = [];
    /** @var array<int,float> */
    private array $widths = [];

    private string $sheetName = 'Datos';

    public function __construct(string $sheetName = 'Datos')
    {
        $this->sheetName = mb_substr(preg_replace('/[\\\\\/\?\*\[\]:]/', '', $sheetName) ?: 'Datos', 0, 31);
    }

    /** @param array<int,string> $headers */
    public function setHeaders(array $headers): void
    {
        $this->headers = array_values($headers);

        foreach ($this->headers as $i => $header) {
            $this->widths[$i] = max($this->widths[$i] ?? 10, min(50, mb_strlen($header) + 4));
        }
    }

    /** @param array<int,mixed> $row */
    public function addRow(array $row): void
    {
        $row = array_values($row);
        $this->rows[] = $row;

        foreach ($row as $i => $value) {
            $length = mb_strlen((string) $value);
            $this->widths[$i] = max($this->widths[$i] ?? 10, min(60, $length + 3));
        }
    }

    /** @param array<int,array<int,mixed>> $rows */
    public function addRows(array $rows): void
    {
        foreach ($rows as $row) {
            $this->addRow($row);
        }
    }

    public function save(string $path): bool
    {
        $zip = new ZipArchive();

        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        $zip->addFromString('[Content_Types].xml', $this->contentTypes());
        $zip->addFromString('_rels/.rels', $this->rels());
        $zip->addFromString('xl/workbook.xml', $this->workbook());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRels());
        $zip->addFromString('xl/styles.xml', $this->styles());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->sheet());

        return $zip->close();
    }

    public function output(): string
    {
        $temp = tempnam(sys_get_temp_dir(), 'xlsx');
        $this->save($temp);
        $content = (string) file_get_contents($temp);
        @unlink($temp);
        return $content;
    }

    public function stream(string $filename): never
    {
        $content = $this->output();

        if (!headers_sent()) {
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($content));
        }

        echo $content;
        exit;
    }

    // ----------------------------------------------------------------
    // Partes del archivo
    // ----------------------------------------------------------------

    private function contentTypes(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>';
    }

    private function rels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
    }

    private function workbook(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . $this->escape($this->sheetName) . '" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>';
    }

    private function workbookRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>';
    }

    private function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2">'
            . '<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>'
            . '<font><b/><sz val="11"/><color rgb="FF111111"/><name val="Calibri"/></font>'
            . '</fonts>'
            . '<fills count="3">'
            . '<fill><patternFill patternType="none"/></fill>'
            . '<fill><patternFill patternType="gray125"/></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFF5C400"/><bgColor indexed="64"/></patternFill></fill>'
            . '</fills>'
            . '<borders count="2">'
            . '<border><left/><right/><top/><bottom/><diagonal/></border>'
            . '<border><left style="thin"><color rgb="FFDDDDDD"/></left><right style="thin"><color rgb="FFDDDDDD"/></right>'
            . '<top style="thin"><color rgb="FFDDDDDD"/></top><bottom style="thin"><color rgb="FFDDDDDD"/></bottom><diagonal/></border>'
            . '</borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="3">'
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            . '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">'
            . '<alignment vertical="center"/></xf>'
            . '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            . '</cellXfs>'
            . '</styleSheet>';
    }

    private function sheet(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

        // Anchos de columna
        if ($this->widths !== []) {
            $xml .= '<cols>';
            foreach ($this->widths as $i => $width) {
                $xml .= sprintf('<col min="%d" max="%d" width="%.1F" customWidth="1"/>', $i + 1, $i + 1, $width);
            }
            $xml .= '</cols>';
        }

        $xml .= '<sheetData>';

        $rowNumber = 1;

        if ($this->headers !== []) {
            $xml .= '<row r="1" ht="22" customHeight="1">';
            foreach ($this->headers as $i => $header) {
                $xml .= sprintf(
                    '<c r="%s1" s="1" t="inlineStr"><is><t>%s</t></is></c>',
                    $this->columnName($i),
                    $this->escape((string) $header)
                );
            }
            $xml .= '</row>';
            $rowNumber = 2;
        }

        foreach ($this->rows as $row) {
            $xml .= '<row r="' . $rowNumber . '">';

            foreach ($row as $i => $value) {
                $cell = $this->columnName($i) . $rowNumber;

                if ($value === null || $value === '') {
                    continue;
                }

                if (is_int($value) || is_float($value)) {
                    $xml .= sprintf('<c r="%s" s="2"><v>%s</v></c>', $cell, (string) $value);
                } else {
                    $xml .= sprintf(
                        '<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>',
                        $cell,
                        $this->escape((string) $value)
                    );
                }
            }

            $xml .= '</row>';
            $rowNumber++;
        }

        return $xml . '</sheetData></worksheet>';
    }

    private function columnName(int $index): string
    {
        $name = '';
        $index++;

        while ($index > 0) {
            $mod   = ($index - 1) % 26;
            $name  = chr(65 + $mod) . $name;
            $index = (int) (($index - $mod) / 26);
        }

        return $name;
    }

    private function escape(string $text): string
    {
        // Se quitan caracteres de control no válidos en XML
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $text) ?? $text;
        return htmlspecialchars($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
