<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // En el hosting la carpeta pública es public_html y la app vive en public_html/laravel (ver deploy/).
        if ($publicPath = env('PUBLIC_PATH')) {
            $this->app->usePublicPath(base_path($publicPath));
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Sin APP_URL en el .env, las URLs (imágenes subidas incluidas) salen del dominio de la visita.
        if (empty(env('APP_URL')) && ! $this->app->runningInConsole()) {
            $root = request()->getSchemeAndHttpHost();
            config(['app.url' => $root, 'filesystems.disks.public.url' => $root.'/storage']);
            URL::forceRootUrl($root);
        }
    }
}
