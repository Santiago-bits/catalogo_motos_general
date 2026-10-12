import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './core/auth.guard';

const list = () => import('./products/products-list.component').then((m) => m.ProductsListComponent);
const form = () => import('./products/product-form.component').then((m) => m.ProductFormComponent);

/** Las cuatro secciones del catálogo comparten listado y formulario. */
const catalogRoutes = (['motos', 'usadas', 'cascos', 'repuestos'] as const).flatMap((section) => {
  const titles = { motos: 'Motos 0 km', usadas: 'Motos usadas', cascos: 'Cascos', repuestos: 'Repuestos' };
  return [
    { path: section, loadComponent: list, canActivate: [permissionGuard], data: { section, title: titles[section], perm: 'products.view' } },
    { path: `${section}/nueva`, loadComponent: form, canActivate: [permissionGuard], data: { section, title: titles[section], perm: 'products.create' } },
    { path: `${section}/:id`, loadComponent: form, canActivate: [permissionGuard], data: { section, title: titles[section], perm: 'products.view' } },
  ];
});

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
        canActivate: [permissionGuard],
        data: { title: 'Inicio', perm: 'dashboard.view' },
      },
      ...catalogRoutes,
      { path: 'productos', redirectTo: 'motos', pathMatch: 'full' },
      {
        path: 'categorias',
        loadComponent: () => import('./categories/categories.component').then((m) => m.CategoriesComponent),
        canActivate: [permissionGuard],
        data: { title: 'Categorías', perm: 'categories.manage' },
      },
      {
        path: 'marcas',
        loadComponent: () => import('./brands/brands.component').then((m) => m.BrandsComponent),
        canActivate: [permissionGuard],
        data: { title: 'Marcas', perm: 'brands.manage' },
      },
      {
        path: 'etiquetas',
        loadComponent: () => import('./tags/tags.component').then((m) => m.TagsComponent),
        canActivate: [permissionGuard],
        data: { title: 'Etiquetas', perm: 'tags.manage' },
      },
      {
        path: 'caracteristicas',
        loadComponent: () => import('./features-admin/features-admin.component').then((m) => m.FeaturesAdminComponent),
        canActivate: [permissionGuard],
        data: { title: 'Características', perm: 'features.manage' },
      },
      {
        path: 'servicios',
        loadComponent: () => import('./services/services-admin.component').then((m) => m.ServicesAdminComponent),
        canActivate: [permissionGuard],
        data: { title: 'Servicios', perm: 'services.manage' },
      },
      {
        path: 'stock',
        loadComponent: () => import('./stock/stock.component').then((m) => m.StockComponent),
        canActivate: [permissionGuard],
        data: { title: 'Inventario', perm: 'stock.view' },
      },
      {
        path: 'stock/movimientos',
        loadComponent: () => import('./stock/stock-movements.component').then((m) => m.StockMovementsComponent),
        canActivate: [permissionGuard],
        data: { title: 'Movimientos de stock', perm: 'stock.view' },
      },
      {
        path: 'consultas',
        loadComponent: () => import('./inquiries/inquiries.component').then((m) => m.InquiriesComponent),
        canActivate: [permissionGuard],
        data: { title: 'Consultas', perm: 'inquiries.view' },
      },
      {
        path: 'consultas/:id',
        loadComponent: () => import('./inquiries/inquiry-detail.component').then((m) => m.InquiryDetailComponent),
        canActivate: [permissionGuard],
        data: { title: 'Consulta', perm: 'inquiries.view' },
      },
      {
        path: 'cotizaciones',
        loadComponent: () => import('./quotes/quotes.component').then((m) => m.QuotesComponent),
        canActivate: [permissionGuard],
        data: { title: 'Cotizaciones', perm: 'quotes.view' },
      },
      {
        path: 'novedades',
        loadComponent: () => import('./news/news.component').then((m) => m.NewsComponent),
        data: { title: 'Novedades' },
      },
      {
        path: 'importar',
        loadComponent: () => import('./imports/import.component').then((m) => m.ImportComponent),
        canActivate: [permissionGuard],
        data: { title: 'Importar', perm: 'data.import' },
      },
      {
        path: 'exportar',
        loadComponent: () => import('./exports/export.component').then((m) => m.ExportComponent),
        canActivate: [permissionGuard],
        data: { title: 'Exportar', perm: 'data.export' },
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
        canActivate: [permissionGuard],
        data: { title: 'Configuración', perm: 'settings.manage' },
      },
      { path: 'ajustes', redirectTo: 'configuracion', pathMatch: 'full' },
      {
        path: 'usuarios',
        loadComponent: () => import('./users/users.component').then((m) => m.UsersComponent),
        canActivate: [permissionGuard],
        data: { title: 'Usuarios', perm: 'users.view' },
      },
      {
        path: 'roles',
        loadComponent: () => import('./roles/roles.component').then((m) => m.RolesComponent),
        canActivate: [permissionGuard],
        data: { title: 'Roles', perm: 'roles.manage' },
      },
      {
        path: 'roles/:id',
        loadComponent: () => import('./roles/role-edit.component').then((m) => m.RoleEditComponent),
        canActivate: [permissionGuard],
        data: { title: 'Permisos del rol', perm: 'roles.manage' },
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./audit/audit.component').then((m) => m.AuditComponent),
        canActivate: [permissionGuard],
        data: { title: 'Auditoría', perm: 'audit.view' },
      },
      {
        path: 'perfil',
        loadComponent: () => import('./profile/profile.component').then((m) => m.ProfileComponent),
        data: { title: 'Mi perfil' },
      },
      {
        path: 'sin-permiso',
        loadComponent: () => import('./shared/no-access.component').then((m) => m.NoAccessComponent),
        data: { title: 'Sin permiso' },
      },
    ],
  },
];
