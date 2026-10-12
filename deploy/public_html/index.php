<?php

/*
 * Entrada de Laravel en Hostinger.
 *
 * public_html tiene el sitio (Angular) y este archivo atiende /api. La app
 * Laravel vive en la carpeta "laravel", al lado de public_html y fuera del
 * alcance de la web:
 *
 *   domains/tu-dominio.com/
 *   ├── laravel/       ← backend (app, config, vendor, .env, ...)
 *   └── public_html/   ← este archivo, .htaccess, index.html y assets
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$laravel = __DIR__.'/../laravel';

if (file_exists($maintenance = $laravel.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $laravel.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $laravel.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
