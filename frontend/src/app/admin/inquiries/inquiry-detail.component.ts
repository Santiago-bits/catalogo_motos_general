import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, AdminInquiry } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { CHANNELS, INQUIRY_STATUS, date } from '../core/labels';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'app-admin-inquiry-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (inquiry(); as i) {
      <div class="grid-side">
        <div class="card-admin">
          <div class="card-admin__head">
            <h2><i class="bi bi-chat-left-quote"></i> Consulta de {{ i.name }}</h2>
            <span class="chip" [class]="'chip--' + (statuses[i.status]?.chip ?? 'neutral')">{{ statuses[i.status]?.label }}</span>
          </div>
          <div class="card-admin__body">
            <dl class="data">
              <div><dt>Recibida</dt><dd>{{ date(i.created_at, true) }}</dd></div>
              <div><dt>Canal</dt><dd>{{ channelLabel(i.source) }}</dd></div>
              @if (i.phone) { <div><dt>WhatsApp</dt><dd>{{ i.phone }}</dd></div> }
              @if (i.product) {
                <div class="wide"><dt>Producto</dt><dd><a [routerLink]="productLink(i)">{{ i.product.name }}</a> <span class="muted mono">{{ i.product.code }}</span></dd></div>
              }
              @if (i.replied_at) { <div><dt>Respondida</dt><dd>{{ date(i.replied_at, true) }}</dd></div> }
            </dl>

            <h3 class="form-section__title"><i class="bi bi-chat-text"></i> Mensaje</h3>
            <blockquote class="msg">{{ i.message || '(sin mensaje)' }}</blockquote>

            <div class="row-gap" style="margin-top:18px">
              @if (whatsappUrl()) {
                <a class="btn btn-wa btn-sm" [href]="whatsappUrl()" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Responder por WhatsApp</a>
              }
              <a routerLink="/admin/consultas" class="btn btn-ghost btn-sm ml-auto"><i class="bi bi-arrow-left"></i> Volver</a>
            </div>
          </div>
        </div>

        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-sliders"></i> Gestión</h2></div>
          <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="save()">
            <div>
              <label class="form-label" for="i-status">Estado</label>
              <select class="form-select" id="i-status" name="status" [(ngModel)]="form.status" [disabled]="!canManage">
                @for (s of statusKeys; track s) { <option [value]="s">{{ statuses[s].label }}</option> }
              </select>
            </div>
            <div>
              <label class="form-label" for="i-assigned">Responsable</label>
              <select class="form-select" id="i-assigned" name="assigned_to" [(ngModel)]="form.assigned_to" [disabled]="!canManage">
                <option [ngValue]="null">Sin asignar</option>
                @for (u of operators(); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }
              </select>
            </div>
            <div>
              <label class="form-label" for="i-note">Nota interna</label>
              <textarea class="form-control" id="i-note" name="internal_note" rows="5" [(ngModel)]="form.internal_note" [disabled]="!canManage" placeholder="Sólo la ve el equipo. Ej.: Le pasé precio con financiación en 12 cuotas."></textarea>
            </div>
            @if (canManage) {
              <button type="submit" class="btn btn-accent btn-block" [disabled]="saving()"><i class="bi bi-check-lg"></i> {{ saving() ? 'Guardando…' : 'Guardar' }}</button>
              <button type="button" class="btn btn-danger btn-block" (click)="remove()"><i class="bi bi-trash"></i> Eliminar consulta</button>
            }
          </form>
        </div>
      </div>
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: [`
    .data { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px 20px; }
    .data .wide { grid-column: 1 / -1; }
    .data dt { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-muted); }
    .data dd { margin: 4px 0 0; }
    .msg { margin: 0; padding: 16px 18px; background: #FAFAF8; border-left: 3px solid var(--a-red); white-space: pre-line; line-height: 1.6; }
  `],
})
export class InquiryDetailComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  private auth = inject(AuthService);

  inquiry = signal<AdminInquiry | null>(null);
  operators = signal<{ id: number; name: string }[]>([]);
  whatsappUrl = signal<string | null>(null);
  saving = signal(false);
  form: { status: string; assigned_to: number | null; internal_note: string } = { status: 'nueva', assigned_to: null, internal_note: '' };

  statuses = INQUIRY_STATUS;
  statusKeys = Object.keys(INQUIRY_STATUS);
  date = date;
  canManage = false;

  ngOnInit(): void {
    this.canManage = this.auth.can('inquiries.manage');
    const id = this.route.snapshot.paramMap.get('id');
    this.api.get<any>(`consultas/${id}`).subscribe({
      next: (res) => {
        this.set(res.inquiry);
        this.operators.set(res.operators);
        this.whatsappUrl.set(res.whatsapp_url);
        // Al abrirla pasa a "en proceso": se actualiza el número del menú.
        this.api.counters().subscribe((c) => this.ui.counters.set(c));
      },
      error: (e) => {
        this.ui.apiError(e, 'La consulta no existe.');
        this.router.navigate(['/admin/consultas']);
      },
    });
  }

  channelLabel(c: string | null): string {
    return c ? CHANNELS[c] ?? c : 'Web';
  }

  productLink(i: AdminInquiry): unknown[] {
    const section = i.product?.type === 'casco' ? 'cascos' : i.product?.type === 'repuesto' ? 'repuestos' : 'motos';
    return ['/admin', section, i.product?.id];
  }

  save(): void {
    const i = this.inquiry();
    if (!i) return;
    this.saving.set(true);
    this.api.put<AdminInquiry>(`consultas/${i.id}`, this.form).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.set(updated);
        this.ui.success('Consulta actualizada.');
        this.api.counters().subscribe((c) => this.ui.counters.set(c));
      },
      error: (e) => {
        this.saving.set(false);
        this.ui.apiError(e);
      },
    });
  }

  async remove(): Promise<void> {
    const i = this.inquiry();
    if (!i || !(await this.ui.confirm(`¿Eliminar la consulta de ${i.name}?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`consultas/${i.id}`).subscribe({
      next: () => {
        this.ui.success('Consulta eliminada.');
        this.router.navigate(['/admin/consultas']);
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private set(i: AdminInquiry): void {
    this.inquiry.set(i);
    this.form = { status: i.status, assigned_to: i.assigned_to, internal_note: i.internal_note ?? '' };
  }
}
