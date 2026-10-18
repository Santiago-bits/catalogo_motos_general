import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ParallaxDirective, RevealDirective } from '../../shared/scroll-fx';

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [RouterLink, ParallaxDirective, RevealDirective],
  template: `
    @if (service(); as s) {
      <section class="r-page-head">
        <div class="r-page-head__inner r-container" [appParallax]="0.3" [fade]="true">
          <nav class="r-crumbs" aria-label="Ruta">
            <a routerLink="/">Inicio</a><span>/</span><a routerLink="/servicios">Servicios</a><span>/</span><span>{{ s.title }}</span>
          </nav>
          <span class="r-eyebrow">Servicios</span>
          <h1 class="r-page-head__title">{{ s.title }}</h1>
          @if (s.summary) { <p class="r-page-head__text">{{ s.summary }}</p> }
        </div>
      </section>

      <section class="r-container r-section detail" appReveal="stagger">
        <div class="r-panel body">
          <p class="description">{{ s.description }}</p>
        </div>
        <aside class="r-panel side">
          <h2 class="side__title">¿Te interesa?</h2>
          <p>Dejanos tus datos y te contactamos para coordinar.</p>
          <a routerLink="/contacto" [queryParams]="{ motivo: s.slug === 'financiacion' ? 'financiacion' : 'service' }" class="r-btn r-btn--red">Consultar</a>
          <a routerLink="/servicios" class="back">← Todos los servicios</a>
        </aside>
      </section>
    } @else if (notFound()) {
      <section class="r-container r-section">
        <h1 class="r-h2">Servicio no encontrado</h1>
        <p><a routerLink="/servicios">← Volver a servicios</a></p>
      </section>
    } @else {
      <p class="r-status r-container">Cargando...</p>
    }
  `,
  styles: [`
    .detail { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 32px; align-items: start; }
    @media (max-width: 860px) { .detail { grid-template-columns: 1fr; } }
    .body { padding: 36px; }
    .description { margin: 0; font-size: 18px; line-height: 1.7; color: var(--r-text-2); white-space: pre-line; }
    .side { padding: 28px; display: flex; flex-direction: column; gap: 14px; border-top: 3px solid var(--r-red); }
    .side__title { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 30px; text-transform: uppercase; }
    .side p { margin: 0; color: var(--r-muted-2); line-height: 1.5; }
    .back { font-weight: 600; }
  `],
})
export class ServiceDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private catalog = inject(CatalogService);
  service = signal<any>(null);
  notFound = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.catalog.service(slug).subscribe({
      next: (s) => this.service.set(s),
      error: () => this.notFound.set(true),
    });
  }
}
