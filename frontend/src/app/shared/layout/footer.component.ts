import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteService } from '../../core/services/site.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="footer__grid r-container">
        <div class="footer__col">
          @if (site.logoImage(); as logo) {
            <img class="footer__logo" [src]="logo" [alt]="site.companyName()" />
          } @else {
            <span class="footer__brand">
              @if (site.brandIcon(); as icon) { <img class="footer__icon" [src]="icon" alt="" /> }
              {{ site.brandName() }}<span class="dot">.</span> {{ site.brandSub() }}
            </span>
          }
          <span class="footer__about">{{ site.settings()['footer_about'] || 'Concesionario de motos 0 km y usadas. Venta, financiación, service y accesorios.' }}</span>
        </div>
        <nav aria-label="Catálogo" class="footer__col">
          <strong>Catálogo</strong>
          <a routerLink="/motos" [queryParams]="{ condicion: 'nueva' }">Motos 0 km</a>
          <a routerLink="/motos" [queryParams]="{ condicion: 'usada' }">Motos usadas</a>
          <a routerLink="/" fragment="financiacion">Financiación</a>
          <a routerLink="/" fragment="usada">Plan canje</a>
        </nav>
        <nav aria-label="Servicios" class="footer__col">
          <strong>Servicios</strong>
          <a routerLink="/servicios">Service</a>
          <a routerLink="/repuestos">Repuestos</a>
          <a routerLink="/cascos">Accesorios</a>
        </nav>
        <div class="footer__col">
          <strong>Seguinos</strong>
          <!-- Sólo las redes que tienen enlace cargado en Configuración -->
          @if (socials().length) {
            <div class="socials">
              @for (s of socials(); track s.icon) {
                <a class="social" [href]="s.url" target="_blank" rel="noopener" [title]="s.label" [attr.aria-label]="s.label">
                  <i class="bi" [class]="s.icon" aria-hidden="true"></i>
                </a>
              }
            </div>
          } @else {
            <span class="footer__about">Pronto en redes.</span>
          }
        </div>
      </div>
      <div class="footer__bottom r-container">
        <span>&copy; {{ year }} {{ site.companyName() }}</span>
        <span>Precios y disponibilidad sujetos a cambios sin previo aviso.</span>
      </div>
    </footer>
  `,
  styles: [`
    .footer { background: var(--r-ink-deep); color: var(--r-grey); font-size: 15px; }
    .footer__grid { padding-top: 64px; padding-bottom: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 36px; }
    .footer__col { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; }
    .footer__logo { display: block; height: 44px; width: auto; max-width: 200px; object-fit: contain; object-position: center; }
    .footer__brand { display: inline-flex; align-items: center; gap: 10px; font-family: var(--r-display); font-weight: 800; font-size: 28px; letter-spacing: 0.04em; color: #FFFFFF; text-transform: uppercase; }
    .footer__icon { width: 36px; height: 36px; object-fit: contain; }
    .dot { color: var(--r-red); }
    .footer__about { line-height: 1.55; margin-top: 4px; white-space: pre-line; }
    .socials { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 2px; }
    .social { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--r-line-dark); color: #FFFFFF !important; font-size: 20px; transition: background .15s, border-color .15s; }
    .social:hover { background: var(--r-red); border-color: var(--r-red); }
    .footer__col strong { color: #FFFFFF; font-family: var(--r-display); font-size: 18px; letter-spacing: 0.1em; text-transform: uppercase; }
    .footer__col a { color: #C9CBD1; text-decoration: none; }
    .footer__col a:hover { color: #FFFFFF; }
    .footer__bottom { padding-top: 20px; padding-bottom: 32px; border-top: 1px solid var(--r-line-dark); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; font-size: 13px; }
  `],
})
export class FooterComponent implements OnInit {
  site = inject(SiteService);
  year = new Date().getFullYear();

  /** Redes con enlace cargado, en el orden en que se muestran. */
  socials = computed(() => {
    const s = this.site.settings();
    return [
      { url: s['social_instagram'], icon: 'bi-instagram', label: 'Instagram' },
      { url: s['social_facebook'], icon: 'bi-facebook', label: 'Facebook' },
      { url: s['social_youtube'], icon: 'bi-youtube', label: 'YouTube' },
      { url: s['social_tiktok'], icon: 'bi-tiktok', label: 'TikTok' },
      { url: this.site.whatsappUrl(), icon: 'bi-whatsapp', label: 'WhatsApp' },
    ].filter((item) => !!item.url?.trim());
  });

  ngOnInit(): void {
    this.site.load();
  }
}
