import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { BrandRef, CatalogFilters, CategoryRef, PaginatedResponse, Product, ProductType } from '../../core/models/product.model';
import { ProductCardComponent } from '../../shared/product-card.component';

interface PageCopy {
  eyebrow: string;
  title: string;
  accent: string;
  text: string;
}

const COPY: Record<ProductType, PageCopy> = {
  moto: {
    eyebrow: 'Stock disponible',
    title: 'Motos',
    accent: '0 km y usadas',
    text: 'Elegí por tipo, marca o precio. Todas las usadas pasan por nuestro taller antes de la venta.',
  },
  casco: {
    eyebrow: 'Indumentaria',
    title: 'Cascos y',
    accent: 'accesorios',
    text: 'Cascos homologados, camperas, guantes y todo lo que necesitás para rodar seguro.',
  },
  repuesto: {
    eyebrow: 'Taller y repuestos',
    title: 'Repuestos',
    accent: 'originales',
    text: 'Repuestos originales y alternativos para todas las marcas. Si no está en stock, lo encargamos.',
  },
};

const PRICE_RANGES = [2000000, 4000000, 8000000, 15000000];

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [ProductCardComponent, FormsModule, RouterLink],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>{{ heading() }} {{ accent() }}</span></nav>
        <span class="r-eyebrow">{{ copy().eyebrow }}</span>
        <h1 class="r-page-head__title">{{ heading() }} <span>{{ accent() }}</span></h1>
        <p class="r-page-head__text">{{ copy().text }}</p>
      </div>
    </section>

    <div class="filters r-container">
      <form class="filters__form" aria-label="Filtrar catálogo" (ngSubmit)="apply()">
        @if (type === 'moto') {
          <label class="r-field">Condición
            <select class="r-input" name="condicion" [(ngModel)]="filters.condicion">
              <option value="">0 km y usadas</option>
              <option value="nueva">Solo 0 km</option>
              <option value="usada">Solo usadas</option>
            </select>
          </label>
        }
        @if (categories().length) {
          <label class="r-field">Tipo
            <select class="r-input" name="categoria" [(ngModel)]="filters.categoria">
              <option value="">Todos los tipos</option>
              @for (c of categories(); track c.id) { <option [value]="c.slug">{{ c.name }}</option> }
            </select>
          </label>
        }
        <label class="r-field">Marca
          <select class="r-input" name="marca" [(ngModel)]="filters.marca">
            <option value="">Todas las marcas</option>
            @for (b of brands(); track b.id) { <option [value]="b.slug">{{ b.name }}</option> }
          </select>
        </label>
        <label class="r-field">Precio hasta
          <select class="r-input" name="precio_max" [(ngModel)]="filters.precio_max">
            <option value="">Sin límite</option>
            @for (r of priceRanges; track r) { <option [value]="r">$ {{ formatNumber(r) }}</option> }
          </select>
        </label>
        <label class="r-field">Ordenar
          <select class="r-input" name="orden" [(ngModel)]="filters.orden">
            <option value="recientes">Más recientes</option>
            <option value="precio_asc">Precio: menor a mayor</option>
            <option value="precio_desc">Precio: mayor a menor</option>
            <option value="nombre">Nombre A-Z</option>
          </select>
        </label>
        <button type="submit" class="r-btn r-btn--red filters__btn">Filtrar</button>
      </form>
    </div>

    <section class="results r-container">
      <div class="results__head">
        <p class="results__count">
          @if (!loading()) { <strong>{{ total() }}</strong> {{ total() === 1 ? 'resultado' : 'resultados' }} }
        </p>
        @if (type === 'moto') {
          <div role="tablist" aria-label="Filtrar por condición" class="r-tabs">
            <button type="button" role="tab" class="r-tab" [attr.aria-selected]="!filters.condicion" (click)="setCondition('')">Todas</button>
            <button type="button" role="tab" class="r-tab" [attr.aria-selected]="filters.condicion === 'nueva'" (click)="setCondition('nueva')">0 km</button>
            <button type="button" role="tab" class="r-tab" [attr.aria-selected]="filters.condicion === 'usada'" (click)="setCondition('usada')">Usadas</button>
          </div>
        }
      </div>

      @if (loading()) {
        <p class="r-status">Cargando...</p>
      } @else if (products().length === 0) {
        <div class="empty r-panel">
          <p>No encontramos productos con esos filtros.</p>
          <button type="button" class="r-btn r-btn--outline" (click)="clear()">Limpiar filtros</button>
        </div>
      } @else {
        <div class="r-grid-cards">
          @for (product of products(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>

        @if (lastPage() > 1) {
          <nav class="pager" aria-label="Páginas">
            <button type="button" class="pager__btn" [disabled]="page() === 1" (click)="goToPage(page() - 1)" aria-label="Página anterior">←</button>
            @for (p of pages(); track p) {
              <button type="button" class="pager__btn" [class.is-active]="p === page()" [attr.aria-current]="p === page() ? 'page' : null" (click)="goToPage(p)">{{ p }}</button>
            }
            <button type="button" class="pager__btn" [disabled]="page() === lastPage()" (click)="goToPage(page() + 1)" aria-label="Página siguiente">→</button>
          </nav>
        }
      }
    </section>
  `,
  styles: [`
    .filters { margin-top: -36px; position: relative; }
    .filters__form { background: #FFFFFF; box-shadow: 0 18px 40px rgba(13,14,17,0.18); padding: 28px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 18px; align-items: end; }
    .filters__btn { min-height: 48px; padding: 0 24px; }
    .results { padding-top: 56px; padding-bottom: 96px; display: flex; flex-direction: column; gap: 32px; }
    .results__head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
    .results__count { margin: 0; font-size: 17px; color: var(--r-muted-2); }
    .results__count strong { font-family: var(--r-display); font-size: 26px; color: var(--r-ink); }
    .empty { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; font-size: 18px; }
    .empty p { margin: 0; }
    .pager { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .pager__btn { min-width: 48px; height: 48px; padding: 0 12px; border: 2px solid var(--r-ink); background: #FFFFFF; color: var(--r-ink); font-family: var(--r-display); font-weight: 700; font-size: 18px; }
    .pager__btn:hover:not(:disabled) { background: var(--r-ink); color: #FFFFFF; }
    .pager__btn.is-active { background: var(--r-red); border-color: var(--r-red); color: #FFFFFF; }
    .pager__btn:disabled { opacity: .35; cursor: default; }
  `],
})
export class CatalogListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalog = inject(CatalogService);

  priceRanges = PRICE_RANGES;

  type!: ProductType;
  products = signal<Product[]>([]);
  brands = signal<BrandRef[]>([]);
  categories = signal<CategoryRef[]>([]);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);

  filters: { condicion: '' | 'nueva' | 'usada'; categoria: string; marca: string; precio_max: string; orden: NonNullable<CatalogFilters['orden']> } = {
    condicion: '',
    categoria: '',
    marca: '',
    precio_max: '',
    orden: 'recientes',
  };

  ngOnInit(): void {
    this.type = this.route.snapshot.data['type'] as ProductType;
    this.catalog.brands().subscribe((brands) => this.brands.set(brands));
    this.catalog.categories(this.type).subscribe((categories) => this.categories.set(categories));

    this.route.queryParamMap.subscribe((params) => {
      const condicion = params.get('condicion');
      this.filters = {
        condicion: condicion === 'nueva' || condicion === 'usada' ? condicion : '',
        categoria: params.get('categoria') ?? '',
        marca: params.get('marca') ?? '',
        precio_max: params.get('precio_max') ?? '',
        orden: (params.get('orden') as CatalogFilters['orden']) ?? 'recientes',
      };
      this.page.set(Number(params.get('page')) || 1);
      this.load();
    });
  }

  copy(): PageCopy {
    return COPY[this.type];
  }

  heading(): string {
    if (this.type === 'moto' && this.filters.condicion) return 'Motos';
    return this.copy().title;
  }

  accent(): string {
    if (this.type === 'moto' && this.filters.condicion === 'nueva') return '0 km';
    if (this.type === 'moto' && this.filters.condicion === 'usada') return 'usadas';
    return this.copy().accent;
  }

  formatNumber(n: number): string {
    return new Intl.NumberFormat('es-AR').format(n);
  }

  apply(): void {
    this.navigate(1);
  }

  setCondition(condicion: '' | 'nueva' | 'usada'): void {
    this.filters.condicion = condicion;
    this.navigate(1);
  }

  clear(): void {
    this.filters = { condicion: '', categoria: '', marca: '', precio_max: '', orden: 'recientes' };
    this.navigate(1);
  }

  goToPage(p: number): void {
    this.navigate(p);
  }

  pages(): number[] {
    return Array.from({ length: this.lastPage() }, (_, i) => i + 1);
  }

  /** Los filtros viven en la URL: así se pueden compartir y el menú puede enlazar a "0 km" o "Usadas". */
  private navigate(page: number): void {
    const queryParams: Record<string, string | number | null> = {
      condicion: this.filters.condicion || null,
      categoria: this.filters.categoria || null,
      marca: this.filters.marca || null,
      precio_max: this.filters.precio_max || null,
      orden: this.filters.orden !== 'recientes' ? this.filters.orden : null,
      page: page > 1 ? page : null,
    };
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  private load(): void {
    this.loading.set(true);
    const filters: CatalogFilters = {
      condicion: this.type === 'moto' && this.filters.condicion ? this.filters.condicion : undefined,
      categoria: this.filters.categoria || undefined,
      marca: this.filters.marca || undefined,
      precio_max: this.filters.precio_max ? Number(this.filters.precio_max) : undefined,
      orden: this.filters.orden,
      page: this.page(),
    };

    this.catalog.list(this.type, filters).subscribe({
      next: (res: PaginatedResponse<Product>) => {
        this.products.set(res.data);
        this.lastPage.set(res.meta?.last_page ?? 1);
        this.total.set(res.meta?.total ?? res.data.length);
        this.loading.set(false);
      },
      error: () => {
        this.products.set([]);
        this.loading.set(false);
      },
    });
  }
}
