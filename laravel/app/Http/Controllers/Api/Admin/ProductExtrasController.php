<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\ProductDocument;
use App\Models\ProductVideo;
use App\Models\RepuestoCode;
use App\Models\RepuestoCompatibility;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Lo que cuelga de un producto ya guardado: documentación, videos y,
 * en los repuestos, códigos alternativos y modelos compatibles.
 */
class ProductExtrasController extends Controller
{
    // ------------------------------------------------------------------
    // Documentación (PDF de ficha técnica, manual, garantía…)
    // ------------------------------------------------------------------
    public function storeDocument(Request $request, Product $product)
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:20480', 'mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png,webp,zip'],
            'title' => ['nullable', 'string', 'max:160'],
            'kind' => ['nullable', 'in:'.implode(',', array_keys(ProductDocument::KINDS))],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $file = $request->file('file');
        $document = $product->documents()->create([
            'title' => $data['title'] ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            'kind' => $data['kind'] ?? 'ficha',
            'path' => $file->store('products/documents', 'public'),
            'original_name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'is_public' => $request->boolean('is_public', true),
        ]);

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Adjuntó el documento \"{$document->title}\" a \"{$product->name}\"");

        return response()->json($this->documentPayload($document), 201);
    }

    public function destroyDocument(Request $request, Product $product, ProductDocument $document)
    {
        abort_unless($document->product_id === $product->id, 404);

        Storage::disk('public')->delete($document->path);
        $document->delete();

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Quitó el documento \"{$document->title}\" de \"{$product->name}\"");

        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------
    // Videos: enlace de YouTube/Vimeo o archivo subido
    // ------------------------------------------------------------------
    public function storeVideo(Request $request, Product $product)
    {
        $data = $request->validate([
            'url' => ['nullable', 'required_without:file', 'url', 'max:255', 'regex:/(youtube\.com|youtu\.be|vimeo\.com)/i'],
            'file' => ['nullable', 'required_without:url', 'file', 'max:102400', 'mimetypes:video/mp4,video/webm,video/quicktime'],
            'title' => ['nullable', 'string', 'max:160'],
        ], [
            'url.regex' => 'El enlace tiene que ser de YouTube o Vimeo.',
            'url.required_without' => 'Pegá un enlace o elegí un archivo de video.',
        ]);

        $video = $product->videos()->create([
            'title' => $data['title'] ?? null,
            'url' => $request->hasFile('file') ? null : $data['url'],
            'path' => $request->hasFile('file') ? $request->file('file')->store('products/videos', 'public') : null,
            'sort_order' => $product->videos()->count(),
        ]);

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Agregó un video a \"{$product->name}\"");

        return response()->json([
            'id' => $video->id,
            'title' => $video->title,
            'url' => $video->path ? Storage::disk('public')->url($video->path) : $video->url,
            'is_file' => $video->path !== null,
        ], 201);
    }

    public function destroyVideo(Request $request, Product $product, ProductVideo $video)
    {
        abort_unless($video->product_id === $product->id, 404);

        if ($video->path) {
            Storage::disk('public')->delete($video->path);
        }
        $video->delete();

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Quitó un video de \"{$product->name}\"");

        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------
    // Repuestos: códigos alternativos y compatibilidad
    // ------------------------------------------------------------------
    public function storeCode(Request $request, Product $product)
    {
        abort_unless($product->type === 'repuesto', 422, 'Sólo los repuestos tienen códigos alternativos.');

        $data = $request->validate([
            'code_type' => ['required', 'in:'.implode(',', array_keys(RepuestoCode::TYPES))],
            'code' => ['required', 'string', 'max:80'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'note' => ['nullable', 'string', 'max:160'],
        ]);

        $code = $product->codes()->create($data);
        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Agregó el código {$code->code} a \"{$product->name}\"");

        return response()->json($code->load('brand:id,name'), 201);
    }

    public function destroyCode(Request $request, Product $product, RepuestoCode $code)
    {
        abort_unless($code->product_id === $product->id, 404);
        $code->delete();

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Quitó el código {$code->code} de \"{$product->name}\"");

        return response()->json(['ok' => true]);
    }

    public function storeCompatibility(Request $request, Product $product)
    {
        abort_unless($product->type === 'repuesto', 422, 'Sólo los repuestos tienen compatibilidad.');

        $data = $request->validate([
            'brand_id' => ['nullable', 'exists:brands,id'],
            'model' => ['required', 'string', 'max:120'],
            'year_from' => ['nullable', 'integer', 'between:1950,2100'],
            'year_to' => ['nullable', 'integer', 'between:1950,2100', 'gte:year_from'],
            'note' => ['nullable', 'string', 'max:200'],
        ]);

        $compat = $product->compatibilities()->create($data);
        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Agregó la compatibilidad con {$compat->model} a \"{$product->name}\"");

        return response()->json($compat->load('brand:id,name'), 201);
    }

    public function destroyCompatibility(Request $request, Product $product, RepuestoCompatibility $compatibility)
    {
        abort_unless($compatibility->repuesto_id === $product->id, 404);
        $compatibility->delete();

        ActivityLog::log($request->user()->id, 'editar', 'Product', $product->id, "Quitó la compatibilidad con {$compatibility->model} de \"{$product->name}\"");

        return response()->json(['ok' => true]);
    }

    private function documentPayload(ProductDocument $doc): array
    {
        return [
            'id' => $doc->id,
            'title' => $doc->title,
            'kind' => $doc->kind,
            'url' => Storage::disk('public')->url($doc->path),
            'original_name' => $doc->original_name,
            'size' => $doc->size,
            'is_public' => $doc->is_public,
            'created_at' => $doc->created_at,
        ];
    }
}
