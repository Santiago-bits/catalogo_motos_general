import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';

interface ColumnDef {
  column: string;
  kind: string;
  options: string[] | null;
  required: boolean;
}

interface Preview {
  token: string;
  type: 'moto' | 'casco' | 'repuesto';
  name: string;
  message: string;
  columns: string[];
  valid: { line: number; raw: Record<string, string> }[];
  invalid: { line: number; errors: string[]; raw: Record<string, string> }[];
  valid_count: number;
  invalid_count: number;
}

const TYPES = [
  { value: 'motos-nuevas', label: 'Motos 0 km', file: '0 km', hint: 'Todas las filas entran como 0 km (la plantilla no lleva la columna "condicion").' },
  { value: 'motos-usadas', label: 'Motos usadas', file: 'usadas', hint: 'Todas las filas entran como usadas (la plantilla no lleva la columna "condicion").' },
  { value: 'motos', label: 'Motos 0 km y usadas (mezcladas)', file: 'mixtas', hint: 'La columna "condicion" indica si cada moto es nueva, usada o reacondicionada. Si queda vacía, entra como 0 km.' },
  { value: 'cascos', label: 'Cascos y accesorios', file: 'cascos', hint: '' },
  { value: 'repuestos', label: 'Repuestos', file: 'repuestos', hint: '' },
];

const KIND_LABEL: Record<string, string> = {
  text: 'Texto', longtext: 'Texto largo', int: 'Número entero', decimal: 'Número', bool: 'si / no', currency: 'ARS / USD', enum: 'Lista',
};

