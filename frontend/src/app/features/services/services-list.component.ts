import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';

@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>Servicios</span></nav>
        <span class="r-eyebrow">Taller propio</span>
        <h1 class="r-page-head__title">Service y <span>servicios</span></h1>
        <p class="r-page-head__text">Services programados, diagnóstico, reparaciones y todo lo que necesitás después de la compra.</p>
      </div>
    </section>

    <section class="r-container r-section services">
      @if (loading()) {
        <p class="r-status">Cargando...</p>
      } @else if (services().length === 0) {
        <p class="r-status">Pronto vas a ver acá nuestros servicios.</p>
      } @else {
        <div class="grid">
          @for (service of services(); track service.id; let i = $index) {
            <a class="card" [routerLink]="['/servicios', service.slug]">
              <span class="card__num">{{ number(i) }}</span>
              <h2 class="r-h3">{{ service.title }}</h2>
              <p>{{ service.summary }}</p>
              <span class="card__more">Ver más →</span>
            </a>
          }
        </div>
      }

      <div class="cta">
        <div>
          <h2 class="cta__title">¿Necesitás un turno?</h2>
          <p>Pedilo online y retirala el mismo día.</p>
        </div>
        <a routerLink="/contacto" [queryParams]="{ motivo: 'service' }" class="r-btn r-btn--white">Pedir turno</a>
      </div>
    </section>
  `,
  styles: [`
    .services { display: flex; flex-direction: column; gap: 48px; }
    /* Se adaptan a la cantidad: reparten el ancho, y una fila incompleta queda centrada. */
    .grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 24px; }
    .card { flex: 1 1 280px; max-width: 440px; background: #FFFFFF; border: 1px solid var(--r-line); border-top: 3px solid var(--r-red); padding: 28px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; color: var(--r-ink); text-decoration: none; transition: transform .15s; }
    .card:hover { color: var(--r-ink); transform: translateY(-2px); }
    .card__num { font-family: var(--r-display); font-weight: 800; font-size: 44px; line-height: 1; color: var(--r-red); }
    .card p { margin: 0; color: var(--r-muted-2); line-height: 1.5; flex-grow: 1; }
    .card__more { font-weight: 600; color: var(--r-red); }
    .cta { background: var(--r-red); color: #FFFFFF; padding: 40px; display: flex; flex-direction: column; gap: 20px; align-items: center; text-align: center; }
    .cta__title { margin: 0 0 6px; font-family: var(--r-display); font-weight: 800; font-size: 38px; line-height: 1; text-transform: uppercase; }
    .cta p { margin: 0; font-size: 18px; }
  `],
})
export class ServicesListComponent implements OnInit {
  private catalog = inject(CatalogService);
  services = signal<any[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.catalog.services().subscribe({
      next: (s) => {
        this.services.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
