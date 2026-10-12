import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'motos',
    loadComponent: () => import('./features/catalog/catalog-list.component').then((m) => m.CatalogListComponent),
    data: { type: 'moto' },
  },
  {
    path: 'motos/:slug',
    loadComponent: () => import('./features/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
    data: { type: 'moto' },
  },
  {
    path: 'cascos',
    loadComponent: () => import('./features/catalog/catalog-list.component').then((m) => m.CatalogListComponent),
    data: { type: 'casco' },
  },
  {
    path: 'cascos/:slug',
    loadComponent: () => import('./features/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
    data: { type: 'casco' },
  },
  {
    path: 'repuestos',
    loadComponent: () => import('./features/catalog/catalog-list.component').then((m) => m.CatalogListComponent),
    data: { type: 'repuesto' },
  },
  {
    path: 'repuestos/:slug',
    loadComponent: () => import('./features/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
    data: { type: 'repuesto' },
  },
  {
    path: 'servicios',
    loadComponent: () => import('./features/services/services-list.component').then((m) => m.ServicesListComponent),
  },
  {
    path: 'servicios/:slug',
    loadComponent: () => import('./features/services/service-detail.component').then((m) => m.ServiceDetailComponent),
  },
  {
    path: 'buscar',
    loadComponent: () => import('./features/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'comparar',
    loadComponent: () => import('./features/compare/compare.component').then((m) => m.CompareComponent),
  },
  {
    path: 'cotizador',
    loadComponent: () => import('./features/quote-cart/quote-cart.component').then((m) => m.QuoteCartComponent),
  },
  {
    path: 'contacto',
    loadComponent: () => import('./features/contact/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
  },
  { path: '**', redirectTo: '' },
];