@Component({
  selector: 'app-admin-import',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="grid-2">
      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-upload"></i> Importar desde CSV</h2></div>
        <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="preview()">
          <p class="muted" style="margin:0">
            Subí un CSV con la plantilla. Primero vas a ver una <strong>previsualización</strong> con las filas correctas y las que tienen error;
            no se guarda nada hasta que confirmes. Los productos se identifican por <strong>código</strong>: si ya existe, se actualiza.
          </p>
          <div>
            <label class="form-label" for="imp-tipo">¿Qué vas a importar?</label>
            <select class="form-select" id="imp-tipo" name="tipo" [(ngModel)]="tipo">
              @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label" for="imp-file">Archivo CSV</label>
            <input class="form-control" type="file" id="imp-file" accept=".csv,.txt" (change)="file = $any($event.target).files?.[0] ?? null" />
            @if (currentHint()) { <p class="form-hint" style="margin-bottom:8px"><i class="bi bi-info-circle"></i> {{ currentHint() }}</p> }
            <p class="form-hint">Máximo 6 MB. Separador punto y coma o coma (se detecta solo). Si tenés un Excel, guardalo como “CSV (delimitado por punto y coma)”.</p>
          </div>
          <button type="submit" class="btn btn-accent btn-block" [disabled]="!file || busy()"><i class="bi bi-eye"></i> {{ busy() ? 'Leyendo…' : 'Previsualizar' }}</button>
          <div class="row-gap">
            <span class="muted small">Plantillas:</span>
            @for (t of types; track t.value) {
              <button type="button" class="btn btn-ghost btn-sm" (click)="template(t.value)"><i class="bi bi-file-earmark-spreadsheet"></i> {{ t.file }}</button>
            }
          </div>
        </form>
      </div>

      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-list-columns"></i> Columnas de la plantilla</h2></div>
        <div class="card-admin__body">
          <p class="muted small" style="margin-top:0">Las columnas vacías no se tocan (al actualizar se conserva lo que ya había). Obligatorias: <strong>codigo</strong> y <strong>nombre</strong>.</p>
          @if (columns()[tipo]; as cols) {
            <div class="table-wrap" style="max-height:420px;overflow-y:auto">
              <table class="table-admin">
                <thead><tr><th>Columna</th><th>Tipo</th><th>Valores</th></tr></thead>
                <tbody>
                  @for (c of cols; track c.column) {
                    <tr>
                      <td class="mono">{{ c.column }}@if (c.required) { <strong style="color:var(--a-red)"> *</strong> }</td>
                      <td class="small">{{ kindLabel(c.kind) }}</td>
                      <td class="small muted">{{ c.options?.join(', ') ?? '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>

    @if (result(); as r) {
      <div class="card-admin" style="margin-top:20px">
        <div class="card-admin__head"><h2><i class="bi bi-check-circle"></i> Importación terminada</h2></div>
        <div class="card-admin__body">
          <div class="stat-grid" style="margin-bottom:12px">
            <div class="stat-card"><div class="stat-card__label">Creados</div><div class="stat-card__value">{{ r.created }}</div></div>
            <div class="stat-card"><div class="stat-card__label">Actualizados</div><div class="stat-card__value">{{ r.updated }}</div></div>
            <div class="stat-card"><div class="stat-card__label">Salteados</div><div class="stat-card__value">{{ r.skipped }}</div></div>
            <div class="stat-card" [class.stat-card--warn]="r.errors.length"><div class="stat-card__label">Con error</div><div class="stat-card__value">{{ r.errors.length }}</div></div>
          </div>
          @for (e of r.errors.slice(0, 20); track $index) { <div class="alert alert--danger"><span>{{ e }}</span></div> }
          <button type="button" class="btn btn-dark" (click)="goToSection(r.section, r.type)"><i class="bi bi-arrow-right"></i> Ver el listado</button>
        </div>
      </div>
    }

    @if (data(); as p) {
      <div class="card-admin" style="margin-top:20px">
        <div class="card-admin__head">
          <h2><i class="bi bi-eye"></i> Previsualización · {{ p.name }}</h2>
          <span class="muted small">{{ p.message }}</span>
        </div>
        <div class="card-admin__body">
          @if (p.invalid_count) {
            <h3 class="form-section__title" style="margin-top:0;color:var(--a-red)"><i class="bi bi-exclamation-triangle"></i> Filas con error (no se importan) · {{ p.invalid_count }}</h3>
            <div class="table-wrap" style="max-height:300px;overflow-y:auto;border:1px solid var(--a-line)">
              <table class="table-admin">
                <thead><tr><th>Línea</th><th>Código</th><th>Nombre</th><th>Errores</th></tr></thead>
                <tbody>
                  @for (row of p.invalid; track row.line) {
                    <tr><td class="mono">{{ row.line }}</td><td class="mono">{{ row.raw['codigo'] || '—' }}</td><td>{{ row.raw['nombre'] || '—' }}</td><td class="small" style="color:var(--a-red)">{{ row.errors.join(' · ') }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <h3 class="form-section__title" [style.margin-top]="p.invalid_count ? '22px' : '0'"><i class="bi bi-check-circle" style="color:var(--a-ok)"></i> Filas correctas · {{ p.valid_count }}</h3>
          @if (p.valid_count) {
            <div class="table-wrap" style="max-height:340px;overflow-y:auto;border:1px solid var(--a-line)">
              <table class="table-admin">
                <thead><tr><th>Línea</th><th>Código</th><th>Nombre</th><th>Marca</th><th>Categoría</th><th class="num">Precio</th></tr></thead>
                <tbody>
                  @for (row of p.valid; track row.line) {
                    <tr><td class="mono">{{ row.line }}</td><td class="mono">{{ row.raw['codigo'] }}</td><td>{{ row.raw['nombre'] }}</td><td>{{ row.raw['marca'] || '—' }}</td><td>{{ row.raw['categoria'] || '—' }}</td><td class="num">{{ row.raw['precio'] || '—' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            @if (p.valid_count > p.valid.length) { <p class="form-hint">Se muestran las primeras {{ p.valid.length }} filas.</p> }

            <div class="row-gap" style="margin-top:16px">
              <label class="filter-check"><input type="checkbox" name="actualizar" [(ngModel)]="updateExisting" /> Actualizar los productos que ya existen (mismo código)</label>
              <button type="button" class="btn btn-ghost ml-auto" (click)="data.set(null)">Descartar</button>
              <button type="button" class="btn btn-accent" (click)="run()" [disabled]="busy()"><i class="bi bi-cloud-arrow-up"></i> {{ busy() ? 'Importando…' : 'Importar ' + p.valid_count + ' fila(s)' }}</button>
            </div>
          } @else {
            <p class="muted">No hay filas válidas para importar. Corregí el archivo y volvé a subirlo.</p>
          }
        </div>
      </div>
    }
  `,
})
export class ImportComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);
  private router = inject(Router);

  types = TYPES;
  tipo = 'motos-nuevas';
  file: File | null = null;
  updateExisting = true;

  columns = signal<Record<string, ColumnDef[]>>({});
  data = signal<Preview | null>(null);
  result = signal<{ created: number; updated: number; skipped: number; errors: string[]; type: string; section: string | null } | null>(null);
  busy = signal(false);

  ngOnInit(): void {
    this.api.get<{ columns: Record<string, ColumnDef[]> }>('importar').subscribe((res) => this.columns.set(res.columns));
  }

  currentHint(): string {
    return TYPES.find((t) => t.value === this.tipo)?.hint ?? '';
  }

  kindLabel(kind: string): string {
    return KIND_LABEL[kind] ?? kind;
  }

  template(type: string): void {
    this.api.download(`importar/plantilla/${type}`, {}, `plantilla-${type}.csv`).subscribe({ error: (e) => this.ui.apiError(e) });
  }

  preview(): void {
    if (!this.file) return;
    this.busy.set(true);
    this.result.set(null);
    this.api.upload<Preview>('importar/previsualizar', { tipo: this.tipo, archivo: this.file }).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.data.set(p);
        this.ui.info(p.message);
      },
      error: (e) => {
        this.busy.set(false);
        this.ui.apiError(e, 'No se pudo leer el archivo.');
      },
    });
  }

  run(): void {
    const p = this.data();
    if (!p) return;
    this.busy.set(true);
    this.api.post<any>('importar/ejecutar', { token: p.token, actualizar: this.updateExisting }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.data.set(null);
        this.result.set(r);
        this.file = null;
        (document.getElementById('imp-file') as HTMLInputElement).value = '';
        this.ui.success(`Importación finalizada: ${r.created} creado(s), ${r.updated} actualizado(s).`);
      },
      error: (e) => {
        this.busy.set(false);
        this.ui.apiError(e);
      },
    });
  }

  goToSection(section: string | null, type: string): void {
    this.router.navigate(['/admin', section ?? (type === 'casco' ? 'cascos' : type === 'repuesto' ? 'repuestos' : 'motos')]);
  }
}
