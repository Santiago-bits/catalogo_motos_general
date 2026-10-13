<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SettingController extends Controller
{
    /**
     * Ajustes editables, agrupados como en el panel de SH.
     * type: text | textarea | email | url | tel | select | bool | image
     */
    public const GROUPS = [
        ['key' => 'marca', 'label' => 'Marca y logo', 'icon' => 'badge-tm', 'settings' => [
            'brand_name' => ['label' => 'Nombre de la marca', 'type' => 'text', 'help' => 'Texto grande del logo. Ej.: JACOB. Vacío = RODADO.'],
            'brand_sub' => ['label' => 'Texto secundario', 'type' => 'text', 'help' => 'Texto chico al lado del nombre. Ej.: MOTOR. Vacío = MOTOS.'],
            'site_logo' => ['label' => 'Imagen del logo', 'type' => 'image', 'help' => 'PNG o SVG con fondo transparente, en versión clara (va sobre fondo oscuro). Para usarla junto al nombre conviene cuadrada (256 × 256 px); como logo completo, horizontal (unos 660 × 144 px).'],
            'logo_mode' => ['label' => 'Cómo se muestra', 'type' => 'select', 'options' => ['' => 'Imagen a la izquierda del nombre', 'imagen' => 'Solo la imagen (logo completo)', 'texto' => 'Solo el nombre'], 'help' => 'Sin imagen cargada se muestra siempre el nombre.'],
        ]],
        ['key' => 'contacto', 'label' => 'Contacto', 'icon' => 'telephone', 'settings' => [
            'contact_address' => ['label' => 'Dirección del showroom', 'type' => 'text', 'help' => 'Se muestra en "Vení a conocerlas" y en Contacto.'],
            'map_link' => ['label' => 'Ubicación en Google Maps', 'type' => 'url', 'help' => 'Pegá el link de "Compartir" de Google Maps (ej.: https://maps.app.goo.gl/...). El mapa del inicio marca ese punto exacto. Vacío = se busca la dirección del showroom.'],
            'contact_phone' => ['label' => 'Teléfono', 'type' => 'tel'],
            'contact_whatsapp' => ['label' => 'WhatsApp', 'type' => 'tel', 'help' => 'Con código de país, sin espacios. Ej.: 5491155555555. Todas las consultas de clientes llegan acá.'],
            'business_hours' => ['label' => 'Horarios', 'type' => 'text', 'help' => 'Ej.: Lunes a viernes 9 a 19 h · Sábados 9 a 13 h'],
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
        ['key' => 'imagenes', 'label' => 'Imágenes del sitio', 'icon' => 'image', 'settings' => [
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

        if (isset($changes['map_link'])) {
            $coords = $this->mapCoordinates(Setting::get('map_link', ''));
            abort_if(Setting::get('map_link') && ! $coords, 422, 'No pude leer la ubicación de ese link. Copiá el link desde "Compartir" en Google Maps.');
            Setting::set('map_coords', $coords);
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
            $mimes = $key === 'site_logo' ? 'mimes:jpg,jpeg,png,webp,svg' : 'mimes:jpg,jpeg,png,webp';
            $request->validate(['image' => ['required', 'file', $mimes, 'max:6144']]);
            $path = $request->file('image')->store('site', 'public');
            $this->deleteStored($old);
            Setting::set($key, Storage::disk('public')->url($path));
        }

        ActivityLog::log($request->user()->id, 'editar', 'Setting', null, "Cambió la imagen \"{$key}\"", 'configuracion');

        return response()->json(['key' => $key, 'value' => Setting::get($key, '')]);
    }

    /**
     * "lat,lng" del punto marcado en un link de Google Maps (sigue los links cortos
     * maps.app.goo.gl hasta la URL completa), o '' si no se encuentra.
     */
    private function mapCoordinates(string $link): string
    {
        if (! preg_match('#^https://(maps\.app\.goo\.gl|goo\.gl/maps|(www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+)/#i', $link)) {
            return '';
        }

        $url = $link;
        for ($i = 0; $i < 5 && preg_match('#^https://(maps\.app\.goo\.gl|goo\.gl)/#i', $url); $i++) {
            try {
                $response = Http::timeout(8)
                    ->withOptions(['allow_redirects' => false, 'verify' => config('services.google.ca_bundle') ?: true])
                    ->get($url);
            } catch (\Throwable) {
                return '';
            }
            $url = (string) $response->header('Location');
            if ($url === '') {
                return '';
            }
        }

        // El pin del lugar (!3d…!4d…) es más preciso que el centro de la vista (@lat,lng).
        foreach (['/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/', '/@(-?\d+\.\d+),(-?\d+\.\d+)/', '/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/'] as $pattern) {
            if (preg_match($pattern, urldecode($url), $m)) {
                return $m[1].','.$m[2];
            }
        }

        return '';
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
