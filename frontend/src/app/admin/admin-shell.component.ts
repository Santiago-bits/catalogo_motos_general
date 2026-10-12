import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AdminApiService } from './core/admin-api.service';
import { AuthService } from './core/auth.service';
import { SiteService } from '../core/services/site.service';
import { UiService } from './core/ui.service';
import { DropdownComponent } from './shared/dropdown.component';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  query?: Record<string, string>;
  perm: string[];
  badge?: 'inquiries' | 'quotes';
  exact?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

/** Menú con las mismas secciones que el panel de SH Servicios. */
const NAV: NavSection[] = [
  { section: 'General', items: [
    { label: 'Inicio', icon: 'bi-speedometer2', path: '/admin', perm: ['dashboard.view'], exact: true },
  ] },
  { section: 'Catálogo', items: [
    { label: 'Motos 0 km', icon: 'bi-bicycle', path: '/admin/motos', perm: ['products.view'] },
    { label: 'Motos usadas', icon: 'bi-arrow-repeat', path: '/admin/usadas', perm: ['products.view'] },
    { label: 'Cascos', icon: 'bi-shield-shaded', path: '/admin/cascos', perm: ['products.view'] },
    { label: 'Repuestos', icon: 'bi-nut-fill', path: '/admin/repuestos', perm: ['products.view'] },
    { label: 'Categorías', icon: 'bi-diagram-3-fill', path: '/admin/categorias', perm: ['categories.manage'] },
    { label: 'Marcas', icon: 'bi-award-fill', path: '/admin/marcas', perm: ['brands.manage'] },
    { label: 'Etiquetas', icon: 'bi-tags-fill', path: '/admin/etiquetas', perm: ['tags.manage'] },
    { label: 'Características', icon: 'bi-list-check', path: '/admin/caracteristicas', perm: ['features.manage'] },
    { label: 'Servicios', icon: 'bi-tools', path: '/admin/servicios', perm: ['services.manage'] },
  ] },
  { section: 'Stock', items: [
    { label: 'Inventario', icon: 'bi-box-seam', path: '/admin/stock', perm: ['stock.view'], exact: true },
    { label: 'Movimientos', icon: 'bi-arrow-left-right', path: '/admin/stock/movimientos', perm: ['stock.view'] },
  ] },
  { section: 'Gestión', items: [
    { label: 'Consultas', icon: 'bi-chat-dots-fill', path: '/admin/consultas', perm: ['inquiries.view'], badge: 'inquiries' },
    { label: 'Cotizaciones', icon: 'bi-receipt', path: '/admin/cotizaciones', perm: ['quotes.view'], badge: 'quotes' },
    { label: 'Novedades', icon: 'bi-megaphone-fill', path: '/admin/novedades', perm: [] },
    { label: 'Importar', icon: 'bi-upload', path: '/admin/importar', perm: ['data.import'] },
    { label: 'Exportar', icon: 'bi-download', path: '/admin/exportar', perm: ['data.export'] },
    { label: 'Configuración', icon: 'bi-gear-fill', path: '/admin/configuracion', perm: ['settings.manage'] },
  ] },
  { section: 'Seguridad', items: [
    { label: 'Usuarios', icon: 'bi-people-fill', path: '/admin/usuarios', perm: ['users.view'] },
    { label: 'Roles', icon: 'bi-shield-lock-fill', path: '/admin/roles', perm: ['roles.manage'] },
    { label: 'Auditoría', icon: 'bi-clipboard-check-fill', path: '/admin/auditoria', perm: ['audit.view'] },
  ] },
];

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, DropdownComponent],
  template: `
    <div class="shell adm">
      <!-- Barra lateral -->
      <aside class="side" [class.is-open]="menuOpen()">
        <div class="side__head">
          <a routerLink="/admin" class="brand">
            @if (site.settings()['site_logo']; as logo) {
              <span class="brand__text">
                <img class="brand__logo" [src]="logo" alt="Panel" />
                <span class="brand__sub">Panel</span>
              </span>
            } @else {
            @if (site.brandIcon(); as icon) {
              <img class="brand__icon" [src]="icon" alt="" />
            } @else {
            <span class="brand__mark">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="16.5" r="3.5"></circle><circle cx="18.5" cy="16.5" r="3.5"></circle><path d="M5.5 16.5 10 9h5l3.5 7.5"></path><path d="M14 6h3l1.5 3"></path></svg>
            </span>
            }
            <span class="brand__text">
              <span class="brand__name">{{ site.brandName() }}<span class="dot">.</span></span>
              <span class="brand__sub">Panel</span>
            </span>
            }
          </a>
          <button type="button" class="side__close" (click)="menuOpen.set(false)" aria-label="Cerrar menú"><i class="bi bi-x-lg"></i></button>
        </div>

        <nav class="nav" aria-label="Menú del panel">
          @for (group of nav(); track group.section) {
            <p class="nav__section">{{ group.section }}</p>
            @for (item of group.items; track item.path) {
              <a class="nav__link" [class.is-active]="isActive(item)" [routerLink]="item.path" [queryParams]="item.query ?? null">
                <i class="bi" [class]="item.icon"></i>
                <span>{{ item.label }}</span>
                @if (badgeFor(item); as count) {
                  <span class="nav__badge">{{ count }}</span>
                }
              </a>
            }
          }
        </nav>

        <div class="side__foot">
          <a href="/" target="_blank" rel="noopener" class="side__site"><i class="bi bi-box-arrow-up-right"></i> Ver el sitio</a>
        </div>
      </aside>

      <!-- Contenido -->
      <div class="main">
        <header class="topbar">
          <button type="button" class="topbar__toggle" (click)="menuOpen.set(true)" aria-label="Abrir menú"><i class="bi bi-list"></i></button>
          <h1 class="topbar__title">{{ title() }}</h1>

          <div class="topbar__actions">
            <app-dd [width]="240">
              <button trigger type="button" class="user">
                <span class="user__avatar">{{ initial() }}</span>
                <span class="user__info">
                  <strong>{{ auth.user()?.name }}</strong>
                  <small>{{ auth.user()?.role_name }}</small>
                </span>
                <i class="bi bi-chevron-down"></i>
              </button>
              <a class="dd-item" routerLink="/admin/perfil"><i class="bi bi-person"></i> Mi perfil</a>
              <a class="dd-item" href="/" target="_blank" rel="noopener"><i class="bi bi-globe"></i> Ver el sitio</a>
              <div class="dd-divider"></div>
              <button type="button" class="dd-item dd-item--danger" (click)="auth.logout()"><i class="bi bi-box-arrow-right"></i> Cerrar sesión</button>
            </app-dd>
          </div>
        </header>

        @if (auth.user()?.must_change_password && !onProfile()) {
          <div class="force-pw">
            <i class="bi bi-shield-exclamation"></i>
            Por seguridad tenés que cambiar tu contraseña.
            <a routerLink="/admin/perfil">Cambiarla ahora</a>
          </div>
        }

        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </div>

      @if (menuOpen()) {
        <div class="backdrop" (click)="menuOpen.set(false)"></div>
      }

      <!-- Avisos -->
      <div class="adm-toasts" aria-live="polite">
        @for (toast of ui.toasts(); track toast.id) {
          <div class="adm-toast" [class.adm-toast--error]="toast.type === 'error'" [class.adm-toast--info]="toast.type === 'info'">
            <i class="bi" [class.bi-check-circle-fill]="toast.type === 'ok'" [class.bi-exclamation-triangle-fill]="toast.type === 'error'" [class.bi-info-circle-fill]="toast.type === 'info'"></i>
            <span>{{ toast.message }}</span>
            <button type="button" (click)="ui.dismiss(toast.id)" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
          </div>
        }
      </div>

      <!-- Confirmación (equivale al data-confirm de SH) -->
      @if (ui.confirmRequest(); as req) {
        <div class="adm-modal-backdrop" (mousedown)="$event.target === $event.currentTarget && req.resolve(false)">
          <div class="adm-modal" role="alertdialog" aria-modal="true">
            <div class="adm-modal__head">
              <h2>{{ req.title }}</h2>
              <button type="button" class="adm-modal__close" (click)="req.resolve(false)" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="adm-modal__body"><p class="confirm-text">{{ req.message }}</p></div>
            <div class="adm-modal__foot">
              <button type="button" class="btn btn-ghost" (click)="req.resolve(false)">Cancelar</button>
              <button type="button" class="btn" [class.btn-accent]="req.danger" [class.btn-dark]="!req.danger" (click)="req.resolve(true)" autofocus>{{ req.confirmLabel }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .shell { display: flex; min-height: 100vh; background: var(--a-bg); }

    .side { width: 252px; flex-shrink: 0; background: #15161A; color: #C9CBD1; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; z-index: 40; }
    .side__head { display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid #2A2C33; }
    .side__close { display: none; background: none; border: 0; color: #C9CBD1; font-size: 18px; cursor: pointer; }
    .brand { display: flex; align-items: center; gap: 12px; color: #FFF; text-decoration: none; }
    .brand:hover { color: #FFF; }
    .brand__mark { width: 38px; height: 38px; background: #C8102E; display: flex; align-items: center; justify-content: center; transform: skewX(-10deg); }
    .brand__text { display: flex; flex-direction: column; line-height: 1; }
    .brand__logo { display: block; height: 40px; width: auto; max-width: 180px; object-fit: contain; object-position: left center; margin-bottom: 4px; }
    .brand__icon { display: block; width: 38px; height: 38px; object-fit: contain; flex-shrink: 0; }
    .brand__name { font-family: var(--r-display); font-weight: 800; font-size: 26px; letter-spacing: 0.04em; text-transform: uppercase; }
    .dot { color: #C8102E; }
    .brand__sub { font-family: var(--r-display); font-weight: 600; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #FF5A6E; margin-top: 3px; }

    .nav { flex: 1; padding: 8px 0 16px; }
    .nav__section { margin: 0; padding: 16px 20px 6px; font-family: var(--r-display); font-weight: 600; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #6B6E77; }
    .nav__link { display: flex; align-items: center; gap: 12px; padding: 9px 20px 9px 17px; border-left: 3px solid transparent; color: #C9CBD1; text-decoration: none; font-size: 15px; font-weight: 500; }
    .nav__link .bi { font-size: 16px; width: 18px; text-align: center; color: #8A8D96; }
    .nav__link:hover { color: #FFF; background: rgba(255,255,255,.04); }
    .nav__link:hover .bi { color: #FFF; }
    .nav__link.is-active { color: #FFF; background: rgba(200,16,46,.16); border-left-color: #C8102E; font-weight: 600; }
    .nav__link.is-active .bi { color: #FF5A6E; }
    .nav__badge { margin-left: auto; min-width: 22px; height: 20px; padding: 0 6px; display: flex; align-items: center; justify-content: center; background: #C8102E; color: #FFF; font-size: 12px; font-weight: 700; }
    .side__foot { padding: 16px 20px 20px; border-top: 1px solid #2A2C33; }
    .side__site { color: #C9CBD1; text-decoration: none; font-size: 14px; display: inline-flex; gap: 8px; align-items: center; }
    .side__site:hover { color: #FFF; }

    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 14px; min-height: 68px; padding: 0 44px; background: #FFF; border-bottom: 1px solid var(--a-line); }
    .topbar__toggle { display: none; background: none; border: 1px solid var(--a-line); width: 40px; height: 40px; font-size: 20px; cursor: pointer; }
    .topbar__title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .topbar__actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
    .user { display: flex; align-items: center; gap: 10px; padding: 6px 8px; background: none; border: 1px solid transparent; cursor: pointer; font: inherit; color: var(--a-text); text-align: left; }
    .user:hover { border-color: var(--a-line); }
    .user__avatar { width: 36px; height: 36px; display: grid; place-items: center; background: #15161A; color: #FFF; font-family: var(--r-display); font-weight: 800; font-size: 18px; }
    .user__info { display: flex; flex-direction: column; line-height: 1.2; }
    .user__info strong { font-size: 14px; }
    .user__info small { font-size: 12px; color: var(--a-muted); }
    .user .bi-chevron-down { font-size: 12px; color: var(--a-muted); }

    .force-pw { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 44px; background: var(--a-warn-soft); color: #5E3A00; border-bottom: 1px solid #F0D7AE; font-size: 14.5px; }
    .force-pw a { font-weight: 700; }
    .content { flex: 1; padding: 32px 44px 64px; }
    .backdrop { display: none; }
    .confirm-text { margin: 0; font-size: 15.5px; line-height: 1.55; }

    @media (max-width: 1000px) {
      .side { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform .2s; }
      .side.is-open { transform: none; box-shadow: 20px 0 40px rgba(0,0,0,.3); }
      .side__close { display: block; }
      .backdrop { display: block; position: fixed; inset: 0; background: rgba(13,14,17,.5); z-index: 35; }
      .topbar { padding: 0 16px; }
      .topbar__toggle { display: inline-grid; place-items: center; }
      .topbar__title { font-size: 21px; }
      .user__info, .user .bi-chevron-down { display: none; }
      .force-pw { padding: 10px 16px; }
      .content { padding: 22px 16px 48px; }
    }
  `],
})
export class AdminShellComponent implements OnInit {
  auth = inject(AuthService);
  ui = inject(UiService);
  site = inject(SiteService);
  private api = inject(AdminApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  menuOpen = signal(false);
  title = signal('Panel');
  private url = signal('');

  initial = computed(() => (this.auth.user()?.name ?? '?').charAt(0).toUpperCase());
  onProfile = computed(() => this.url().startsWith('/admin/perfil'));

  /** Menú filtrado por permisos; las secciones vacías no se muestran. */
  nav = computed(() => {
    this.auth.user(); // recalcula cuando llega el usuario
    return NAV.map((group) => ({
      section: group.section,
      items: group.items.filter((item) => item.perm.length === 0 || this.auth.can(...item.perm)),
    })).filter((group) => group.items.length > 0);
  });

  ngOnInit(): void {
    this.site.load();
    this.auth.fetchMe().subscribe({ error: () => undefined });
    this.syncRoute();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.syncRoute();
    });
  }

  isActive(item: NavItem): boolean {
    const path = this.url().split('?')[0];
    if (item.exact) return path === item.path;
    return path === item.path || path.startsWith(item.path + '/');
  }

  badgeFor(item: NavItem): number {
    if (item.badge === 'inquiries') return this.ui.counters().inquiries_new;
    if (item.badge === 'quotes') return this.ui.counters().quotes_pending;
    return 0;
  }

  private syncRoute(): void {
    this.url.set(this.router.url);

    let child = this.route;
    while (child.firstChild) child = child.firstChild;
    const title = child.snapshot.data['title'] as string | undefined;
    this.title.set(title ?? 'Panel');
    document.title = `${title ?? 'Panel'} · Panel RODADO`;

    this.api.counters().subscribe({ next: (c) => this.ui.counters.set(c), error: () => undefined });
  }
}
