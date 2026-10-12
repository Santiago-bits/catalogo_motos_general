<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SettingController extends Controller
{
    /**
     * Ajustes editables, agrupados como en el panel de SH.
     * type: text | textarea | email | url | tel | select | bool | image
     */
    public const GROUPS = [
        ['key' => 'empresa', 'label' => 'Empresa', 'icon' => 'building', 'settings' => [
            'site_name' => ['label' => 'Nombre del sitio', 'type' => 'text'],
            'legal_name' => ['label' => 'Razón social', 'type' => 'text', 'help' => 'Aparece al pie del sitio.'],
            'legal_cuit' => ['label' => 'CUIT', 'type' => 'text'],
            'business_hours' => ['label' => 'Horarios', 'type' => 'text', 'help' => 'Ej.: Lunes a viernes 9 a 19 h · Sábados 9 a 13 h'],
        ]],
        ['key' => 'marca', 'label' => 'Marca (logo con texto)', 'icon' => 'badge-tm', 'settings' => [
            'logo_mode' => ['label' => 'Qué mostrar como logo', 'type' => 'select', 'options' => ['' => 'Automático (texto si hay nombre cargado)', 'texto' => 'Ícono + nombre', 'imagen' => 'Logo en imagen (Imágenes del sitio)']],
            'brand_name' => ['label' => 'Nombre de la marca', 'type' => 'text', 'help' => 'Texto grande del logo, junto al ícono. Ej.: RODADO. Vacío = RODADO.'],
            'brand_sub' => ['label' => 'Texto secundario', 'type' => 'text', 'help' => 'Texto chico al lado del nombre. Ej.: MOTOS. Vacío = MOTOS.'],
            'brand_icon' => ['label' => 'Ícono (a la izquierda del nombre)', 'type' => 'image', 'help' => 'Imagen cuadrada, ideal 256 × 256 px, PNG o SVG con fondo transparente. Vacío = recuadro rojo con la moto.'],
        ]],
        ['key' => 'contacto', 'label' => 'Contacto', 'icon' => 'telephone', 'settings' => [
            'contact_address' => ['label' => 'Dirección del showroom', 'type' => 'text', 'help' => 'Se usa también para el mapa del inicio.'],
            'contact_phone' => ['label' => 'Teléfono', 'type' => 'tel'],
            'contact_whatsapp' => ['label' => 'WhatsApp', 'type' => 'tel', 'help' => 'Con código de país, sin espacios. Ej.: 5491155555555'],
            'contact_email' => ['label' => 'Email', 'type' => 'email'],
        ]],
        ['key' => 'textos', 'label' => 'Textos del sitio', 'icon' => 'fonts', 'settings' => [
            'hero_text' => ['label' => 'Texto de la portada', 'type' => 'textarea', 'help' => 'Debajo de "Tu próxima moto te está esperando" en el inicio. Vacío = texto por defecto.'],
            'footer_about' => ['label' => 'Texto del pie de página', 'type' => 'textarea', 'help' => 'Debajo del logo, al pie de todas las páginas. Vacío = texto por defecto.'],
        ]],
        ['key' => 'redes', 'label' => 'Redes sociales', 'icon' => 'share', 'settings' => [
            'social_instagram' => ['label' => 'Instagram', 'type' => 'url'],
            'social_facebook' => ['label' => 'Facebook', 'type' => 'url'],
            'social_youtube' => ['label' => 'YouTube', 'type' => 'url'],
            'social_tiktok' => ['label' => 'TikTok', 'type' => 'url', 'help' => 'En el pie se muestra el ícono de cada red con enlace cargado (WhatsApp sale del número de Contacto).'],
        ]],
        ['key' => 'catalogo', 'label' => 'Catálogo y precios', 'icon' => 'tags', 'settings' => [
            'currency_default' => ['label' => 'Moneda por defecto', 'type' => 'select', 'options' => ['ARS' => 'Pesos (ARS)', 'USD' => 'Dólares (USD)']],
            'financing_details' => ['label' => 'Detalle de planes y tasas', 'type' => 'textarea', 'help' => 'Se muestra en la franja de financiación del inicio.'],
        ]],
        ['key' => 'acceso', 'label' => 'Acceso al panel', 'icon' => 'google', 'settings' => [
            'google_client_id' => ['label' => 'Google · ID de cliente OAuth', 'type' => 'text', 'help' => 'Activa "Iniciar sesión con Google" en el login. Se crea en Google Cloud Console → APIs y servicios → Credenciales (tipo "Aplicación web", con el dominio del sitio como origen autorizado). Vacío = desactivado.'],
        ]],
        ['key' => 'imagenes', 'label' => 'Imágenes del sitio', 'icon' => 'image', 'settings' => [
            'site_logo' => ['label' => 'Logo del sitio', 'type' => 'image', 'help' => 'Reemplaza a "RODADO. MOTOS" en el encabezado, el pie, el login y el panel. Ideal PNG o SVG con fondo transparente, en versión clara (va sobre fondo oscuro).'],
            'hero_image' => ['label' => 'Foto de portada', 'type' => 'image', 'help' => 'Horizontal, ideal 1600 × 1200 px.'],
            'service_image' => ['label' => 'Foto del taller', 'type' => 'image'],
            'accessories_image' => ['label' => 'Foto de indumentaria', 'type' => 'image'],
        ]],
    ];

    public function index()
    {
        $values = Setting::all()->pluck('value', 'key');

        return response()->json([
            'groups' => self::GROUPS,
            'values' => $values,
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate(['settings' => ['required', 'array']]);
        $allowed = $this->editableKeys(exceptImages: true);

        $changes = [];
        foreach ($data['settings'] as $key => $value) {
            if (! in_array($key, $allowed, true)) {
                continue;
            }
            $value = is_bool($value) ? ($value ? '1' : '0') : (is_null($value) ? '' : trim((string) $value));
            $old = (string) Setting::get($key, '');
            if ($old !== $value) {
                $changes[$key] = [$old, $value];
                Setting::set((string) $key, $value);
            }
        }

        if ($changes) {
            ActivityLog::log($request->user()->id, 'editar', 'Setting', null, 'Actualizó la configuración', 'configuracion', $changes);
        }

        return Setting::all()->pluck('value', 'key');
    }

    /** Sube (o quita, con remove=1) una de las imágenes del sitio. */
    public function image(Request $request, string $key)
    {
        abort_unless(in_array($key, $this->imageKeys(), true), 404);

        $old = (string) Setting::get($key, '');

        if ($request->boolean('remove')) {
            $this->deleteStored($old);
            Setting::set($key, '');
        } else {
            // El logo puede ser SVG; las fotos, sólo formatos de imagen comunes.
            $mimes = in_array($key, ['site_logo', 'brand_icon'], true) ? 'mimes:jpg,jpeg,png,webp,svg' : 'mimes:jpg,jpeg,png,webp';
            $request->validate(['image' => ['required', 'file', $mimes, 'max:6144']]);
            $path = $request->file('image')->store('site', 'public');
            $this->deleteStored($old);
            Setting::set($key, Storage::disk('public')->url($path));
        }

        ActivityLog::log($request->user()->id, 'editar', 'Setting', null, "Cambió la imagen \"{$key}\"", 'configuracion');

        return response()->json(['key' => $key, 'value' => Setting::get($key, '')]);
    }

    /** @return array<int,string> */
    private function editableKeys(bool $exceptImages = false): array
    {
        $keys = [];
        foreach (self::GROUPS as $group) {
            foreach ($group['settings'] as $key => $def) {
                if (! $exceptImages || $def['type'] !== 'image') {
                    $keys[] = $key;
                }
            }
        }

        return $keys;
    }

    /** @return array<int,string> */
    private function imageKeys(): array
    {
        return array_values(array_diff($this->editableKeys(), $this->editableKeys(exceptImages: true)));
    }

    private function deleteStored(string $url): void
    {
        if (Str::contains($url, '/storage/site/')) {
            Storage::disk('public')->delete(Str::after($url, '/storage/'));
        }
    }
}
