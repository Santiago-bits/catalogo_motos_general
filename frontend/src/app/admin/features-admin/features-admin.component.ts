import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminFeature } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';

interface FeatureForm {
  name: string;
  unit: string;
  value_type: 'text' | 'number';
  sort_order: number;
}

@Component({
  selector: 'app-admin-features',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="grid-side">
      <div class="card-admin">
        <div class="card-admin__head">
          <h2><i class="bi bi-list-check"></i> Características <span class="count">{{ features().length }} registro(s)</span></h2>
        </div>
        <div class="card-admin__body card-admin__body--flush">
          <table class="table-admin">
            <thead><tr><th>Característica</th><th>Tipo de dato</th><th>Unidad</th><th class="num">Orden</th><th class="actions">Acciones</th></tr></thead>
            <tbody>
              @for (f of features(); track f.id) {
                <tr>
                  <td><strong>{{ f.name }}</strong></td>
                  <td><span class="chip chip--neutral">{{ f.value_type === 'number' ? 'Número' : 'Texto' }}</span></td>
                  <td>{{ f.unit || '—' }}</td>
                  <td class="num">{{ f.sort_order }}</td>
                  <td class="actions">
                    <button type="button" class="btn-icon" (click)="edit(f)" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn-icon btn-icon--danger" (click)="remove(f)" title="Eliminar"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="empty-state"><i class="bi bi-inbox"></i>No hay características adicionales.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="stack">
        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-plus-circle"></i> Nueva característica</h2></div>
          <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()">
            <div>
              <label class="form-label" for="f-name">Nombre *</label>
              <input class="form-control" id="f-name" name="name" [(ngModel)]="draft.name" maxlength="100" placeholder="Ej.: Frenos ABS" />
            </div>
            <div class="form-grid" style="grid-template-columns:1fr 1fr">
              <div>
                <label class="form-label" for="f-type">Tipo</label>
                <select class="form-select" id="f-type" name="type" [(ngModel)]="draft.value_type">
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                </select>
              </div>
              <div>
                <label class="form-label" for="f-unit">Unidad</label>
                <input class="form-control" id="f-unit" name="unit" [(ngModel)]="draft.unit" maxlength="20" placeholder="Ej.: L, kg" />
              </div>
            </div>
            <div>
              <label class="form-label" for="f-order">Orden</label>
              <input class="form-control" type="number" min="0" id="f-order" name="order" [(ngModel)]="draft.sort_order" />
            </div>
            <button type="submit" class="btn btn-accent btn-block" [disabled]="!draft.name.trim()"><i class="bi bi-plus-lg"></i> Crear característica</button>
          </form>
        </div>
        <div class="alert alert--info"><span>Son datos extra que no están en la ficha fija (por ejemplo “Frenos ABS”). Se completan en la pestaña <strong>Ficha técnica</strong> de cada producto.</span></div>
      </div>
    </div>

    <app-modal [open]="!!editing()" [title]="'Editar «' + (editing()?.name ?? '') + '»'" (closed)="editing.set(null)">
      <div class="form-grid">
        <div class="span-all">
          <label class="form-label">Nombre *</label>
          <input class="form-control" name="e-name" [(ngModel)]="editForm.name" maxlength="100" />
        </div>
        <div>
          <label class="form-label">Tipo</label>
          <select class="form-select" name="e-type" [(ngModel)]="editForm.value_type">
            <option value="text">Texto</option>
            <option value="number">Número</option>
          </select>
        </div>
        <div>
          <label class="form-label">Unidad</label>
          <input class="form-control" name="e-unit" [(ngModel)]="editForm.unit" maxlength="20" />
        </div>
        <div>
          <label class="form-label">Orden</label>
          <input class="form-control" type="number" min="0" name="e-order" [(ngModel)]="editForm.sort_order" />
        </div>
      </div>
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="saveEdit()"><i class="bi bi-check-lg"></i> Guardar</button>
      </ng-container>
    </app-modal>
  `,
})
export class FeaturesAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  features = signal<AdminFeature[]>([]);
  editing = signal<AdminFeature | null>(null);
  draft: FeatureForm = this.empty();
  editForm: FeatureForm = this.empty();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.features().subscribe((f) => this.features.set(f));
  }

  create(): void {
    this.api.post('caracteristicas', this.draft).subscribe({
      next: () => {
        this.ui.success(`Característica «${this.draft.name}» creada.`);
        this.draft = this.empty();
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  edit(f: AdminFeature): void {
    this.editForm = { name: f.name, unit: f.unit ?? '', value_type: f.value_type, sort_order: f.sort_order };
    this.editing.set(f);
  }

  saveEdit(): void {
    const f = this.editing();
    if (!f) return;
    this.api.put(`caracteristicas/${f.id}`, this.editForm).subscribe({
      next: () => {
        this.editing.set(null);
        this.ui.success('Característica actualizada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(f: AdminFeature): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar «${f.name}»? Se borra el valor cargado en todos los productos.`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`caracteristicas/${f.id}`).subscribe({
      next: () => {
        this.ui.success('Característica eliminada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private empty(): FeatureForm {
    return { name: '', unit: '', value_type: 'text', sort_order: 0 };
  }
}
