<?php

use App\Http\Controllers\Api\Admin\AuditController as AdminAuditController;
use App\Http\Controllers\Api\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Api\Admin\BrandController as AdminBrandController;
use App\Http\Controllers\Api\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\ExportController as AdminExportController;
use App\Http\Controllers\Api\Admin\FeatureController as AdminFeatureController;
use App\Http\Controllers\Api\Admin\ImportController as AdminImportController;
use App\Http\Controllers\Api\Admin\InquiryController as AdminInquiryController;
use App\Http\Controllers\Api\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Api\Admin\ProductExtrasController as AdminProductExtrasController;
use App\Http\Controllers\Api\Admin\ProductImageController as AdminProductImageController;
use App\Http\Controllers\Api\Admin\QuoteController as AdminQuoteController;
use App\Http\Controllers\Api\Admin\RoleController as AdminRoleController;
use App\Http\Controllers\Api\Admin\ServiceController as AdminServiceController;
use App\Http\Controllers\Api\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\Admin\StockController as AdminStockController;
use App\Http\Controllers\Api\Admin\TagController as AdminTagController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CompareController;
use App\Http\Controllers\Api\InquiryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\QuoteController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\SettingController;
use Illuminate\Support\Facades\Route;

Route::get('/motos', [ProductController::class, 'index'])->defaults('type', 'moto');
Route::get('/motos/{slug}', [ProductController::class, 'show'])->defaults('type', 'moto');

Route::get('/cascos', [ProductController::class, 'index'])->defaults('type', 'casco');
Route::get('/cascos/{slug}', [ProductController::class, 'show'])->defaults('type', 'casco');

Route::get('/repuestos', [ProductController::class, 'index'])->defaults('type', 'repuesto');
Route::get('/repuestos/{slug}', [ProductController::class, 'show'])->defaults('type', 'repuesto');

Route::get('/destacados', [ProductController::class, 'featured']);
Route::get('/buscar', [SearchController::class, 'index']);
Route::get('/comparar', [CompareController::class, 'index']);

Route::get('/marcas', [BrandController::class, 'index']);
Route::get('/categorias', [CategoryController::class, 'index']);
Route::get('/ajustes', [SettingController::class, 'index']);

Route::get('/servicios', [ServiceController::class, 'index']);
Route::get('/servicios/{slug}', [ServiceController::class, 'show']);

Route::post('/consultas', [InquiryController::class, 'store']);
Route::post('/cotizador', [QuoteController::class, 'store']);

