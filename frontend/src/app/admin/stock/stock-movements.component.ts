import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { date, num } from '../core/labels';
import { UiService } from '../core/ui.service';
import { PagerComponent } from '../shared/pager.component';

interface Movement {
  id: number;
  product_id: number;
  type: 'ingreso' | 'egreso' | 'ajuste';
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  note: string | null;
  created_at: string;
  product?: { id: number; name: string; code: string; type: string; slug: string } | null;
  user?: { id: number; name: string } | null;
}

const TYPES: Record<string, { label: string; chip: string; icon: string }> = {
  ingreso: { label: 'Ingreso', chip: 'ok', icon: 'bi-plus-circle' },
  egreso: { label: 'Egreso', chip: 'danger', icon: 'bi-dash-circle' },
  ajuste: { label: 'Ajuste', chip: 'info', icon: 'bi-sliders' },
};

@Component({
  selector: 'app-admin-stock-movements',
  standalone: true,
  imports: [FormsModule, RouterLink, PagerComponent],
  template: `
    @if (productName()) {
      <div class="alert alert--info">
        <span><i class="bi bi-funnel-fill"></i> Mostrando sólo los movimientos de <strong>{{ productName() }}</strong>.</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="clear()">Ver todos</button>
      </div>
    }

    <div class="admin-filters">
      <form (ngSubmit)="apply()">
        <div class="f-field f-field--wide">
          <label class="form-label" for="m-q">Producto</label>
          <input type="search" class="form-control" id="m-q" name="q" [(ngModel)]="filters.q" placeholder="Nombre o código" />
        </div>
        <div class="f-field">
          <label class="form-label" for="m-type">Tipo</label>
          <select class="form-select" id="m-type" name="tipo" [(ngModel)]="filters.tipo">
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="m-user">Usuario</label>
          <select class="form-select" id="m-user" name="usuario" [(ngModel)]="filters.usuario">
            <option value="">Todos</option>
            @for (u of users(); track u.id) { <option [value]="u.id">{{ u.name }}</option> }
          </select>
        </div>
        <div class="f-field" style="max-width:170px">
          <label class="form-label" for="m-from">Desde</label>
          <input type="date" class="form-control" id="m-from" name="desde" [(ngModel)]="filters.desde" />
        </div>
        <div class="f-field" style="max-width:170px">
          <label class="form-label" for="m-to">Hasta</label>
          <input type="date" class="form-control" id="m-to" name="hasta" [(ngModel)]="filters.hasta" />
        </div>
        <div class="f-actions">
          <button type="submit" class="btn btn-dark"><i class="bi bi-funnel"></i> Filtrar</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">Limpiar</button>
        </div>
      </form>
    </div>

    <div class="card-admin">
      <div class="card-admin__head">
        <h2><i class="bi bi-arrow-left-right"></i> Movimientos de stock <span class="count">{{ num(total()) }} registro(s)</span></h2>
        <a routerLink="/admin/stock" class="btn btn-ghost btn-sm"><i class="bi bi-box-seam"></i> Volver al inventario</a>
      </div>
      <div class="card-admin__body card-admin__body--flush">
        <div class="table-wrap">
          <table class="table-admin">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="num">Cantidad</th><th class="num">Stock</th><th>Motivo</th><th>Usuario</th></tr></thead>
            <tbody>
              @for (m of movements(); track m.id) {
                <tr>
                  <td class="nowrap muted small">{{ date(m.created_at, true) }}</td>
                  <td>
                    @if (m.product) {
                      <strong>{{ m.product.name }}</strong>
                      <span class="mono muted" style="display:block">{{ m.product.code }}</span>
                    } @else { <span class="muted">(producto eliminado)</span> }
                  </td>
                  <td><span class="chip" [class]="'chip--' + types[m.type].chip"><i class="bi" [class]="types[m.type].icon"></i> {{ types[m.type].label }}</span></td>
                  <td class="num"><strong [class.plus]="m.quantity > 0" [class.minus]="m.quantity < 0">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</strong></td>
                  <td class="num nowrap"><span class="muted">{{ m.stock_before }}</span> <i class="bi bi-arrow-right muted"></i> <strong>{{ m.stock_after }}</strong></td>
                  <td class="small">
                    {{ reasonLabel(m.reason) }}
                    @if (m.note) { <span class="muted" style="display:block">{{ m.note }}</span> }
                  </td>
                  <td class="small">{{ m.user?.name ?? 'Sistema' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state">@if (loading()) { Cargando… } @else { <i class="bi bi-inbox"></i>No hay movimientos con esos filtros. }</div></td></tr>
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
  styles: [`.plus { color: var(--a-ok); } .minus { color: var(--a-red); } .chip .bi { font-size: 12px; }`],
})
export class StockMovementsComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);

  movements = signal<Movement[]>([]);
  users = signal<{ id: number; name: string }[]>([]);
  reasons = signal<Record<string, string>>({});
  productName = signal<string | null>(null);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);

  filters = { q: '', tipo: '', usuario: '', desde: '', hasta: '', producto: '' };

  types = TYPES;
  date = date;
  num = num;

  ngOnInit(): void {
    this.api.get<{ reasons: Record<string, string>; users: { id: number; name: string }[] }>('stock/opciones').subscribe((m) => {
      this.reasons.set(m.reasons);
      this.users.set(m.users);
    });
    this.route.queryParamMap.subscribe((p) => {
      this.filters = {
        q: p.get('q') ?? '',
        tipo: p.get('tipo') ?? '',
        usuario: p.get('usuario') ?? '',
        desde: p.get('desde') ?? '',
        hasta: p.get('hasta') ?? '',
        producto: p.get('producto') ?? '',
      };
      this.productName.set(this.filters.producto ? p.get('nombre') ?? `producto #${this.filters.producto}` : null);
      this.page.set(Number(p.get('pagina')) || 1);
      this.load();
    });
  }

  reasonLabel(r: string | null): string {
    return r ? this.reasons()[r] ?? r : '—';
  }

  apply(): void {
    const queryParams: Record<string, string | null> = {};
    Object.entries(this.filters).forEach(([k, v]) => (queryParams[k] = v || null));
    queryParams['nombre'] = this.filters.producto ? this.productName() : null;
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goTo(pagina: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pagina }, queryParamsHandling: 'merge' });
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<any>('stock/movimientos', { ...this.filters, page: this.page() }).subscribe({
      next: (res) => {
        this.movements.set(res.data);
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
