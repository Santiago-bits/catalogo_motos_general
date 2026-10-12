import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, AdminInquiry } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { CHANNELS, INQUIRY_STATUS, date, num } from '../core/labels';
import { UiService } from '../core/ui.service';
import { PagerComponent } from '../shared/pager.component';

@Component({
  selector: 'app-admin-inquiries',
  standalone: true,
  imports: [FormsModule, RouterLink, PagerComponent],
  template: `
    <div class="admin-filters">
      <form (ngSubmit)="apply()">
        <div class="f-field f-field--wide">
          <label class="form-label" for="f-q">Buscar</label>
          <input type="search" class="form-control" id="f-q" name="q" [(ngModel)]="filters.q" placeholder="Nombre, WhatsApp o texto" />
        </div>
        <div class="f-field">
          <label class="form-label" for="f-estado">Estado</label>
          <select class="form-select" id="f-estado" name="estado" [(ngModel)]="filters.estado">
            <option value="">Todos</option>
            @for (s of statusKeys; track s) { <option [value]="s">{{ statuses[s].label }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="f-canal">Canal</label>
          <select class="form-select" id="f-canal" name="canal" [(ngModel)]="filters.canal">
            <option value="">Todos</option>
            @for (c of channels(); track c) { <option [value]="c">{{ channelLabel(c) }}</option> }
          </select>
        </div>
        <div class="f-actions">
          <button type="submit" class="btn btn-dark"><i class="bi bi-funnel"></i> Filtrar</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">Limpiar</button>
          @if (auth.can('data.export')) {
            <button type="button" class="btn btn-ghost" (click)="export()" title="Exportar a Excel"><i class="bi bi-file-earmark-excel"></i> Excel</button>
          }
        </div>
      </form>
    </div>

    <div class="card-admin">
      <div class="card-admin__head">
        <h2><i class="bi bi-chat-dots-fill"></i> Consultas <span class="count">{{ num(total()) }} registro(s)</span></h2>
      </div>
      <div class="card-admin__body card-admin__body--flush">
        <div class="table-wrap">
          <table class="table-admin">
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Mensaje</th><th>Canal</th><th>Estado</th><th class="actions">Acciones</th></tr></thead>
            <tbody>
              @for (i of inquiries(); track i.id) {
                <tr [class.unread]="i.status === 'nueva'">
                  <td class="nowrap muted small">{{ date(i.created_at, true) }}</td>
                  <td>
                    <a [routerLink]="['/admin/consultas', i.id]"><strong>{{ i.name }}</strong></a>
                    <div class="muted small">{{ i.phone || '—' }}</div>
                  </td>
                  <td>@if (i.product) { <span class="chip chip--neutral">{{ cut(i.product.name, 28) }}</span> } @else { <span class="muted">—</span> }</td>
                  <td class="small" style="max-width:320px">{{ cut(i.message, 90) }}</td>
                  <td><span class="chip chip--neutral">{{ channelLabel(i.source) }}</span></td>
                  <td>
                    <span class="chip" [class]="'chip--' + (statuses[i.status]?.chip ?? 'neutral')">{{ statuses[i.status]?.label ?? i.status }}</span>
                    @if (i.assignee) { <div class="muted small">{{ i.assignee.name }}</div> }
                  </td>
                  <td class="actions">
                    <a class="btn-icon" [routerLink]="['/admin/consultas', i.id]" title="Ver"><i class="bi bi-eye"></i></a>
                    @if (auth.can('inquiries.manage')) {
                      <button type="button" class="btn-icon btn-icon--danger" (click)="remove(i)" title="Eliminar"><i class="bi bi-trash"></i></button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state">@if (loading()) { Cargando… } @else { <i class="bi bi-inbox"></i>No hay consultas que coincidan. }</div></td></tr>
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
  styles: [`.unread td { background: #FFF8F9; } .unread td:first-child { box-shadow: inset 3px 0 0 var(--a-red); }`],
})
export class InquiriesComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  auth = inject(AuthService);

  inquiries = signal<AdminInquiry[]>([]);
  channels = signal<string[]>([]);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);
  filters = { q: '', estado: '', canal: '' };

  statuses = INQUIRY_STATUS;
  statusKeys = Object.keys(INQUIRY_STATUS);
  date = date;
  num = num;

  ngOnInit(): void {
    this.api.get<string[]>('consultas/canales').subscribe((c) => this.channels.set(c));
    this.route.queryParamMap.subscribe((p) => {
      this.filters = { q: p.get('q') ?? '', estado: p.get('estado') ?? '', canal: p.get('canal') ?? '' };
      this.page.set(Number(p.get('pagina')) || 1);
      this.load();
    });
  }

  channelLabel(c: string | null): string {
    return c ? CHANNELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1) : 'Web';
  }

  cut(text: string | null | undefined, max: number): string {
    const t = (text ?? '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t || '—';
  }

  apply(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.clean(this.filters), pagina: null } });
  }

  clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goTo(pagina: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pagina }, queryParamsHandling: 'merge' });
  }

  export(): void {
    this.api.download('exportar/consultas/xlsx', {}, 'consultas.xlsx').subscribe({ error: (e) => this.ui.apiError(e, 'No se pudo exportar.') });
  }

  async remove(i: AdminInquiry): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar la consulta de ${i.name}?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`consultas/${i.id}`).subscribe({
      next: () => {
        this.ui.success('Consulta eliminada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private clean(values: Record<string, string>): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    Object.entries(values).forEach(([k, v]) => (out[k] = v || null));
    return out;
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<any>('consultas', { ...this.filters, page: this.page() }).subscribe({
      next: (res) => {
        this.inquiries.set(res.data);
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
