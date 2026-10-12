<?php

/*
 * Entrada de Laravel en Hostinger.
 *
 * public_html tiene el sitio Angular y este archivo atiende /api. La app
 * Laravel está en public_html/laravel (bloqueada desde la web por .htaccess):
 *
 *   public_html/
 *   ├── index.html, *.js, *.css   sitio Angular
 *   ├── index.php, .htaccess      este archivo y el ruteo
 *   ├── storage/                  imágenes y archivos subidos desde el panel
 *   └── laravel/                  backend (app, config, vendor, .env, ...)
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$laravel = __DIR__.'/laravel';

if (file_exists($maintenance = $laravel.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $laravel.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $laravel.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
