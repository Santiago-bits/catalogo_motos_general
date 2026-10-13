import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, AdminBrand, AdminCategory } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { AVAILABILITY, CONDITION, CatalogSection, SECTIONS, money, num, publicUrl } from '../core/labels';
import { UiService } from '../core/ui.service';
import { DropdownComponent } from '../shared/dropdown.component';
import { PagerComponent } from '../shared/pager.component';

const SORT_GROUPS = [
  { group: 'Código', options: [{ key: 'codigo_desc', label: 'Mayor a menor' }, { key: 'codigo', label: 'Menor a mayor' }] },
  { group: 'Nombre', options: [{ key: 'az', label: 'A-Z' }, { key: 'za', label: 'Z-A' }] },
  { group: 'Precio', options: [{ key: 'precio_asc', label: 'Menor a mayor' }, { key: 'precio_desc', label: 'Mayor a menor' }] },
  { group: 'Fecha', options: [{ key: 'recientes', label: 'Más recientes' }] },
];

const FAULTS: Record<string, string> = { sin_precio: 'sin precio', sin_imagen: 'sin foto', sin_categoria: 'sin categoría' };

@Component({
  selector: 'app-admin-products-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DropdownComponent, PagerComponent],
  template: `
    <!-- Filtros -->
    <div class="admin-filters">
      <form (ngSubmit)="apply()">
        <div class="f-field f-field--wide">
          <label class="form-label" for="f-q">Buscar</label>
          <input type="search" class="form-control" id="f-q" name="q" [(ngModel)]="filters.q" placeholder="Nombre, código{{ section.type === 'moto' ? ', modelo' : '' }}" />
        </div>
        <div class="f-field">
          <label class="form-label" for="f-cat">Categoría</label>
          <select class="form-select" id="f-cat" name="categoria" [(ngModel)]="filters.categoria">
            <option value="">Todas</option>
            @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="f-brand">Marca</label>
          <select class="form-select" id="f-brand" name="marca" [(ngModel)]="filters.marca">
            <option value="">Todas</option>
            @for (b of brands(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="f-estado">Estado</label>
          <select class="form-select" id="f-estado" name="estado" [(ngModel)]="filters.estado">
            <option value="">Todos</option>
            @for (s of availabilityKeys; track s) { <option [value]="s">{{ availability[s].label }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="f-activo">Publicación</label>
          <select class="form-select" id="f-activo" name="activo" [(ngModel)]="filters.activo">
            <option value="">Todas</option>
            <option value="1">Publicadas</option>
            <option value="0">No publicadas</option>
          </select>
        </div>
        <div class="f-actions">
          <button type="submit" class="btn btn-dark"><i class="bi bi-funnel"></i> Filtrar</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">Limpiar</button>
        </div>
      </form>
    </div>

    @if (activeFaults().length) {
      <div class="alert alert--warn">
        <span><i class="bi bi-funnel-fill"></i> Mostrando sólo {{ section.title.toLowerCase() }} <strong>{{ activeFaults().join(' y ') }}</strong>.</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="clear()">Ver todas</button>
      </div>
    }

    <div class="card-admin">
      <div class="card-admin__head">
        <h2>
          <i class="bi" [class]="section.icon"></i> {{ section.title }}
          <span class="count">{{ num(total()) }} registro(s)@if (total() > 0) { · {{ from() }}–{{ to() }} }</span>
        </h2>
        <div class="row-gap">
          @if (auth.can('products.create')) {
            <a [routerLink]="['/admin', section.key, 'nueva']" class="btn btn-accent btn-sm"><i class="bi bi-plus-lg"></i> Nueva {{ section.singular }}</a>
          }
          @if (auth.can('data.export')) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="export('xlsx')" title="Exportar a Excel"><i class="bi bi-file-earmark-excel"></i></button>
            <button type="button" class="btn btn-ghost btn-sm" (click)="catalogPdf()" title="Catálogo en PDF"><i class="bi bi-file-earmark-pdf"></i></button>
          }
        </div>
      </div>

      <div class="card-admin__body card-admin__body--flush">
        <div class="table-wrap">
          <table class="table-admin">
            <thead>
              <tr>
                <th>
                  <app-dd align="start" [width]="200">
                    <button trigger type="button" class="th-sort" title="Ordenar">{{ itemLabel() }} <i class="bi bi-filter"></i></button>
                    @for (g of sortGroups; track g.group; let last = $last) {
                      <div class="dd-header">{{ g.group }}</div>
                      @for (o of g.options; track o.key) {
                        <button type="button" class="dd-item" [class.is-active]="filters.orden === o.key" (click)="sort(o.key)">{{ o.label }}</button>
                      }
                      @if (!last) { <div class="dd-divider"></div> }
                    }
                  </app-dd>
                </th>
                <th>Marca{{ section.type === 'moto' ? ' / Modelo' : '' }}</th>
                @if (section.type === 'moto') {
                  <th>Año</th>
                  <th>{{ section.condicion ? 'Km' : 'Motor' }}</th>
                } @else if (section.type === 'casco') {
                  <th>Tipo / Talle</th>
                } @else {
                  <th>Código OEM</th>
                }
                <th class="num">Precio</th>
                <th class="num">Stock</th>
                <th>Estado</th>
                @if (section.type === 'moto') { <th>Condición</th> }
                <th>Publicada</th>
                <th class="actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (p of products(); track p.id) {
                <tr>
                  <td>
                    <a class="table-product" [routerLink]="['/admin', section.key, p.id]">
                      @if (thumb(p); as src) {
                        <img class="table-thumb" [src]="src" alt="" loading="lazy" />
                      } @else {
                        <span class="table-thumb"><i class="bi bi-image"></i></span>
                      }
                      <span>
                        <span class="table-product__name">{{ p.name }}</span>
                        <span class="table-product__meta mono">{{ p.code }}</span>
                      </span>
                    </a>
                  </td>
                  <td>
                    {{ p.brand?.name ?? '—' }}
                    @if (p.moto?.model) { <small class="muted" style="display:block">{{ p.moto.model }}</small> }
                  </td>
                  @if (section.type === 'moto') {
                    <td>{{ p.moto?.year ?? '—' }}</td>
                    <td>{{ section.condicion ? km(p) : cc(p) }}</td>
                  } @else if (section.type === 'casco') {
                    <td>{{ p.casco?.helmet_type ? capitalize(p.casco.helmet_type) : '—' }}{{ p.casco?.size ? ' · ' + p.casco.size : '' }}</td>
                  } @else {
                    <td class="mono">{{ p.repuesto?.oem_code ?? '—' }}</td>
                  }
                  <td class="num">
                    <strong>{{ p.price.final > 0 ? money(p.price.final, p.price.currency) : '—' }}</strong>
                    @if (p.price.is_offer && p.price.offer) { <small class="muted" style="display:block">Oferta {{ money(p.price.offer, p.price.currency) }}</small> }
                    @if (!p.price.visible) { <small class="muted" style="display:block">Oculto</small> }
                  </td>
                  <td class="num">
                    <strong [style.color]="p.stock_qty <= 0 ? 'var(--a-red)' : (p.stock_min > 0 && p.stock_qty <= p.stock_min ? 'var(--a-warn)' : null)">{{ p.stock_qty ?? 0 }}</strong>
                  </td>
                  <td><span class="chip" [class]="'chip--' + (availability[p.availability]?.chip ?? 'neutral')">{{ availability[p.availability]?.label ?? p.availability }}</span></td>
                  @if (section.type === 'moto') {
                    <td><span class="chip" [class]="'chip--' + conditionOf(p).chip">{{ conditionOf(p).label }}</span></td>
                  }
                  <td>
                    @if (p.active) { <span class="chip chip--ok">Sí</span> } @else { <span class="chip chip--neutral">No</span> }
                  </td>
                  <td class="actions">
                    <app-dd [width]="230">
                      <button trigger type="button" class="btn-icon" title="Acciones"><i class="bi bi-three-dots-vertical"></i></button>
                      <a class="dd-item" [href]="publicUrl(p)" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Ver en el sitio</a>
                      <a class="dd-item" [routerLink]="['/admin', section.key, p.id]"><i class="bi bi-pencil"></i> {{ auth.can('products.edit') ? 'Editar' : 'Ver ficha' }}</a>
                      @if (section.type === 'moto' && auth.can('products.edit')) {
                        <button type="button" class="dd-item" (click)="toggleCondition(p)"><i class="bi bi-arrow-repeat"></i> Pasar a {{ isUsed(p) ? '0 km' : 'usada' }}</button>
                      }
                      @if (auth.can('products.create')) {
                        <button type="button" class="dd-item" (click)="duplicate(p)"><i class="bi bi-files"></i> Duplicar</button>
                      }
                      @if (auth.can('products.delete')) {
                        <div class="dd-divider"></div>
                        <button type="button" class="dd-item dd-item--danger" (click)="remove(p)"><i class="bi bi-trash"></i> Eliminar</button>
                      }
                    </app-dd>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="10">
                    <div class="empty-state">
                      @if (loading()) { Cargando… } @else {
                        <i class="bi bi-inbox"></i> No hay {{ section.title.toLowerCase() }} que coincidan con los filtros.
                      }
                    </div>
                  </td>
                </tr>
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
  `,
})
export class ProductsListComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  auth = inject(AuthService);

  section!: CatalogSection;
  products = signal<any[]>([]);
  categories = signal<AdminCategory[]>([]);
  brands = signal<AdminBrand[]>([]);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);
  from = signal(0);
  to = signal(0);
  flags = signal<string[]>([]);

  filters = { q: '', categoria: '', marca: '', estado: '', activo: '', orden: 'codigo_desc' };

  sortGroups = SORT_GROUPS;
  availability = AVAILABILITY;
  availabilityKeys = Object.keys(AVAILABILITY);
  money = money;
  num = num;
  publicUrl = publicUrl;

  activeFaults = computed(() => this.flags().map((f) => FAULTS[f]));

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.section = SECTIONS[data['section'] as CatalogSection['key']];
      this.api.categories(this.section.type).subscribe((c) => this.categories.set(c));
    });
    this.api.brands().subscribe((b) => this.brands.set(b));

    this.route.queryParamMap.subscribe((params) => {
      this.filters = {
        q: params.get('q') ?? '',
        categoria: params.get('categoria') ?? '',
        marca: params.get('marca') ?? '',
        estado: params.get('estado') ?? '',
        activo: params.get('activo') ?? '',
        orden: params.get('orden') ?? 'codigo_desc',
      };
      this.flags.set(Object.keys(FAULTS).filter((f) => params.get(f) === '1'));
      this.page.set(Number(params.get('pagina')) || 1);
      this.load();
    });
  }

  itemLabel(): string {
    return { moto: 'Moto', casco: 'Casco', repuesto: 'Repuesto' }[this.section.type];
  }

  apply(): void {
    this.navigate({ ...this.filters, pagina: null });
  }

  clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  sort(orden: string): void {
    this.navigate({ orden, pagina: null }, true);
  }

  goTo(pagina: number): void {
    this.navigate({ pagina }, true);
  }

  thumb(p: any): string | null {
    const img = p.images?.find((i: any) => i.is_main) ?? p.images?.[0];
    return img ? img.thumb_path ?? img.path : null;
  }

  isUsed(p: any): boolean {
    return ['usada', 'reacondicionada'].includes(p.moto?.condition_type);
  }

  conditionOf(p: any): { label: string; chip: string } {
    return CONDITION[p.moto?.condition_type ?? 'nueva'] ?? CONDITION['nueva'];
  }

  km(p: any): string {
    return p.moto?.km !== null && p.moto?.km !== undefined ? `${num(p.moto.km)} km` : '—';
  }

  cc(p: any): string {
    return p.moto?.displacement_cc ? `${p.moto.displacement_cc} cc` : '—';
  }

  capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  async toggleCondition(p: any): Promise<void> {
    const target = this.isUsed(p) ? '0 km' : 'usada';
    if (!(await this.ui.confirm(`¿Pasar «${p.name}» a ${target}? Va a cambiar de sección.`, { confirmLabel: `Pasar a ${target}` }))) return;
    this.api.post(`productos/${p.id}/condicion`).subscribe({
      next: () => {
        this.ui.success(`«${p.name}» ahora está en ${target === '0 km' ? 'Motos 0 km' : 'Motos usadas'}.`);
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async duplicate(p: any): Promise<void> {
    if (!(await this.ui.confirm(`¿Crear una copia idéntica de «${p.name}»? Se abrirá para editarla (queda sin publicar).`, { confirmLabel: 'Duplicar' }))) return;
    this.api.post<{ id: number; code: string }>(`productos/${p.id}/duplicar`).subscribe({
      next: (copy) => {
        this.ui.success(`Copia creada con el código ${copy.code}.`);
        this.router.navigate(['/admin', this.section.key, copy.id]);
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(p: any): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar «${p.name}» para siempre? Se borran también sus fotos, manuales y videos. No se puede deshacer.`, { title: 'Eliminar producto', confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`productos/${p.id}`).subscribe({
      next: () => {
        this.ui.success('Producto eliminado.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  export(format: 'xlsx' | 'csv'): void {
    this.api.download(`exportar/${this.section.key}/${format}`, {}, `${this.section.key}.${format}`).subscribe({
      error: (e) => this.ui.apiError(e, 'No se pudo exportar.'),
    });
  }

  catalogPdf(): void {
    this.ui.info('Generando el catálogo en PDF…');
    this.api.download(`exportar/catalogo/${this.section.key}`, {}, `catalogo-${this.section.key}.pdf`).subscribe({
      error: (e) => this.ui.apiError(e, 'No se pudo generar el PDF.'),
    });
  }

  private navigate(changes: Record<string, unknown>, merge = false): void {
    const queryParams: Record<string, unknown> = {};
    Object.entries(changes).forEach(([k, v]) => (queryParams[k] = v === '' || (k === 'orden' && v === 'codigo_desc') ? null : v));
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: merge ? 'merge' : 'merge' });
  }

  private load(): void {
    this.loading.set(true);
    const params: Record<string, unknown> = {
      type: this.section.type,
      condicion: this.section.condicion,
      ...this.filters,
      page: this.page(),
    };
    this.flags().forEach((f) => (params[f] = 1));

    this.api.get<any>('productos', params).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.total.set(res.meta?.total ?? res.data.length);
        this.lastPage.set(res.meta?.last_page ?? 1);
        this.from.set(res.meta?.from ?? 0);
        this.to.set(res.meta?.to ?? 0);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.ui.apiError(e, 'No se pudo cargar el listado.');
      },
    });
  }
}
