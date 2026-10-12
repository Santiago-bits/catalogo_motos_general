<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // En el hosting la carpeta pública es public_html, al lado de la app (ver deploy/).
        if ($publicPath = env('PUBLIC_PATH')) {
            $this->app->usePublicPath(base_path($publicPath));
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
