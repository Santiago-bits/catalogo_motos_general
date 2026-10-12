import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { QUOTE_STATUS, date, money, num } from '../core/labels';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';
import { PagerComponent } from '../shared/pager.component';

@Component({
  selector: 'app-admin-quotes',
  standalone: true,
  imports: [FormsModule, ModalComponent, PagerComponent],
  template: `
    <div class="admin-filters">
      <form (ngSubmit)="apply()">
        <div class="f-field f-field--wide">
          <label class="form-label" for="f-q">Buscar</label>
          <input type="search" class="form-control" id="f-q" name="q" [(ngModel)]="filters.q" placeholder="Número, nombre o WhatsApp" />
        </div>
        <div class="f-field">
          <label class="form-label" for="f-estado">Estado</label>
          <select class="form-select" id="f-estado" name="estado" [(ngModel)]="filters.estado">
            <option value="">Todos</option>
            @for (s of statusKeys; track s) { <option [value]="s">{{ statuses[s].label }}</option> }
          </select>
        </div>
        <div class="f-actions">
          <button type="submit" class="btn btn-dark"><i class="bi bi-funnel"></i> Filtrar</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">Limpiar</button>
          @if (auth.can('data.export')) { <button type="button" class="btn btn-ghost" (click)="export()"><i class="bi bi-file-earmark-excel"></i> Excel</button> }
        </div>
      </form>
    </div>

    <div class="card-admin">
      <div class="card-admin__head"><h2><i class="bi bi-receipt"></i> Cotizaciones <span class="count">{{ num(total()) }} registro(s)</span></h2></div>
      <div class="card-admin__body card-admin__body--flush">
        <div class="table-wrap">
          <table class="table-admin">
            <thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th class="num">Ítems</th><th class="num">Total</th><th>Estado</th><th class="actions">Acciones</th></tr></thead>
            <tbody>
              @for (q of quotes(); track q.id) {
                <tr>
                  <td class="mono"><strong>{{ q.number }}</strong></td>
                  <td class="muted small nowrap">{{ date(q.created_at, true) }}</td>
                  <td><strong>{{ q.name }}</strong><div class="muted small">{{ q.phone || '—' }}</div></td>
                  <td class="num">{{ q.items?.length ?? 0 }}</td>
                  <td class="num"><strong>{{ money(q.total, q.currency) }}</strong></td>
                  <td>
                    @if (auth.can('quotes.manage')) {
                      <select class="form-select status-select" [ngModel]="q.status" (ngModelChange)="setStatus(q, $event)" [name]="'st-' + q.id">
                        @for (s of statusKeys; track s) { <option [value]="s">{{ statuses[s].label }}</option> }
                      </select>
                    } @else {
                      <span class="chip" [class]="'chip--' + (statuses[q.status]?.chip ?? 'neutral')">{{ statuses[q.status]?.label }}</span>
                    }
                  </td>
                  <td class="actions">
                    <button type="button" class="btn-icon" (click)="detail.set(q)" title="Ver detalle"><i class="bi bi-eye"></i></button>
                    @if (auth.can('quotes.manage')) { <button type="button" class="btn-icon btn-icon--danger" (click)="remove(q)" title="Eliminar"><i class="bi bi-trash"></i></button> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state">@if (loading()) { Cargando… } @else { <i class="bi bi-inbox"></i>No hay cotizaciones. }</div></td></tr>
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

    <app-modal size="lg" [open]="!!detail()" [title]="'Cotización ' + (detail()?.number ?? '')" (closed)="detail.set(null)">
      @if (detail(); as q) {
        <p><strong>{{ q.name }}</strong>@if (q.phone) { · WhatsApp {{ q.phone }} }</p>
        <table class="table-admin" style="border:1px solid var(--a-line)">
          <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Subtotal</th></tr></thead>
          <tbody>
            @for (it of q.items; track it.id) {
              <tr><td>{{ it.product_name }}</td><td class="num">{{ it.quantity }}</td><td class="num">{{ money(it.unit_price, q.currency) }}</td><td class="num">{{ money(it.unit_price * it.quantity, q.currency) }}</td></tr>
            }
          </tbody>
        </table>
        <p style="text-align:right;margin-top:12px">Total: <strong style="font-family:var(--r-display);font-size:24px;color:var(--a-red)">{{ money(q.total, q.currency) }}</strong></p>
        @if (q.message) { <h3 class="form-section__title">Comentario</h3><p style="white-space:pre-line">{{ q.message }}</p> }
      }
      <ng-container footer>
        @if (waLink(detail()); as wa) { <a class="btn btn-wa" [href]="wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Responder por WhatsApp</a> }
        <button type="button" class="btn btn-ghost" (click)="detail.set(null)">Cerrar</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`.status-select { min-height: 34px; padding: 4px 8px; font-size: 14px; max-width: 150px; }`],
})
export class QuotesComponent implements OnInit {
  /** Respuesta por WhatsApp, sólo si el pedido trae un número. */
  waLink(q: any): string | null {
    const digits = String(q?.phone ?? '').replace(/\D+/g, '');
    if (!digits) return null;
    const number = digits.length <= 11 && !digits.startsWith('54') ? '54' + digits : digits;
    return `https://wa.me/${number}?text=${encodeURIComponent(`Hola ${q.name}, te escribimos de RODADO Motos por tu cotización ${q.number}.`)}`;
  }

  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  auth = inject(AuthService);

  quotes = signal<any[]>([]);
  detail = signal<any | null>(null);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);
  filters = { q: '', estado: '' };

  statuses = QUOTE_STATUS;
  statusKeys = Object.keys(QUOTE_STATUS);
  date = date;
  money = money;
  num = num;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((p) => {
      this.filters = { q: p.get('q') ?? '', estado: p.get('estado') ?? '' };
      this.page.set(Number(p.get('pagina')) || 1);
      this.load();
    });
  }

  apply(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { q: this.filters.q || null, estado: this.filters.estado || null } });
  }

  clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goTo(pagina: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pagina }, queryParamsHandling: 'merge' });
  }

  setStatus(q: any, status: string): void {
    this.api.put(`cotizaciones/${q.id}`, { status }).subscribe({
      next: () => {
        q.status = status;
        this.ui.success(`Cotización ${q.number}: ${QUOTE_STATUS[status].label.toLowerCase()}.`);
        this.api.counters().subscribe((c) => this.ui.counters.set(c));
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  export(): void {
    this.api.download('exportar/cotizaciones/xlsx', {}, 'cotizaciones.xlsx').subscribe({ error: (e) => this.ui.apiError(e) });
  }

  async remove(q: any): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar la cotización ${q.number}?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`cotizaciones/${q.id}`).subscribe({
      next: () => {
        this.ui.success('Cotización eliminada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<any>('cotizaciones', { ...this.filters, page: this.page() }).subscribe({
      next: (res) => {
        this.quotes.set(res.data);
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
