import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, AdminBrand } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { AVAILABILITY, num, publicUrl } from '../core/labels';
import { UiService } from '../core/ui.service';
import { DropdownComponent } from '../shared/dropdown.component';
import { PagerComponent } from '../shared/pager.component';
import { StockMoveModalComponent, StockMoveType, StockTarget } from './stock-move-modal.component';

interface StockRow {
  id: number;
  type: string;
  code: string;
  name: string;
  slug: string;
  brand: string | null;
  category: string | null;
  model: string | null;
  condition: string | null;
  thumb: string | null;
  stock_qty: number;
  stock_min: number;
  stock_status: 'sin' | 'bajo' | 'ok';
  availability: string;
  active: boolean;
  final_price: number;
  currency: string;
}

interface Summary {
  units: number;
  products: number;
  out: number;
  low: number;
}

const SECTIONS = [
  { value: '', label: 'Todo el catálogo' },
  { value: 'motos', label: 'Motos 0 km' },
  { value: 'usadas', label: 'Motos usadas' },
  { value: 'cascos', label: 'Cascos' },
  { value: 'repuestos', label: 'Repuestos' },
];

const STATUS: Record<string, { label: string; chip: string }> = {
  sin: { label: 'Sin stock', chip: 'danger' },
  bajo: { label: 'Stock bajo', chip: 'warn' },
  ok: { label: 'En stock', chip: 'ok' },
};

