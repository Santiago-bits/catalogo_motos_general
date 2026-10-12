import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CompareService } from '../../core/services/compare.service';
import { Product } from '../../core/models/product.model';
import { MotoIconComponent } from '../../shared/moto-icon.component';
import { PricePipe } from '../../shared/price.pipe';
import { AVAILABILITY } from '../../shared/product-card.component';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [RouterLink, PricePipe, MotoIconComponent],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>Comparar</span></nav>
        <span class="r-eyebrow">Comparador</span>
        <h1 class="r-page-head__title">Compará <span>lado a lado</span></h1>
        <p class="r-page-head__text">Precio, equipamiento y ficha técnica de las motos y productos que elegiste.</p>
      </div>
    </section>

    <section class="r-container r-section compare">
      @if (products().length === 0) {
        <div class="empty r-panel">
          <p>Todavía no agregaste productos para comparar. Usá el botón "Comparar" en la ficha de cada producto.</p>
          <a routerLink="/motos" class="r-btn r-btn--red">Ver motos</a>
        </div>
      } @else {
        <div class="toolbar">
          <p><strong>{{ products().length }}</strong> {{ products().length === 1 ? 'producto' : 'productos' }}</p>
          <button type="button" class="r-btn r-btn--outline r-btn--sm" (click)="clear()">Vaciar comparador</button>
        </div>
        <div class="table-wrap r-panel">
          <table class="table">
            <thead>
              <tr>
                <th scope="col"><span class="sr-only">Característica</span></th>
                @for (p of products(); track p.id) {
                  <th scope="col">
                    <div class="head">
                      <div class="head__photo">
                        @if (image(p); as src) { <img [src]="src" [alt]="p.name" /> } @else { <app-moto-icon width="60%" /> }
                      </div>
                      <a [routerLink]="['/', p.type + 's', p.slug]" class="head__name">{{ p.name }}</a>
                      <button type="button" class="head__remove" (click)="remove(p.id)">Quitar</button>
                    </div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Precio</th>
                @for (p of products(); track p.id) {
                  <td class="price">{{ p.price.visible ? (p.price | price) : 'Consultar' }}</td>
                }
              </tr>
              <tr>
                <th scope="row">Marca</th>
                @for (p of products(); track p.id) { <td>{{ p.brand?.name ?? '—' }}</td> }
              </tr>
              <tr>
                <th scope="row">Disponibilidad</th>
                @for (p of products(); track p.id) { <td>{{ availability(p) }}</td> }
              </tr>
              @for (specName of specNames(); track specName) {
                <tr>
                  <th scope="row">{{ specName }}</th>
                  @for (p of products(); track p.id) { <td>{{ specValue(p, specName) }}</td> }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [`
    .compare { display: flex; flex-direction: column; gap: 24px; }
    .empty { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; font-size: 18px; }
    .empty p { margin: 0; max-width: 520px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .toolbar p { margin: 0; font-size: 17px; color: var(--r-muted-2); }
    .toolbar strong { font-family: var(--r-display); font-size: 26px; color: var(--r-ink); }
    .table-wrap { overflow-x: auto; }
    .table { border-collapse: collapse; width: 100%; min-width: 640px; }
    .table th, .table td { padding: 14px 18px; text-align: left; border-bottom: 1px solid var(--r-line); vertical-align: top; }
    .table tbody th { font-size: 12px; font-weight: 600; color: var(--r-muted); text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; width: 180px; }
    .table td { font-weight: 600; }
    .head { display: flex; flex-direction: column; gap: 10px; min-width: 200px; }
    .head__photo { aspect-ratio: 16 / 10; background: var(--r-photo); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .head__photo img { width: 100%; height: 100%; object-fit: contain; padding: 8px; background: #FFFFFF; }
    .head__name { font-family: var(--r-display); font-weight: 700; font-size: 24px; line-height: 1.05; text-transform: uppercase; color: var(--r-ink); text-decoration: none; }
    .head__name:hover { color: var(--r-red); }
    .head__remove { align-self: flex-start; background: none; border: 0; padding: 0; color: var(--r-red); font-weight: 600; font-size: 14px; }
    .price { font-family: var(--r-display); font-weight: 800 !important; font-size: 24px; color: var(--r-red); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `],
})
export class CompareComponent implements OnInit {
  private catalog = inject(CatalogService);
  compareService = inject(CompareService);

  products = signal<Product[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const ids = this.compareService.ids();
    if (ids.length === 0) {
      this.products.set([]);
      return;
    }
    this.catalog.compare(ids).subscribe((res) => this.products.set(res.data));
  }

  remove(id: number): void {
    this.compareService.remove(id);
    this.load();
  }

  clear(): void {
    this.compareService.clear();
    this.products.set([]);
  }

  image(p: Product): string | null {
    const main = p.images?.find((i) => i.is_main) ?? p.images?.[0];
    return main ? main.thumb_path ?? main.path : null;
  }

  availability(p: Product): string {
    return AVAILABILITY[p.availability] ?? p.availability;
  }

  specNames(): string[] {
    const names = new Set<string>();
    this.products().forEach((p) => p.specs?.forEach((s) => names.add(s.feature)));
    return Array.from(names);
  }

  specValue(product: Product, name: string): string {
    const spec = product.specs?.find((s) => s.feature === name);
    if (!spec) return '—';
    return spec.unit ? `${spec.value} ${spec.unit}` : String(spec.value);
  }
}
