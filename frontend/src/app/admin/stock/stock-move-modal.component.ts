import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';

export type StockMoveType = 'ingreso' | 'egreso' | 'ajuste';

export interface StockTarget {
  id: number;
  name: string;
  code: string;
  stock_qty: number;
}

/** Motivos que tienen sentido para cada tipo de movimiento. */
const REASONS_BY_TYPE: Record<StockMoveType, string[]> = {
  ingreso: ['compra', 'devolucion', 'otro'],
  egreso: ['venta', 'reserva', 'uso_taller', 'rotura', 'otro'],
  ajuste: ['conteo', 'otro'],
};

const REASON_LABELS: Record<string, string> = {
  compra: 'Compra a proveedor',
  devolucion: 'Devolución de cliente',
  venta: 'Venta',
  reserva: 'Seña / reserva entregada',
  uso_taller: 'Uso en taller',
  rotura: 'Rotura o pérdida',
  conteo: 'Conteo / inventario',
  otro: 'Otro',
};

/** Ingreso, egreso o ajuste de stock de un producto. */
@Component({
  selector: 'app-stock-move-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal [open]="!!product" [title]="'Stock · ' + (product?.name ?? '')" (closed)="closed.emit()">
      @if (product; as p) {
        <div class="current">
          <span class="muted small">Stock actual</span>
          <strong>{{ p.stock_qty }}</strong>
          <span class="mono muted small">{{ p.code }}</span>
        </div>

        <div class="types" role="radiogroup" aria-label="Tipo de movimiento">
          <button type="button" role="radio" [attr.aria-checked]="type === 'ingreso'" (click)="setType('ingreso')"><i class="bi bi-plus-circle"></i> Ingreso</button>
          <button type="button" role="radio" [attr.aria-checked]="type === 'egreso'" (click)="setType('egreso')"><i class="bi bi-dash-circle"></i> Egreso</button>
          <button type="button" role="radio" [attr.aria-checked]="type === 'ajuste'" (click)="setType('ajuste')"><i class="bi bi-sliders"></i> Ajuste</button>
        </div>

        <div class="form-grid" style="margin-top:16px">
          <div>
            <label class="form-label" for="sm-qty">{{ type === 'ajuste' ? 'Stock real contado' : 'Cantidad' }}</label>
            <input class="form-control" type="number" min="0" id="sm-qty" name="sm-qty" [(ngModel)]="quantity" (keyup.enter)="save()" />
          </div>
          <div>
            <label class="form-label" for="sm-reason">Motivo</label>
            <select class="form-select" id="sm-reason" name="sm-reason" [(ngModel)]="reason">
              @for (r of reasons(); track r) { <option [value]="r">{{ reasonLabel(r) }}</option> }
            </select>
          </div>
          <div class="span-all">
            <label class="form-label" for="sm-note">Nota (opcional)</label>
            <input class="form-control" id="sm-note" name="sm-note" [(ngModel)]="note" maxlength="255" placeholder="Ej.: Factura 0001-00012345, vendida a Juan Pérez" />
          </div>
        </div>

        <div class="result" [class.result--bad]="after() < 0">
          @if (after() < 0) {
            <i class="bi bi-exclamation-triangle"></i> No alcanza: hay {{ p.stock_qty }} unidad(es).
          } @else {
            Queda en <strong>{{ after() }}</strong> unidad(es)
            @if (after() === 0) { <span class="muted"> · el producto pasa a “Consultar”</span> }
            @if (p.stock_qty === 0 && after() > 0) { <span class="muted"> · el producto vuelve a “Disponible”</span> }
          }
        </div>
      }
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="save()" [disabled]="saving() || after() < 0 || !validQty()"><i class="bi bi-check-lg"></i> {{ saving() ? 'Guardando…' : 'Registrar' }}</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    .current { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
    .current strong { font-family: var(--r-display); font-weight: 800; font-size: 40px; line-height: 1; }
    .types { display: grid; grid-template-columns: repeat(3, 1fr); border: 2px solid #0A0A0A; }
    .types button { border: 0; background: #FFF; min-height: 42px; font-family: var(--r-display); font-weight: 700; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; justify-content: center; }
    .types button[aria-checked="true"] { background: #0A0A0A; color: #FFF; }
    .result { margin-top: 16px; padding: 12px 14px; background: #F4F4F4; border-left: 4px solid #1F7A45; }
    .result--bad { border-left-color: #E2001A; color: #E2001A; font-weight: 600; }
  `],
})
export class StockMoveModalComponent implements OnChanges {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  @Input() product: StockTarget | null = null;
  @Input() initialType: StockMoveType = 'ingreso';
  @Output() closed = new EventEmitter<void>();
  /** Devuelve el producto con el stock y el estado actualizados. */
  @Output() saved = new EventEmitter<{ id: number; stock_qty: number; availability: string; stock_status: string }>();

  type: StockMoveType = 'ingreso';
  quantity: number | null = 1;
  reason = 'compra';
  note = '';
  saving = signal(false);

  ngOnChanges(): void {
    if (this.product) {
      this.setType(this.initialType);
      this.note = '';
    }
  }

  setType(type: StockMoveType): void {
    this.type = type;
    this.reason = REASONS_BY_TYPE[type][0];
    this.quantity = type === 'ajuste' ? this.product?.stock_qty ?? 0 : 1;
  }

  reasons(): string[] {
    return REASONS_BY_TYPE[this.type];
  }

  reasonLabel(r: string): string {
    return REASON_LABELS[r] ?? r;
  }

  validQty(): boolean {
    const q = Number(this.quantity);
    return Number.isInteger(q) && q >= 0 && (this.type === 'ajuste' || q > 0);
  }

  after(): number {
    const stock = this.product?.stock_qty ?? 0;
    const q = Number(this.quantity) || 0;
    if (this.type === 'ingreso') return stock + q;
    if (this.type === 'egreso') return stock - q;
    return q;
  }

  save(): void {
    const p = this.product;
    if (!p || !this.validQty() || this.after() < 0) return;
    this.saving.set(true);
    this.api.post<any>(`stock/${p.id}/movimientos`, { type: this.type, quantity: Number(this.quantity), reason: this.reason, note: this.note || null }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.ui.success(`Stock de «${p.name}»: ${res.stock_qty} unidad(es).`);
        this.saved.emit({ id: p.id, stock_qty: res.stock_qty, availability: res.availability, stock_status: res.stock_status });
      },
      error: (e) => {
        this.saving.set(false);
        this.ui.apiError(e);
      },
    });
  }
}