@Component({
  selector: 'app-admin-stock',
  standalone: true,
  imports: [FormsModule, RouterLink, DropdownComponent, PagerComponent, StockMoveModalComponent],
  template: `
    @if (summary(); as s) {
      <div class="stat-grid">
        <div class="stat-card stat-card--dark">
          <div class="stat-card__label"><i class="bi bi-box-seam"></i> Unidades en stock</div>
          <div class="stat-card__value">{{ num(s.units) }}</div>
          <div class="stat-card__hint">en {{ num(s.products) }} producto(s)</div>
          <i class="bi bi-box-seam stat-card__icon"></i>
        </div>
        <button type="button" class="stat-card stat-btn" [class.stat-card--accent]="s.out > 0" (click)="quick('sin')">
          <div class="stat-card__label"><i class="bi bi-x-octagon"></i> Sin stock</div>
          <div class="stat-card__value">{{ num(s.out) }}</div>
          <div class="stat-card__hint">{{ s.out ? 'Ver cuáles →' : 'Nada agotado' }}</div>
        </button>
        <button type="button" class="stat-card stat-btn stat-card--warn" (click)="quick('bajo')">
          <div class="stat-card__label"><i class="bi bi-exclamation-triangle"></i> Stock bajo</div>
          <div class="stat-card__value">{{ num(s.low) }}</div>
          <div class="stat-card__hint">igual o debajo del mínimo</div>
        </button>
      </div>
    }

    <div class="admin-filters">
      <form (ngSubmit)="apply()">
        <div class="f-field f-field--wide">
          <label class="form-label" for="s-q">Buscar</label>
          <input type="search" class="form-control" id="s-q" name="q" [(ngModel)]="filters.q" placeholder="Nombre o código" />
        </div>
        <div class="f-field">
          <label class="form-label" for="s-sec">Sección</label>
          <select class="form-select" id="s-sec" name="seccion" [(ngModel)]="filters.seccion">
            @for (o of sections; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="s-est">Stock</label>
          <select class="form-select" id="s-est" name="estado_stock" [(ngModel)]="filters.estado_stock">
            <option value="">Todos</option>
            <option value="sin">Sin stock</option>
            <option value="bajo">Stock bajo</option>
            <option value="ok">En stock</option>
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="s-brand">Marca</label>
          <select class="form-select" id="s-brand" name="marca" [(ngModel)]="filters.marca">
            <option value="">Todas</option>
            @for (b of brands(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="s-ord">Orden</label>
          <select class="form-select" id="s-ord" name="orden" [(ngModel)]="filters.orden">
            <option value="stock_asc">Menos stock primero</option>
            <option value="stock_desc">Más stock primero</option>
            <option value="nombre">Nombre A-Z</option>
            <option value="codigo">Código</option>
          </select>
        </div>
        <div class="f-actions">
          <button type="submit" class="btn btn-dark"><i class="bi bi-funnel"></i> Filtrar</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">Limpiar</button>
        </div>
      </form>
    </div>

    <div class="card-admin">
      <div class="card-admin__head">
        <h2><i class="bi bi-box-seam"></i> Inventario <span class="count">{{ num(total()) }} producto(s)</span></h2>
        <a routerLink="/admin/stock/movimientos" class="btn btn-ghost btn-sm"><i class="bi bi-arrow-left-right"></i> Ver movimientos</a>
      </div>
      <div class="card-admin__body card-admin__body--flush">
        <div class="table-wrap">
          <table class="table-admin">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Sección</th>
                <th class="num">Stock</th>
                <th class="num">Mínimo</th>
                <th>Estado</th>
                <th>Publicación</th>
                <th class="actions">Movimiento</th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr [class.row-out]="p.stock_status === 'sin'">
                  <td>
                    <a class="table-product" [routerLink]="editLink(p)">
                      @if (p.thumb) { <img class="table-thumb" [src]="p.thumb" alt="" loading="lazy" /> } @else { <span class="table-thumb"><i class="bi bi-image"></i></span> }
                      <span>
                        <span class="table-product__name">{{ p.name }}</span>
                        <span class="table-product__meta mono">{{ p.code }}{{ p.brand ? ' · ' + p.brand : '' }}</span>
                      </span>
                    </a>
                  </td>
                  <td><span class="chip chip--neutral">{{ sectionLabel(p) }}</span></td>
                  <td class="num"><span class="qty" [class]="'qty--' + p.stock_status">{{ p.stock_qty }}</span></td>
                  <td class="num">
                    @if (canManage) {
                      <input class="form-control min-input" type="number" min="0" [ngModel]="p.stock_min" (change)="saveMin(p, $any($event.target).value)" [attr.aria-label]="'Stock mínimo de ' + p.name" title="Avisar cuando quede esta cantidad o menos" />
                    } @else { {{ p.stock_min }} }
                  </td>
                  <td><span class="chip" [class]="'chip--' + status[p.stock_status].chip">{{ status[p.stock_status].label }}</span></td>
                  <td>
                    <span class="chip" [class]="'chip--' + (availability[p.availability]?.chip ?? 'neutral')">{{ availability[p.availability]?.label ?? p.availability }}</span>
                    @if (!p.active) { <small class="muted" style="display:block">No publicado</small> }
                  </td>
                  <td class="actions">
                    @if (canManage) {
                      <div class="move-btns">
                        <button type="button" class="btn btn-ghost btn-sm" (click)="open(p, 'ingreso')" title="Ingreso"><i class="bi bi-plus-lg"></i></button>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="open(p, 'egreso')" [disabled]="p.stock_qty <= 0" title="Egreso / venta"><i class="bi bi-dash-lg"></i></button>
                        <app-dd [width]="210">
                          <button trigger type="button" class="btn-icon" title="Más"><i class="bi bi-three-dots-vertical"></i></button>
                          <button type="button" class="dd-item" (click)="open(p, 'ajuste')"><i class="bi bi-sliders"></i> Ajustar (conteo)</button>
                          <a class="dd-item" routerLink="/admin/stock/movimientos" [queryParams]="{ producto: p.id, nombre: p.name }"><i class="bi bi-clock-history"></i> Ver movimientos</a>
                          <a class="dd-item" [routerLink]="editLink(p)"><i class="bi bi-pencil"></i> Editar producto</a>
                          <a class="dd-item" [href]="publicUrl(p)" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Ver en el sitio</a>
                        </app-dd>
                      </div>
                    } @else {
                      <a class="btn btn-ghost btn-sm" routerLink="/admin/stock/movimientos" [queryParams]="{ producto: p.id, nombre: p.name }">Movimientos</a>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state">@if (loading()) { Cargando… } @else { <i class="bi bi-inbox"></i>No hay productos con esos filtros. }</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      @if (lastPage() > 1) {
        <div class="card-admin__foot">
          <span class="muted small">Página {{ page() }} de {{ lastPage() }}</span>
          <app-pager [current]="page()" [last]="lastPage()" (page)="goTo($event)" />
        </div>
      }
    </div>

    <app-stock-move-modal [product]="moving()" [initialType]="moveType" (closed)="moving.set(null)" (saved)="onSaved($event)" />
  `,
  styles: [`
    .stat-btn { cursor: pointer; text-align: left; font: inherit; }
    .stat-btn:hover { border-color: var(--a-text); }
    .qty { font-family: var(--r-display); font-weight: 800; font-size: 24px; }
    .qty--sin { color: var(--a-red); }
    .qty--bajo { color: var(--a-warn); }
    .qty--ok { color: var(--a-text); }
    .min-input { width: 80px; min-height: 34px; padding: 4px 8px; text-align: right; display: inline-block; }
    .move-btns { display: inline-flex; gap: 6px; align-items: center; }
    .move-btns .btn { min-width: 36px; padding: 4px 8px; }
    .row-out td { background: #FFF8F9; }
  `],
})
export class StockComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  private auth = inject(AuthService);

  rows = signal<StockRow[]>([]);
  summary = signal<Summary | null>(null);
  brands = signal<AdminBrand[]>([]);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);
  moving = signal<StockTarget | null>(null);
  moveType: StockMoveType = 'ingreso';
  canManage = false;

  filters = { q: '', seccion: '', estado_stock: '', marca: '', orden: 'stock_asc' };

  sections = SECTIONS;
  status = STATUS;
  availability = AVAILABILITY;
  num = num;
  publicUrl = publicUrl;

  ngOnInit(): void {
    this.canManage = this.auth.can('stock.manage');
    this.api.brands().subscribe((b) => this.brands.set(b));
    this.route.queryParamMap.subscribe((p) => {
      this.filters = {
        q: p.get('q') ?? '',
        seccion: p.get('seccion') ?? '',
        estado_stock: p.get('estado_stock') ?? '',
        marca: p.get('marca') ?? '',
        orden: p.get('orden') ?? 'stock_asc',
      };
      this.page.set(Number(p.get('pagina')) || 1);
      this.load();
    });
  }

  sectionLabel(p: StockRow): string {
    if (p.type === 'casco') return 'Cascos';
    if (p.type === 'repuesto') return 'Repuestos';
    return ['usada', 'reacondicionada'].includes(p.condition ?? '') ? 'Motos usadas' : 'Motos 0 km';
  }

  editLink(p: StockRow): unknown[] {
    const section = p.type === 'casco' ? 'cascos' : p.type === 'repuesto' ? 'repuestos' : ['usada', 'reacondicionada'].includes(p.condition ?? '') ? 'usadas' : 'motos';
    return ['/admin', section, p.id];
  }

  quick(estado: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { estado_stock: estado } });
  }

  apply(): void {
    const queryParams: Record<string, string | null> = {};
    Object.entries(this.filters).forEach(([k, v]) => (queryParams[k] = v && !(k === 'orden' && v === 'stock_asc') ? v : null));
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goTo(pagina: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pagina }, queryParamsHandling: 'merge' });
  }

  open(p: StockRow, type: StockMoveType): void {
    this.moveType = type;
    this.moving.set({ id: p.id, name: p.name, code: p.code, stock_qty: p.stock_qty });
  }

  onSaved(res: { id: number; stock_qty: number; availability: string; stock_status: string }): void {
    this.moving.set(null);
    this.rows.update((list) => list.map((r) => (r.id === res.id ? { ...r, stock_qty: res.stock_qty, availability: res.availability, stock_status: res.stock_status as StockRow['stock_status'] } : r)));
    this.loadSummary();
  }

  saveMin(p: StockRow, value: string): void {
    const min = Math.max(0, Math.floor(Number(value) || 0));
    if (min === p.stock_min) return;
    this.api.put<{ stock_min: number; stock_status: string }>(`stock/${p.id}/minimo`, { stock_min: min }).subscribe({
      next: (res) => {
        this.rows.update((list) => list.map((r) => (r.id === p.id ? { ...r, stock_min: res.stock_min, stock_status: res.stock_status as StockRow['stock_status'] } : r)));
        this.ui.success(`Mínimo de «${p.name}»: ${res.stock_min}.`);
        this.loadSummary();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private loadSummary(): void {
    this.api.get<any>('stock', { ...this.filters, por_pagina: 5 }).subscribe((res) => this.summary.set(res.summary));
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<any>('stock', { ...this.filters, page: this.page() }).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.summary.set(res.summary);
        this.total.set(res.total ?? res.data.length);
        this.lastPage.set(res.last_page ?? 1);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.ui.apiError(e);
      },
    });
  }
}
