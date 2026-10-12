import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { INQUIRY_STATUS, date, num } from '../core/labels';

interface DashboardData {
  stats: Record<string, number>;
  review: { label: string; count: number; route: string; flag: string; icon: string; query?: Record<string, string> }[];
  inquiries: { id: number; name: string; message: string | null; status: string; created_at: string; product?: { id: number; name: string } | null }[];
  top_products: { id: number; name: string; type: string; views: number }[];
  top_searches: { term: string; total: number }[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (data(); as d) {
      <!-- ================= NÚMEROS PRINCIPALES ================= -->
      <div class="stat-grid">
        <div class="stat-card stat-card--dark">
          <div class="stat-card__label"><i class="bi bi-bicycle"></i> Motos 0 km</div>
          <div class="stat-card__value">{{ num(d.stats['motos']) }}</div>
          <div class="stat-card__hint">{{ num(d.stats['motos_active']) }} publicadas · <a routerLink="/admin/motos">ver</a></div>
          <i class="bi bi-bicycle stat-card__icon"></i>
        </div>
        <div class="stat-card">
          <div class="stat-card__label"><i class="bi bi-arrow-repeat"></i> Motos usadas</div>
          <div class="stat-card__value">{{ num(d.stats['usadas']) }}</div>
          <div class="stat-card__hint">{{ num(d.stats['usadas_active']) }} publicadas · <a routerLink="/admin/usadas">ver</a></div>
          <i class="bi bi-arrow-repeat stat-card__icon"></i>
        </div>
        <div class="stat-card">
          <div class="stat-card__label"><i class="bi bi-shield-shaded"></i> Cascos</div>
          <div class="stat-card__value">{{ num(d.stats['cascos']) }}</div>
          <div class="stat-card__hint">{{ num(d.stats['cascos_active']) }} publicados · <a routerLink="/admin/cascos">ver</a></div>
          <i class="bi bi-shield-shaded stat-card__icon"></i>
        </div>
        <div class="stat-card">
          <div class="stat-card__label"><i class="bi bi-nut"></i> Repuestos</div>
          <div class="stat-card__value">{{ num(d.stats['repuestos']) }}</div>
          <div class="stat-card__hint">{{ num(d.stats['repuestos_active']) }} publicados · <a routerLink="/admin/repuestos">ver</a></div>
          <i class="bi bi-nut stat-card__icon"></i>
        </div>
        <div class="stat-card" [class.stat-card--accent]="d.stats['inquiries_new'] > 0">
          <div class="stat-card__label"><i class="bi bi-chat-dots"></i> Consultas</div>
          <div class="stat-card__value">{{ num(d.stats['inquiries_total']) }}</div>
          <div class="stat-card__hint">
            @if (d.stats['inquiries_new'] > 0) {
              <a routerLink="/admin/consultas" [queryParams]="{ estado: 'nueva' }">{{ d.stats['inquiries_new'] }} sin responder</a>
            } @else {
              Todo respondido
            }
          </div>
          <i class="bi bi-chat-dots stat-card__icon"></i>
        </div>
      </div>

      <div class="grid-2">
        <div class="stack">
          <!-- ============ PARA REVISAR ============ -->
          <div class="card-admin">
            <div class="card-admin__head">
              <h2><i class="bi bi-clipboard-check"></i> Para revisar</h2>
              <span class="muted small">{{ num(totalReview()) }} pendiente(s)</span>
            </div>
            <div class="card-admin__body card-admin__body--flush">
              @if (d.review.length === 0) {
                <p class="ok-msg"><i class="bi bi-check-circle"></i> No hay nada pendiente. Todo el catálogo publicado está completo.</p>
              } @else {
                <table class="table-admin">
                  <tbody>
                    @for (item of d.review; track item.label) {
                      <tr>
                        <td><i class="bi muted" [class]="'bi-' + item.icon"></i>&nbsp; {{ item.label }}</td>
                        <td class="num"><span class="chip chip--warn">{{ num(item.count) }}</span></td>
                        <td class="actions"><a class="btn btn-ghost btn-sm" [routerLink]="['/admin', item.route]" [queryParams]="item.query ?? reviewQuery(item.flag)">Ver</a></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <!-- Resumen del catálogo -->
          <div class="card-admin">
            <div class="card-admin__head"><h2><i class="bi bi-collection"></i> Resumen del catálogo</h2></div>
            <div class="card-admin__body card-admin__body--flush">
              <table class="table-admin">
                <tbody>
                  <tr><td>Categorías</td><td class="num"><strong>{{ num(d.stats['categories']) }}</strong></td><td class="actions">@if (auth.can('categories.manage')) {<a class="btn btn-ghost btn-sm" routerLink="/admin/categorias">Ver</a>}</td></tr>
                  <tr><td>Marcas</td><td class="num"><strong>{{ num(d.stats['brands']) }}</strong></td><td class="actions">@if (auth.can('brands.manage')) {<a class="btn btn-ghost btn-sm" routerLink="/admin/marcas">Ver</a>}</td></tr>
                  <tr><td>Servicios</td><td class="num"><strong>{{ num(d.stats['services']) }}</strong></td><td class="actions">@if (auth.can('services.manage')) {<a class="btn btn-ghost btn-sm" routerLink="/admin/servicios">Ver</a>}</td></tr>
                  <tr><td>Productos destacados</td><td class="num"><strong>{{ num(d.stats['featured']) }}</strong></td><td></td></tr>
                  <tr><td>Productos en oferta</td><td class="num"><strong>{{ num(d.stats['offers']) }}</strong></td><td></td></tr>
                  <tr><td>Productos sin publicar</td><td class="num"><strong>{{ num(d.stats['inactive']) }}</strong></td><td></td></tr>
                  <tr><td>Cotizaciones pendientes</td><td class="num"><strong>{{ num(d.stats['quotes_pending']) }}</strong></td><td class="actions">@if (auth.can('quotes.view')) {<a class="btn btn-ghost btn-sm" routerLink="/admin/cotizaciones">Ver</a>}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="stack">
          <!-- ============ ÚLTIMAS CONSULTAS ============ -->
          <div class="card-admin">
            <div class="card-admin__head">
              <h2><i class="bi bi-chat-dots-fill"></i> Últimas consultas</h2>
              @if (auth.can('inquiries.view')) { <a routerLink="/admin/consultas" class="small">Ver todas</a> }
            </div>
            <div class="card-admin__body card-admin__body--flush">
              @if (d.inquiries.length === 0) {
                <p class="ok-msg muted">Todavía no llegaron consultas.</p>
              } @else {
                <table class="table-admin">
                  <tbody>
                    @for (inq of d.inquiries; track inq.id) {
                      <tr>
                        <td>
                          <a [routerLink]="['/admin/consultas', inq.id]"><strong>{{ inq.name }}</strong></a>
                          <div class="muted small">{{ inq.product?.name ?? excerpt(inq.message) }}</div>
                        </td>
                        <td class="num muted small">
                          {{ date(inq.created_at) }}
                          @if (inq.status === 'nueva') { <span class="chip chip--accent">Nueva</span> }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <!-- Accesos rápidos -->
          <div class="card-admin">
            <div class="card-admin__head"><h2><i class="bi bi-lightning-charge-fill"></i> Accesos rápidos</h2></div>
            <div class="card-admin__body quick">
              @if (auth.can('products.create')) {
                <a routerLink="/admin/motos/nueva" class="btn btn-accent"><i class="bi bi-plus-lg"></i> Cargar una moto</a>
                <a routerLink="/admin/usadas/nueva" class="btn btn-accent"><i class="bi bi-plus-lg"></i> Cargar una usada</a>
                <a routerLink="/admin/repuestos/nueva" class="btn btn-ghost"><i class="bi bi-plus-lg"></i> Cargar un repuesto</a>
              }
              @if (auth.can('data.import')) { <a routerLink="/admin/importar" class="btn btn-ghost"><i class="bi bi-upload"></i> Importar productos</a> }
              @if (auth.can('data.export')) { <a routerLink="/admin/exportar" class="btn btn-ghost"><i class="bi bi-download"></i> Exportar productos</a> }
              <a href="/" target="_blank" rel="noopener" class="btn btn-ghost"><i class="bi bi-box-arrow-up-right"></i> Ver el sitio publicado</a>
            </div>
          </div>

          @if (d.top_products.length) {
            <div class="card-admin">
              <div class="card-admin__head"><h2><i class="bi bi-eye"></i> Más vistos</h2></div>
              <div class="card-admin__body card-admin__body--flush">
                <table class="table-admin">
                  <tbody>
                    @for (p of d.top_products; track p.id; let i = $index) {
                      <tr>
                        <td class="rank">{{ i + 1 }}</td>
                        <td><a [routerLink]="editLink(p)">{{ p.name }}</a></td>
                        <td class="num muted small">{{ num(p.views) }} vistas</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </div>
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: [`
    .ok-msg { margin: 0; padding: 16px 18px; }
    .ok-msg .bi { color: var(--a-ok); }
    .quick { display: grid; gap: 10px; }
    .rank { width: 32px; font-family: var(--r-display); font-weight: 800; font-size: 18px; color: var(--a-red); }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(AdminApiService);
  auth = inject(AuthService);

  data = signal<DashboardData | null>(null);
  totalReview = computed(() => (this.data()?.review ?? []).reduce((sum, r) => sum + r.count, 0));

  num = num;
  date = date;
  statuses = INQUIRY_STATUS;

  ngOnInit(): void {
    this.api.get<DashboardData>('dashboard').subscribe((d) => this.data.set(d));
  }

  reviewQuery(flag: string): Record<string, string> {
    return { [flag]: '1' };
  }

  editLink(p: { id: number; type: string }): unknown[] {
    const section = p.type === 'moto' ? 'motos' : p.type === 'casco' ? 'cascos' : 'repuestos';
    return ['/admin', section, p.id];
  }

  excerpt(text: string | null): string {
    const t = (text ?? '').replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 59) + '…' : t;
  }
}
