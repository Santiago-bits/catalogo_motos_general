import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminApiService, AuditLog } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { AUDIT_ACTIONS, date, num } from '../core/labels';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';
import { PagerComponent } from '../shared/pager.component';

const MODULES: Record<string, string> = {
  productos: 'Productos', marcas: 'Marcas', categorias: 'Categorías', etiquetas: 'Etiquetas', caracteristicas: 'Características',
  servicios: 'Servicios', consultas: 'Consultas', cotizaciones: 'Cotizaciones', usuarios: 'Usuarios', roles: 'Roles',
  configuracion: 'Configuración', sesion: 'Sesión', perfil: 'Perfil', datos: 'Importar / exportar',
};

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [FormsModule, ModalComponent, PagerComponent],
  template: `
    <div class="admin-filters">
      <form (ngSubmit)="apply()">
        <div class="f-field f-field--wide">
          <label class="form-label" for="f-q">Buscar</label>
          <input type="search" class="form-control" id="f-q" name="q" [(ngModel)]="filters.q" placeholder="Texto del evento" />
        </div>
        <div class="f-field">
          <label class="form-label" for="f-mod">Sección</label>
          <select class="form-select" id="f-mod" name="modulo" [(ngModel)]="filters.modulo">
            <option value="">Todas</option>
            @for (m of meta().modules; track m) { <option [value]="m">{{ moduleLabel(m) }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="f-acc">Acción</label>
          <select class="form-select" id="f-acc" name="accion" [(ngModel)]="filters.accion">
            <option value="">Todas</option>
            @for (a of meta().actions; track a) { <option [value]="a">{{ actionLabel(a).label }}</option> }
          </select>
        </div>
        <div class="f-field">
          <label class="form-label" for="f-user">Usuario</label>
          <select class="form-select" id="f-user" name="usuario" [(ngModel)]="filters.usuario">
            <option value="">Todos</option>
            @for (u of meta().users; track u.id) { <option [value]="u.id">{{ u.name }}</option> }
          </select>
        </div>
        <div class="f-field" style="max-width:170px">
          <label class="form-label" for="f-desde">Desde</label>
          <input type="date" class="form-control" id="f-desde" name="desde" [(ngModel)]="filters.desde" />
        </div>
        <div class="f-field" style="max-width:170px">
          <label class="form-label" for="f-hasta">Hasta</label>
          <input type="date" class="form-control" id="f-hasta" name="hasta" [(ngModel)]="filters.hasta" />
        </div>
        <div class="f-actions">
          <button type="submit" class="btn btn-dark"><i class="bi bi-funnel"></i> Filtrar</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">Limpiar</button>
          @if (auth.can('data.export')) { <button type="button" class="btn btn-ghost" (click)="export()"><i class="bi bi-file-earmark-excel"></i> Excel</button> }
        </div>
      </form>
    </div>

    <div class="card-admin">
      <div class="card-admin__head"><h2><i class="bi bi-shield-check"></i> Registro de auditoría <span class="count">{{ num(total()) }} evento(s)</span></h2></div>
      <div class="card-admin__body card-admin__body--flush">
        <div class="table-wrap">
          <table class="table-admin">
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Sección</th><th>Qué pasó</th><th>Origen</th><th>Cambios</th></tr></thead>
            <tbody>
              @for (log of logs(); track log.id) {
                <tr>
                  <td class="nowrap muted small">{{ date(log.created_at, true) }}</td>
                  <td><strong>{{ log.user?.name ?? 'Sistema' }}</strong></td>
                  <td><span class="chip" [class]="'chip--' + actionLabel(log.action).chip">{{ actionLabel(log.action).label }}</span></td>
                  <td class="small">{{ moduleLabel(log.module) }}</td>
                  <td class="small">{{ log.description }}</td>
                  <td class="mono muted">{{ log.ip ?? '—' }}</td>
                  <td>
                    @if (changeCount(log)) {
                      <button type="button" class="btn btn-ghost btn-sm" (click)="detail.set(log)">{{ changeCount(log) }} campo(s)</button>
                    } @else { <span class="muted">—</span> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state">@if (loading()) { Cargando… } @else { <i class="bi bi-inbox"></i>No hay eventos con esos filtros. }</div></td></tr>
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

    <app-modal size="lg" [open]="!!detail()" [title]="'Detalle del evento #' + (detail()?.id ?? '')" (closed)="detail.set(null)">
      @if (detail(); as log) {
        <p style="margin-top:0"><strong>{{ log.user?.name ?? 'Sistema' }}</strong> · {{ date(log.created_at, true) }} · {{ log.description }}</p>
        <table class="table-admin" style="border:1px solid var(--a-line)">
          <thead><tr><th>Campo</th><th>Antes</th><th>Ahora</th></tr></thead>
          <tbody>
            @for (c of changes(log); track c.field) {
              <tr><td class="mono">{{ c.field }}</td><td class="small" style="color:var(--a-red)">{{ c.before }}</td><td class="small" style="color:var(--a-ok)">{{ c.after }}</td></tr>
            }
          </tbody>
        </table>
      }
      <ng-container footer><button type="button" class="btn btn-ghost" (click)="detail.set(null)">Cerrar</button></ng-container>
    </app-modal>
  `,
})
export class AuditComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  auth = inject(AuthService);

  logs = signal<AuditLog[]>([]);
  meta = signal<{ modules: string[]; actions: string[]; users: { id: number; name: string }[] }>({ modules: [], actions: [], users: [] });
  detail = signal<AuditLog | null>(null);
  loading = signal(true);
  page = signal(1);
  lastPage = signal(1);
  total = signal(0);
  filters = { q: '', modulo: '', accion: '', usuario: '', desde: '', hasta: '' };

  date = date;
  num = num;

  ngOnInit(): void {
    this.api.get<any>('auditoria/filtros').subscribe((m) => this.meta.set(m));
    this.route.queryParamMap.subscribe((p) => {
      this.filters = { q: p.get('q') ?? '', modulo: p.get('modulo') ?? '', accion: p.get('accion') ?? '', usuario: p.get('usuario') ?? '', desde: p.get('desde') ?? '', hasta: p.get('hasta') ?? '' };
      this.page.set(Number(p.get('pagina')) || 1);
      this.load();
    });
  }

  moduleLabel(m: string | null): string {
    return m ? MODULES[m] ?? m : '—';
  }

  actionLabel(a: string): { label: string; chip: string } {
    return AUDIT_ACTIONS[a] ?? { label: a, chip: 'neutral' };
  }

  changeCount(log: AuditLog): number {
    return log.changes ? Object.keys(log.changes).length : 0;
  }

  changes(log: AuditLog): { field: string; before: string; after: string }[] {
    return Object.entries(log.changes ?? {}).map(([field, [before, after]]) => ({ field, before: this.show(before), after: this.show(after) }));
  }

  apply(): void {
    const queryParams: Record<string, string | null> = {};
    Object.entries(this.filters).forEach(([k, v]) => (queryParams[k] = v || null));
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goTo(pagina: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pagina }, queryParamsHandling: 'merge' });
  }

  export(): void {
    this.api.download('exportar/auditoria/xlsx', this.filters, 'auditoria.xlsx').subscribe({ error: (e) => this.ui.apiError(e) });
  }

  private show(value: unknown): string {
    if (value === null || value === undefined || value === '') return '(vacío)';
    if (value === true || value === 1) return 'Sí';
    if (value === false || value === 0) return 'No';
    const s = String(value);
    return s.length > 160 ? s.slice(0, 159) + '…' : s;
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<any>('auditoria', { ...this.filters, page: this.page() }).subscribe({
      next: (res) => {
        this.logs.set(res.data);
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