Route::middleware('throttle:15,10')->group(function () {
    Route::post('/admin/login', [AdminAuthController::class, 'login']);
    Route::post('/admin/login/google', [AdminAuthController::class, 'loginWithGoogle']);
});
Route::get('/admin/login/config', [AdminAuthController::class, 'config']);

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    // --- Sesión y perfil (cualquier usuario del panel) ---------------
    Route::get('/me', [AdminAuthController::class, 'me']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::put('/perfil', [AdminAuthController::class, 'updateProfile']);
    Route::put('/perfil/password', [AdminAuthController::class, 'updatePassword']);
    Route::get('/contadores', [AdminDashboardController::class, 'counters']);
    Route::get('/novedades', [AdminDashboardController::class, 'news']);

    // --- Inicio ------------------------------------------------------
    Route::get('/dashboard', [AdminDashboardController::class, 'index'])->middleware('perm:dashboard.view');

    // --- Productos ---------------------------------------------------
    Route::get('/productos', [AdminProductController::class, 'index'])->middleware('perm:products.view');
    Route::get('/productos/{product}', [AdminProductController::class, 'show'])->middleware('perm:products.view');
    Route::post('/productos', [AdminProductController::class, 'store'])->middleware('perm:products.create');
    Route::put('/productos/{product}', [AdminProductController::class, 'update'])->middleware('perm:products.edit');
    Route::delete('/productos/{product}', [AdminProductController::class, 'destroy'])->middleware('perm:products.delete');
    Route::post('/productos/{product}/duplicar', [AdminProductController::class, 'duplicate'])->middleware('perm:products.create');
    Route::post('/productos/{product}/condicion', [AdminProductController::class, 'toggleCondition'])->middleware('perm:products.edit');

    Route::middleware('perm:products.edit')->group(function () {
        Route::post('/productos/{product}/imagenes', [AdminProductImageController::class, 'store']);
        Route::post('/productos/{product}/imagenes/{image}/principal', [AdminProductImageController::class, 'setMain']);
        Route::delete('/productos/{product}/imagenes/{image}', [AdminProductImageController::class, 'destroy']);
        Route::post('/productos/{product}/documentos', [AdminProductExtrasController::class, 'storeDocument']);
        Route::delete('/productos/{product}/documentos/{document}', [AdminProductExtrasController::class, 'destroyDocument']);
        Route::post('/productos/{product}/videos', [AdminProductExtrasController::class, 'storeVideo']);
        Route::delete('/productos/{product}/videos/{video}', [AdminProductExtrasController::class, 'destroyVideo']);
        Route::post('/productos/{product}/codigos', [AdminProductExtrasController::class, 'storeCode']);
        Route::delete('/productos/{product}/codigos/{code}', [AdminProductExtrasController::class, 'destroyCode']);
        Route::post('/productos/{product}/compatibilidad', [AdminProductExtrasController::class, 'storeCompatibility']);
        Route::delete('/productos/{product}/compatibilidad/{compatibility}', [AdminProductExtrasController::class, 'destroyCompatibility']);
    });

    // --- Taxonomías (la lectura la usan también los formularios de producto)
    Route::get('/marcas', [AdminBrandController::class, 'index'])->middleware('perm:brands.manage,products.view');
    Route::get('/categorias', [AdminCategoryController::class, 'index'])->middleware('perm:categories.manage,products.view');
    Route::get('/etiquetas', [AdminTagController::class, 'index'])->middleware('perm:tags.manage,products.view');
    Route::get('/caracteristicas', [AdminFeatureController::class, 'index'])->middleware('perm:features.manage,products.view');

    Route::middleware('perm:brands.manage')->group(function () {
        Route::apiResource('marcas', AdminBrandController::class)->parameters(['marcas' => 'brand'])->only(['store', 'update', 'destroy']);
        Route::post('/marcas/{brand}/logo', [AdminBrandController::class, 'logo']);
    });
    Route::middleware('perm:categories.manage')->group(function () {
        Route::apiResource('categorias', AdminCategoryController::class)->parameters(['categorias' => 'category'])->only(['store', 'update', 'destroy']);
        Route::post('/categorias/{category}/imagen', [AdminCategoryController::class, 'image']);
    });
    Route::apiResource('etiquetas', AdminTagController::class)->parameters(['etiquetas' => 'tag'])->only(['store', 'update', 'destroy'])->middleware('perm:tags.manage');
    Route::apiResource('caracteristicas', AdminFeatureController::class)->parameters(['caracteristicas' => 'feature'])->only(['store', 'update', 'destroy'])->middleware('perm:features.manage');
    Route::middleware('perm:services.manage')->group(function () {
        Route::apiResource('servicios', AdminServiceController::class)->parameters(['servicios' => 'service'])->except('show');
        Route::post('/servicios/{service}/imagen', [AdminServiceController::class, 'image']);
    });

    // --- Stock -------------------------------------------------------
    Route::middleware('perm:stock.view')->group(function () {
        Route::get('/stock', [AdminStockController::class, 'index']);
        Route::get('/stock/movimientos', [AdminStockController::class, 'movements']);
        Route::get('/stock/opciones', [AdminStockController::class, 'meta']);
    });
    Route::middleware('perm:stock.manage')->group(function () {
        Route::post('/stock/{product}/movimientos', [AdminStockController::class, 'store']);
        Route::put('/stock/{product}/minimo', [AdminStockController::class, 'updateMin']);
    });

    // --- Gestión -----------------------------------------------------
    Route::get('/consultas', [AdminInquiryController::class, 'index'])->middleware('perm:inquiries.view');
    Route::get('/consultas/canales', [AdminInquiryController::class, 'channels'])->middleware('perm:inquiries.view');
    Route::get('/consultas/{inquiry}', [AdminInquiryController::class, 'show'])->middleware('perm:inquiries.view');
    Route::put('/consultas/{inquiry}', [AdminInquiryController::class, 'update'])->middleware('perm:inquiries.manage');
    Route::delete('/consultas/{inquiry}', [AdminInquiryController::class, 'destroy'])->middleware('perm:inquiries.manage');

    Route::get('/cotizaciones', [AdminQuoteController::class, 'index'])->middleware('perm:quotes.view');
    Route::put('/cotizaciones/{quote}', [AdminQuoteController::class, 'update'])->middleware('perm:quotes.manage');
    Route::delete('/cotizaciones/{quote}', [AdminQuoteController::class, 'destroy'])->middleware('perm:quotes.manage');

    Route::middleware('perm:data.import')->group(function () {
        Route::get('/importar', [AdminImportController::class, 'index']);
        Route::get('/importar/plantilla/{type}', [AdminImportController::class, 'template']);
        Route::post('/importar/previsualizar', [AdminImportController::class, 'preview']);
        Route::post('/importar/ejecutar', [AdminImportController::class, 'run']);
    });

    Route::middleware('perm:data.export')->group(function () {
        Route::get('/exportar', [AdminExportController::class, 'index']);
        Route::get('/exportar/catalogo/{dataset}', [AdminExportController::class, 'catalog']);
        Route::get('/exportar/{dataset}/{format}', [AdminExportController::class, 'download']);
    });

    Route::get('/ajustes', [AdminSettingController::class, 'index'])->middleware('perm:settings.manage');
    Route::put('/ajustes', [AdminSettingController::class, 'update'])->middleware('perm:settings.manage');
    Route::post('/ajustes/imagen/{key}', [AdminSettingController::class, 'image'])->middleware('perm:settings.manage');

    // --- Seguridad ---------------------------------------------------
    Route::get('/usuarios', [AdminUserController::class, 'index'])->middleware('perm:users.view');
    Route::apiResource('usuarios', AdminUserController::class)->parameters(['usuarios' => 'user'])->only(['store', 'update', 'destroy'])->middleware('perm:users.manage');

    Route::get('/roles', [AdminRoleController::class, 'index'])->middleware('perm:roles.manage,users.view');
    Route::middleware('perm:roles.manage')->group(function () {
        Route::get('/roles/permisos', [AdminRoleController::class, 'permissions']);
        Route::get('/roles/{role}', [AdminRoleController::class, 'show']);
        Route::post('/roles', [AdminRoleController::class, 'store']);
        Route::put('/roles/{role}', [AdminRoleController::class, 'update']);
        Route::delete('/roles/{role}', [AdminRoleController::class, 'destroy']);
    });

    Route::get('/auditoria', [AdminAuditController::class, 'index'])->middleware('perm:audit.view');
    Route::get('/auditoria/filtros', [AdminAuditController::class, 'meta'])->middleware('perm:audit.view');
});
