<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Verifica el "ID token" que entrega el botón "Iniciar sesión con Google"
 * (Google Identity Services) en el login del panel. Portado de SH Servicios:
 * la firma RS256 se valida con openssl contra las claves públicas de Google.
 *
 * Esto NO loguea a nadie por sí solo: sólo confirma "esta persona es dueña
 * de este email, según Google". Quién puede entrar lo decide el login
 * (sólo emails que ya son usuarios activos del panel).
 */
class GoogleAuthService
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    private const CACHE_KEY = 'google-jwks';

    public static function clientId(): string
    {
        return trim((string) (Setting::get('google_client_id', '') ?: config('services.google.client_id', '')));
    }

    public static function isConfigured(): bool
    {
        return self::clientId() !== '';
    }

    /**
     * Devuelve los datos de la cuenta si el token es válido y corresponde a este
     * sitio, o null si algo no cierra (firma, vencimiento, otra app, email sin verificar).
     *
     * @return array{email:string,name:string}|null
     */
    public static function verifyIdToken(string $idToken): ?array
    {
        $clientId = self::clientId();
        $parts = explode('.', $idToken);
        if ($clientId === '' || count($parts) !== 3) {
            return null;
        }
        [$headerB64, $payloadB64, $sigB64] = $parts;

        $header = json_decode(self::base64UrlDecode($headerB64), true);
        $payload = json_decode(self::base64UrlDecode($payloadB64), true);
        $signature = self::base64UrlDecode($sigB64);

        if (! is_array($header) || ! is_array($payload) || $signature === '' || ($header['alg'] ?? '') !== 'RS256') {
            return null;
        }

        $jwk = self::findKey((string) ($header['kid'] ?? ''));
        $pem = $jwk ? self::jwkToPem($jwk) : null;
        $publicKey = $pem ? openssl_pkey_get_public($pem) : false;
        if ($publicKey === false) {
            return null;
        }

        if (openssl_verify($headerB64.'.'.$payloadB64, $signature, $publicKey, OPENSSL_ALGO_SHA256) !== 1) {
            return null;
        }

        if (! in_array((string) ($payload['iss'] ?? ''), ['https://accounts.google.com', 'accounts.google.com'], true)) {
            return null;
        }
        if ((string) ($payload['aud'] ?? '') !== $clientId || (int) ($payload['exp'] ?? 0) <= time()) {
            return null;
        }

        $verified = $payload['email_verified'] ?? false;
        if ($verified !== true && $verified !== 'true') {
            return null;
        }

        $email = mb_strtolower(trim((string) ($payload['email'] ?? '')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return ['email' => $email, 'name' => trim((string) ($payload['name'] ?? ''))];
    }

    // -----------------------------------------------------------------
    // Claves públicas de Google (JWKS), cacheadas una hora
    // -----------------------------------------------------------------

    private static function findKey(string $kid): ?array
    {
        if ($kid === '') {
            return null;
        }

        foreach (self::keys() as $key) {
            if (is_array($key) && ($key['kid'] ?? '') === $kid) {
                return $key;
            }
        }

        // Google rota las claves: si no está, se fuerza una descarga nueva.
        Cache::forget(self::CACHE_KEY);
        foreach (self::keys() as $key) {
            if (is_array($key) && ($key['kid'] ?? '') === $kid) {
                return $key;
            }
        }

        return null;
    }

    private static function keys(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && $cached !== []) {
            return $cached;
        }

        try {
            $caBundle = config('services.google.ca_bundle');
            $http = Http::timeout(8);
            if ($caBundle && is_file($caBundle)) {
                $http = $http->withOptions(['verify' => $caBundle]);
            }
            $response = $http->get(self::JWKS_URL);
            $keys = $response->ok() ? ($response->json('keys') ?? []) : [];
        } catch (\Throwable $e) {
            report($e);
            $keys = [];
        }

        // Sólo se cachea una respuesta válida: si falló, se reintenta en el próximo login.
        if ($keys !== []) {
            Cache::put(self::CACHE_KEY, $keys, 3600);
        }

        return $keys;
    }

    // -----------------------------------------------------------------
    // JWK (RSA) → PEM, y utilidades base64url / DER
    // -----------------------------------------------------------------

    private static function jwkToPem(array $jwk): ?string
    {
        if (($jwk['kty'] ?? '') !== 'RSA' || ! isset($jwk['n'], $jwk['e'])) {
            return null;
        }

        $modulus = self::base64UrlDecode((string) $jwk['n']);
        $exponent = self::base64UrlDecode((string) $jwk['e']);
        if ($modulus === '' || $exponent === '') {
            return null;
        }

        $rsaPublicKey = self::derSequence(self::derInteger($modulus).self::derInteger($exponent));
        // AlgorithmIdentifier: OID rsaEncryption (1.2.840.113549.1.1.1) + NULL
        $algId = self::derSequence("\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00");
        $bitString = "\x00".$rsaPublicKey;
        $spki = self::derSequence($algId."\x03".self::derLength(strlen($bitString)).$bitString);

        return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($spki), 64, "\n")."-----END PUBLIC KEY-----\n";
    }

    private static function derInteger(string $bytes): string
    {
        $bytes = ltrim($bytes, "\x00");
        if ($bytes === '') {
            $bytes = "\x00";
        }
        if ((ord($bytes[0]) & 0x80) !== 0) {
            $bytes = "\x00".$bytes;
        }

        return "\x02".self::derLength(strlen($bytes)).$bytes;
    }

    private static function derSequence(string $contents): string
    {
        return "\x30".self::derLength(strlen($contents)).$contents;
    }

    private static function derLength(int $length): string
    {
        if ($length < 0x80) {
            return chr($length);
        }
        $bytes = '';
        while ($length > 0) {
            $bytes = chr($length & 0xFF).$bytes;
            $length >>= 8;
        }

        return chr(0x80 | strlen($bytes)).$bytes;
    }

    private static function base64UrlDecode(string $data): string
    {
        $padded = strtr($data, '-_', '+/');
        if ($remainder = strlen($padded) % 4) {
            $padded .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode($padded, true);

        return $decoded === false ? '' : $decoded;
    }
}
