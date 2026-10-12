import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminTag } from '../core/admin-api.service';
import { TAG_COLORS } from '../core/labels';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-admin-tags',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="grid-side">
      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-tags-fill"></i> Etiquetas <span class="count">{{ tags().length }} registro(s)</span></h2></div>
        <div class="card-admin__body card-admin__body--flush">
          <table class="table-admin">
            <thead><tr><th>Etiqueta</th><th class="num">Productos</th><th class="actions">Acciones</th></tr></thead>
            <tbody>
              @for (t of tags(); track t.id) {
                <tr>
                  <td><span class="tag" [class]="'tag--' + t.color">{{ t.name }}</span></td>
                  <td class="num">{{ t.products_count ?? 0 }}</td>
                  <td class="actions">
                    <button type="button" class="btn-icon" (click)="edit(t)" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn-icon btn-icon--danger" (click)="remove(t)" title="Eliminar"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3"><div class="empty-state"><i class="bi bi-inbox"></i>No hay etiquetas.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-plus-circle"></i> Nueva etiqueta</h2></div>
        <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()">
          <div>
            <label class="form-label" for="t-name">Nombre *</label>
            <input class="form-control" id="t-name" name="name" [(ngModel)]="draft.name" maxlength="80" placeholder="Ej.: Más vendida" />
          </div>
          <div>
            <label class="form-label">Color</label>
            <div class="row-gap">
              @for (c of colors; track c.value) {
                <button type="button" class="color-pick" [class.is-on]="draft.color === c.value" (click)="draft.color = c.value" [attr.aria-pressed]="draft.color === c.value">
                  <span class="tag" [class]="'tag--' + c.value + (draft.color === c.value ? ' is-solid' : '')">{{ c.label }}</span>
                </button>
              }
            </div>
          </div>
          <div>
            <label class="form-label">Vista previa</label>
            <span class="tag is-solid" [class]="'tag--' + draft.color">{{ draft.name || 'Etiqueta' }}</span>
          </div>
          <button type="submit" class="btn btn-accent btn-block" [disabled]="!draft.name.trim()"><i class="bi bi-plus-lg"></i> Crear etiqueta</button>
        </form>
      </div>
    </div>

    <app-modal [open]="!!editing()" [title]="'Editar «' + (editing()?.name ?? '') + '»'" (closed)="editing.set(null)">
      <div class="stack" style="gap:14px">
        <div>
          <label class="form-label">Nombre *</label>
          <input class="form-control" name="e-name" [(ngModel)]="editForm.name" maxlength="80" />
        </div>
        <div>
          <label class="form-label">Color</label>
          <div class="row-gap">
            @for (c of colors; track c.value) {
              <button type="button" class="color-pick" (click)="editForm.color = c.value">
                <span class="tag" [class]="'tag--' + c.value + (editForm.color === c.value ? ' is-solid' : '')">{{ c.label }}</span>
              </button>
            }
          </div>
        </div>
      </div>
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="saveEdit()"><i class="bi bi-check-lg"></i> Guardar</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`.color-pick { background: none; border: 0; padding: 0; cursor: pointer; }`],
})
export class TagsComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  colors = TAG_COLORS;
  tags = signal<AdminTag[]>([]);
  editing = signal<AdminTag | null>(null);
  draft = { name: '', color: 'red' };
  editForm = { name: '', color: 'red' };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.tags().subscribe((t) => this.tags.set(t));
  }

  create(): void {
    this.api.post('etiquetas', this.draft).subscribe({
      next: () => {
        this.ui.success(`Etiqueta «${this.draft.name}» creada.`);
        this.draft = { name: '', color: this.draft.color };
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  edit(t: AdminTag): void {
    this.editForm = { name: t.name, color: t.color || 'red' };
    this.editing.set(t);
  }

  saveEdit(): void {
    const t = this.editing();
    if (!t) return;
    this.api.put(`etiquetas/${t.id}`, this.editForm).subscribe({
      next: () => {
        this.editing.set(null);
        this.ui.success('Etiqueta actualizada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(t: AdminTag): Promise<void> {
    const used = t.products_count ? ` Se va a quitar de ${t.products_count} producto(s).` : '';
    if (!(await this.ui.confirm(`¿Eliminar la etiqueta «${t.name}»?${used}`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`etiquetas/${t.id}`).subscribe({
      next: () => {
        this.ui.success('Etiqueta eliminada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }
}
