import { Component, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { CartService } from '../../core/services/cart.service';
import { CompareService } from '../../core/services/compare.service';
import { SiteService } from '../../core/services/site.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- Header -->
    <header class="header">
      <div class="header__inner r-container">
        <a routerLink="/" class="brand" (click)="open.set(false)">
          @if (site.settings()['site_logo']; as logo) {
            <img class="brand__logo" [src]="logo" [alt]="site.settings()['site_name'] || 'Inicio'" />
          } @else {
          @if (site.brandIcon(); as icon) {
            <img class="brand__icon" [src]="icon" alt="" />
          } @else {
          <span class="brand__mark">
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="16.5" r="3.5"></circle><circle cx="18.5" cy="16.5" r="3.5"></circle><path d="M5.5 16.5 10 9h5l3.5 7.5"></path><path d="M14 6h3l1.5 3"></path></svg>
          </span>
          }
          <span class="brand__name">{{ site.brandName() }}<span class="brand__dot">.</span> <span class="brand__sub">{{ site.brandSub() }}</span></span>
          }
        </a>

        <button type="button" class="burger" [attr.aria-expanded]="open()" aria-controls="nav-principal" (click)="open.set(!open())">
          <span class="sr-only">Menú</span>
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            @if (open()) { <path d="M6 6l12 12M18 6 6 18"></path> } @else { <path d="M4 7h16M4 12h16M4 17h16"></path> }
          </svg>
        </button>

        <div class="header__menu" id="nav-principal" [class.is-open]="open()">
          <nav aria-label="Principal" class="nav">
            <a routerLink="/motos" [queryParams]="{ condicion: 'nueva' }">0 km</a>
            <a routerLink="/motos" [queryParams]="{ condicion: 'usada' }">Usadas</a>
            <a routerLink="/" fragment="financiacion">Financiación</a>
            <a routerLink="/servicios">Service</a>
            <a routerLink="/repuestos">Repuestos y accesorios</a>
            <a routerLink="/contacto">Contacto</a>
          </nav>

          <div class="header__actions">
            <a routerLink="/buscar" class="icon-link" title="Buscar">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
              <span class="sr-only">Buscar</span>
            </a>
            @if (compare.count() > 0) {
              <a routerLink="/comparar" class="icon-link" title="Comparar">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"></path></svg>
                <span class="sr-only">Comparar</span>
                <span class="badge">{{ compare.count() }}</span>
              </a>
            }
            @if (cart.count() > 0) {
              <a routerLink="/cotizador" class="icon-link" title="Cotizador">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="1"></rect><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"></path></svg>
                <span class="sr-only">Cotizador</span>
                <span class="badge">{{ cart.count() }}</span>
              </a>
            }
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header { background: var(--r-ink); color: #FFFFFF; border-bottom: 1px solid var(--r-line-dark); position: sticky; top: 0; z-index: 20; }
    .header__inner { padding-top: 18px; padding-bottom: 18px; display: flex; flex-wrap: wrap; gap: 16px 40px; align-items: center; justify-content: space-between; }
    .header__menu { display: flex; flex-wrap: wrap; gap: 16px 40px; align-items: center; justify-content: space-between; flex: 1 1 auto; }

    .brand { display: flex; align-items: center; gap: 12px; color: #FFFFFF; text-decoration: none; }
    .brand:hover { color: #FFFFFF; }
    .brand__logo { display: block; height: 48px; width: auto; max-width: 220px; object-fit: contain; }
    .brand__mark { width: 44px; height: 44px; background: var(--r-red); display: flex; align-items: center; justify-content: center; transform: skewX(-10deg); }
    .brand__icon { display: block; width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; }
    .brand__name { font-family: var(--r-display); font-weight: 800; font-size: 30px; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase; }
    .brand__dot { color: var(--r-red); }
    .brand__sub { font-weight: 500; color: var(--r-grey); font-size: 22px; letter-spacing: 0.12em; }

    .nav { display: flex; flex-wrap: wrap; gap: 6px 28px; font-family: var(--r-display); font-weight: 600; font-size: 18px; letter-spacing: 0.06em; text-transform: uppercase; }
    .nav a { color: #FFFFFF; text-decoration: none; padding: 10px 0; border-bottom: 2px solid transparent; }
    .nav a:hover { color: #FFFFFF; border-color: var(--r-red); }

    .header__actions { display: flex; align-items: center; gap: 18px; }
    .cta { font-size: 17px; padding: 13px 22px; }
    .icon-link { position: relative; color: #C9CBD1; display: inline-flex; padding: 6px; }
    .icon-link:hover { color: #FFFFFF; }
    .badge { position: absolute; top: -4px; right: -8px; background: var(--r-red); color: #FFFFFF; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; display: flex; align-items: center; justify-content: center; }

    .burger { display: none; background: transparent; border: 2px solid var(--r-line-dark); color: #FFFFFF; width: 48px; height: 48px; align-items: center; justify-content: center; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    @media (max-width: 1100px) {
      .burger { display: inline-flex; }
      .header__menu { display: none; flex-basis: 100%; flex-direction: column; align-items: stretch; gap: 16px; padding-top: 8px; }
      .header__menu.is-open { display: flex; }
      .nav { flex-direction: column; gap: 0; }
      .nav a { padding: 12px 0; border-bottom: 1px solid var(--r-line-dark); }
      .header__actions { justify-content: space-between; }
    }
  `],
})
export class NavbarComponent implements OnInit {
  cart = inject(CartService);
  compare = inject(CompareService);
  site = inject(SiteService);
  private router = inject(Router);

  open = signal(false);

  ngOnInit(): void {
    this.site.load();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.open.set(false));
  }
}
