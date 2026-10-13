import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { Product } from '../../core/models/product.model';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent, FormsModule, RouterLink],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>Buscar</span></nav>
        <span class="r-eyebrow">Buscador</span>
        <h1 class="r-page-head__title">
          @if (term()) { Resultados para <span>"{{ term() }}"</span> } @else { Buscá en el <span>catálogo</span> }
        </h1>
      </div>
    </section>

    <div class="r-container bar">
      <form class="bar__form" role="search" (ngSubmit)="submit()">
        <label class="r-field bar__field">Modelo, marca o tipo
          <input class="r-input" type="search" name="q" [(ngModel)]="query" placeholder="Ej.: Twister, casco LS2, filtro de aceite" />
        </label>
        <button type="submit" class="r-btn r-btn--red bar__btn">Buscar</button>
      </form>
    </div>

    <section class="r-container results">
      @if (loading()) {
        <p class="r-status">Buscando...</p>
      } @else if (term() && results().length === 0) {
        <p class="r-status">No encontramos resultados para "{{ term() }}". Probá con otra palabra o <a routerLink="/contacto">consultanos</a>.</p>
      } @else if (results().length) {
        <div class="r-grid-cards">
          @for (product of results(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .bar { margin-top: -36px; position: relative; }
    .bar__form { background: #FFFFFF; box-shadow: 0 18px 40px rgba(10,10,10,0.18); padding: 28px; display: flex; flex-wrap: wrap; gap: 18px; align-items: end; }
    .bar__field { flex: 1 1 320px; }
    .bar__btn { min-height: 48px; padding: 0 32px; }
    .results { padding-top: 56px; padding-bottom: 96px; }
  `],
})
export class SearchComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalog = inject(CatalogService);

  query = '';
  term = signal('');
  results = signal<Product[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('q') ?? '';
      this.term.set(q);
      this.query = q;

      if (!q) {
        this.results.set([]);
        this.loading.set(false);
        return;
      }

      this.loading.set(true);
      this.catalog.search(q).subscribe({
        next: (res) => {
          this.results.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  submit(): void {
    const q = this.query.trim();
    if (!q) return;
    this.router.navigate(['/buscar'], { queryParams: { q } });
  }
}
