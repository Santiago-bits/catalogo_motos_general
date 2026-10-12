import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminService } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';

interface ServiceForm {
  title: string;
  icon: string;
  summary: string;
  description: string;
  sort_order: number;
  active: boolean;
}

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="grid-side">
      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-tools"></i> Servicios <span class="count">{{ services().length }} registro(s)</span></h2></div>
        <div class="card-admin__body card-admin__body--flush">
          <div class="table-wrap">
            <table class="table-admin">
              <thead><tr><th>Servicio</th><th class="num">Orden</th><th>Estado</th><th class="actions">Acciones</th></tr></thead>
              <tbody>
                @for (s of services(); track s.id) {
                  <tr>
                    <td>
                      <div class="table-product">
                        @if (s.image_path) { <img class="table-thumb" [src]="s.image_path" alt="" /> } @else { <span class="table-thumb"><i class="bi bi-tools"></i></span> }
                        <span>
                          <span class="table-product__name">{{ s.title }}</span>
                          <span class="table-product__meta small">{{ s.summary }}</span>
                        </span>
                      </div>
                    </td>
                    <td class="num">{{ s.sort_order }}</td>
                    <td>@if (s.active) { <span class="chip chip--ok">Visible</span> } @else { <span class="chip chip--neutral">Oculto</span> }</td>
                    <td class="actions">
                      <a class="btn-icon" [href]="'/servicios/' + s.slug" target="_blank" rel="noopener" title="Ver en el sitio"><i class="bi bi-box-arrow-up-right"></i></a>
                      <button type="button" class="btn-icon" (click)="edit(s)" title="Editar"><i class="bi bi-pencil"></i></button>
                      <button type="button" class="btn-icon btn-icon--danger" (click)="remove(s)" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4"><div class="empty-state"><i class="bi bi-inbox"></i>No hay servicios cargados.</div></td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-plus-circle"></i> Nuevo servicio</h2></div>
        <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()">
          <div>
            <label class="form-label" for="s-title">Título *</label>
            <input class="form-control" id="s-title" name="title" [(ngModel)]="draft.title" maxlength="160" />
          </div>
          <div>
            <label class="form-label" for="s-summary">Resumen</label>
            <input class="form-control" id="s-summary" name="summary" [(ngModel)]="draft.summary" maxlength="255" />
          </div>
          <div>
            <label class="form-label" for="s-desc">Descripción</label>
            <textarea class="form-control" id="s-desc" name="description" rows="4" [(ngModel)]="draft.description"></textarea>
          </div>
          <div>
            <label class="form-label" for="s-img">Imagen</label>
            <input class="form-control" type="file" id="s-img" accept="image/png,image/jpeg,image/webp" (change)="draftImage = $any($event.target).files?.[0] ?? null" />
          </div>
          <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div>
              <label class="form-label" for="s-order">Orden</label>
              <input class="form-control" type="number" min="0" id="s-order" name="order" [(ngModel)]="draft.sort_order" />
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:10px"><label class="filter-check"><input type="checkbox" name="active" [(ngModel)]="draft.active" /> Visible</label></div>
          </div>
          <button type="submit" class="btn btn-accent btn-block" [disabled]="!draft.title.trim()"><i class="bi bi-plus-lg"></i> Crear servicio</button>
        </form>
      </div>
    </div>

    <app-modal size="lg" [open]="!!editing()" [title]="'Editar «' + (editing()?.title ?? '') + '»'" (closed)="editing.set(null)">
      @if (editing(); as e) {
        <div class="form-grid">
          <div class="span-2">
            <label class="form-label">Título *</label>
            <input class="form-control" name="e-title" [(ngModel)]="editForm.title" maxlength="160" />
          </div>
          <div>
            <label class="form-label">Orden</label>
            <input class="form-control" type="number" min="0" name="e-order" [(ngModel)]="editForm.sort_order" />
          </div>
          <div class="span-all">
            <label class="form-label">Resumen</label>
            <input class="form-control" name="e-summary" [(ngModel)]="editForm.summary" maxlength="255" />
          </div>
          <div class="span-all">
            <label class="form-label">Descripción</label>
            <textarea class="form-control" name="e-desc" rows="6" [(ngModel)]="editForm.description"></textarea>
          </div>
          <div class="span-all">
            <label class="form-label">Imagen</label>
            <div class="row-gap">
              @if (e.image_path) { <img [src]="e.image_path" alt="" style="height:64px;width:96px;object-fit:cover" /> }
              <input class="form-control" type="file" accept="image/png,image/jpeg,image/webp" style="flex:1" (change)="editImage = $any($event.target).files?.[0] ?? null" />
              @if (e.image_path) { <button type="button" class="btn btn-danger btn-sm" (click)="removeImage(e)">Quitar imagen</button> }
            </div>
          </div>
          <label class="filter-check span-all"><input type="checkbox" name="e-active" [(ngModel)]="editForm.active" /> Visible en el sitio</label>
        </div>
      }
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="saveEdit()"><i class="bi bi-check-lg"></i> Guardar</button>
      </ng-container>
    </app-modal>
  `,
})
export class ServicesAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  services = signal<AdminService[]>([]);
  editing = signal<AdminService | null>(null);
  draft: ServiceForm = this.empty();
  draftImage: File | null = null;
  editForm: ServiceForm = this.empty();
  editImage: File | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<AdminService[]>('servicios').subscribe((s) => this.services.set(s));
  }

  create(): void {
    this.api.post<AdminService>('servicios', this.draft).subscribe({
      next: (service) => {
        const finish = () => {
          this.ui.success(`Servicio «${service.title}» creado.`);
          this.draft = this.empty();
          this.draftImage = null;
          (document.getElementById('s-img') as HTMLInputElement).value = '';
          this.load();
        };
        if (this.draftImage) this.api.upload(`servicios/${service.id}/imagen`, { image: this.draftImage }).subscribe({ next: finish, error: (e) => { finish(); this.ui.apiError(e, 'No se pudo subir la imagen.'); } });
        else finish();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  edit(s: AdminService): void {
    this.editForm = { title: s.title, icon: s.icon ?? '', summary: s.summary ?? '', description: s.description ?? '', sort_order: s.sort_order, active: s.active };
    this.editImage = null;
    this.editing.set(s);
  }

  saveEdit(): void {
    const s = this.editing();
    if (!s) return;
    this.api.put(`servicios/${s.id}`, this.editForm).subscribe({
      next: () => {
        const finish = () => {
          this.editing.set(null);
          this.ui.success('Servicio actualizado.');
          this.load();
        };
        if (this.editImage) this.api.upload(`servicios/${s.id}/imagen`, { image: this.editImage }).subscribe({ next: finish, error: (e) => { finish(); this.ui.apiError(e, 'No se pudo subir la imagen.'); } });
        else finish();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  removeImage(s: AdminService): void {
    this.api.upload<AdminService>(`servicios/${s.id}/imagen`, { remove: true }).subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(s: AdminService): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar el servicio «${s.title}»?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`servicios/${s.id}`).subscribe({
      next: () => {
        this.ui.success('Servicio eliminado.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private empty(): ServiceForm {
    return { title: '', icon: '', summary: '', description: '', sort_order: 0, active: true };
  }
}
