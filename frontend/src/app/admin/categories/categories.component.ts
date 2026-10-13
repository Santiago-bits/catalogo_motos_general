import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminCategory, ProductType } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';

const GROUPS: { value: ProductType; label: string }[] = [
  { value: 'moto', label: 'Motos' },
  { value: 'casco', label: 'Cascos y accesorios' },
  { value: 'repuesto', label: 'Repuestos' },
];

interface CategoryForm {
  group: ProductType;
  name: string;
  parent_id: number | null;
  sort_order: number;
  active: boolean;
}

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="grid-side">
      <div class="card-admin">
        <div class="card-admin__head">
          <h2><i class="bi bi-diagram-3-fill"></i> Categorías <span class="count">{{ visible().length }} registro(s)</span></h2>
          <div class="r-tabs-mini">
            <button type="button" [class.is-on]="group() === ''" (click)="group.set('')">Todas</button>
            @for (g of groups; track g.value) { <button type="button" [class.is-on]="group() === g.value" (click)="group.set(g.value)">{{ g.label }}</button> }
          </div>
        </div>
        <div class="card-admin__body card-admin__body--flush">
          <div class="table-wrap">
            <table class="table-admin">
              <thead><tr><th>Categoría</th><th>Sección</th><th class="num">Orden</th><th class="num">Productos</th><th>Estado</th><th class="actions">Acciones</th></tr></thead>
              <tbody>
                @for (c of visible(); track c.id) {
                  <tr>
                    <td>
                      <div class="table-product" style="min-width:180px">
                        @if (c.image_path) { <img class="table-thumb" [src]="c.image_path" alt="" /> } @else { <span class="table-thumb"><i class="bi bi-image"></i></span> }
                        <span>
                          @if (c.parent) { <span class="muted">{{ c.parent.name }} › </span> }
                          <strong>{{ c.name }}</strong>
                        </span>
                      </div>
                    </td>
                    <td><span class="chip chip--neutral">{{ groupLabel(c.group) }}</span></td>
                    <td class="num">{{ c.sort_order }}</td>
                    <td class="num">{{ c.products_count ?? 0 }}</td>
                    <td>@if (c.active) { <span class="chip chip--ok">Activa</span> } @else { <span class="chip chip--neutral">Inactiva</span> }</td>
                    <td class="actions">
                      <button type="button" class="btn-icon" (click)="edit(c)" title="Editar"><i class="bi bi-pencil"></i></button>
                      <button type="button" class="btn-icon btn-icon--danger" (click)="remove(c)" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6"><div class="empty-state"><i class="bi bi-inbox"></i>No hay categorías en esta sección.</div></td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-plus-circle"></i> Nueva categoría</h2></div>
        <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()">
          <div>
            <label class="form-label" for="c-group">Sección *</label>
            <select class="form-select" id="c-group" name="group" [(ngModel)]="draft.group" (ngModelChange)="draft.parent_id = null">
              @for (g of groups; track g.value) { <option [value]="g.value">{{ g.label }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label" for="c-name">Nombre *</label>
            <input class="form-control" id="c-name" name="name" [(ngModel)]="draft.name" maxlength="120" />
          </div>
          <div>
            <label class="form-label" for="c-parent">Categoría madre</label>
            <select class="form-select" id="c-parent" name="parent" [(ngModel)]="draft.parent_id">
              <option [ngValue]="null">Ninguna (principal)</option>
              @for (p of parentsFor(draft.group); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label" for="c-order">Orden</label>
            <input class="form-control" type="number" min="0" id="c-order" name="order" [(ngModel)]="draft.sort_order" />
            <p class="form-hint">Las de número más bajo aparecen primero en el sitio.</p>
          </div>
          <div>
            <label class="form-label" for="c-img">Imagen (opcional)</label>
            <label class="img-pick">
              @if (draftPreview()) { <img [src]="draftPreview()" alt="" /> } @else { <span class="img-pick__empty"><i class="bi bi-image"></i></span> }
              <span class="img-pick__text">
                <strong>{{ draftImage ? draftImage.name : 'Elegir imagen' }}</strong>
                <small>JPG, PNG o WEBP · hasta 6 MB. Se ve en “Elegí tu estilo” del inicio.</small>
              </span>
              <input type="file" id="c-img" accept="image/png,image/jpeg,image/webp" hidden (change)="pickDraftImage($event)" />
            </label>
            @if (draftImage) { <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" (click)="clearDraftImage()">Quitar</button> }
          </div>
          <label class="filter-check"><input type="checkbox" name="active" [(ngModel)]="draft.active" /> Activa</label>
          <button type="submit" class="btn btn-accent btn-block" [disabled]="!draft.name.trim()"><i class="bi bi-plus-lg"></i> Crear categoría</button>
        </form>
      </div>
    </div>

    <app-modal [open]="!!editing()" [title]="'Editar «' + (editing()?.name ?? '') + '»'" (closed)="editing.set(null)">
      <div class="form-grid">
        <div>
          <label class="form-label">Sección</label>
          <select class="form-select" name="e-group" [(ngModel)]="editForm.group" (ngModelChange)="editForm.parent_id = null">
            @for (g of groups; track g.value) { <option [value]="g.value">{{ g.label }}</option> }
          </select>
        </div>
        <div>
          <label class="form-label">Nombre *</label>
          <input class="form-control" name="e-name" [(ngModel)]="editForm.name" maxlength="120" />
        </div>
        <div>
          <label class="form-label">Categoría madre</label>
          <select class="form-select" name="e-parent" [(ngModel)]="editForm.parent_id">
            <option [ngValue]="null">Ninguna (principal)</option>
            @for (p of parentsFor(editForm.group, editing()?.id); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
        </div>
        <div>
          <label class="form-label">Orden</label>
          <input class="form-control" type="number" min="0" name="e-order" [(ngModel)]="editForm.sort_order" />
        </div>
        <div class="span-all">
          <label class="form-label">Imagen</label>
          <div class="row-gap">
            @if (editPreview() || editing()?.image_path) { <img [src]="editPreview() || editing()?.image_path" alt="" style="width:96px;height:64px;object-fit:cover;border:1px solid var(--a-line)" /> }
            <input class="form-control" type="file" accept="image/png,image/jpeg,image/webp" style="flex:1" (change)="pickEditImage($event)" />
            @if (editing()?.image_path && !editImage) { <button type="button" class="btn btn-danger btn-sm" (click)="removeImage()">Quitar imagen</button> }
          </div>
        </div>
        <label class="filter-check span-all"><input type="checkbox" name="e-active" [(ngModel)]="editForm.active" /> Activa</label>
      </div>
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="saveEdit()"><i class="bi bi-check-lg"></i> Guardar</button>
      </ng-container>
    </app-modal>

    <!-- Eliminar una categoría con productos -->
    <app-modal [open]="!!deleting()" title="Eliminar categoría" (closed)="deleting.set(null)">
      @if (deleting(); as c) {
        <div class="del-warn">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <div>
            <p class="del-title">Estás por eliminar la categoría <strong>«{{ c.name }}»</strong>, que tiene <strong>{{ c.products_count }} {{ c.group === 'moto' ? 'moto(s)' : 'producto(s)' }}</strong> asignados.</p>
            <p class="muted" style="margin:6px 0 0">¿Estás seguro? Los productos no se borran: elegí a dónde pasan.</p>
          </div>
        </div>
        <label class="form-label" for="del-move">Pasar los productos a</label>
        <select class="form-select" id="del-move" name="del-move" [(ngModel)]="moveTo">
          <option [ngValue]="null">Dejarlos sin categoría</option>
          @for (t of moveTargets(c); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
        </select>
        @if (moveTo === null) {
          <p class="form-hint">Van a aparecer en el inicio, en “Para revisar”, como productos sin categoría.</p>
        }
      }
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="deleting.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="confirmDelete()" [disabled]="deletingBusy()"><i class="bi bi-trash"></i> {{ deletingBusy() ? 'Eliminando…' : 'Sí, eliminar' }}</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    .del-warn { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; margin-bottom: 18px; background: #FDE6E8; border-left: 4px solid #E2001A; }
    .del-warn > .bi { color: #E2001A; font-size: 26px; line-height: 1; }
    .del-title { margin: 0; font-size: 16px; line-height: 1.45; }
    .r-tabs-mini { display: flex; flex-wrap: wrap; border: 1px solid var(--a-line); }
    .r-tabs-mini button { border: 0; background: #FFF; padding: 6px 12px; font-family: var(--r-display); font-weight: 700; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; color: var(--a-muted); }
    .r-tabs-mini button.is-on { background: var(--a-text); color: #FFF; }
    .img-pick { display: flex; align-items: center; gap: 12px; padding: 10px; border: 2px dashed #CACACE; background: #FAFAF8; cursor: pointer; }
    .img-pick:hover { border-color: var(--a-red); background: #FFF; }
    .img-pick img, .img-pick__empty { width: 72px; height: 54px; object-fit: cover; flex-shrink: 0; }
    .img-pick__empty { display: grid; place-items: center; background: #EEEEEE; color: #B4B4B4; font-size: 22px; }
    .img-pick__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .img-pick__text strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .img-pick__text small { font-size: 12px; color: var(--a-muted); }
  `],
})
export class CategoriesComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  groups = GROUPS;
  categories = signal<AdminCategory[]>([]);
  group = signal<ProductType | ''>('');
  editing = signal<AdminCategory | null>(null);
  visible = computed(() => (this.group() ? this.categories().filter((c) => c.group === this.group()) : this.categories()));

  draft: CategoryForm = this.empty();
  editForm: CategoryForm = this.empty();
  deleting = signal<AdminCategory | null>(null);
  deletingBusy = signal(false);
  moveTo: number | null = null;
  draftImage: File | null = null;
  editImage: File | null = null;
  draftPreview = signal<string | null>(null);
  editPreview = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.categories().subscribe((c) => this.categories.set(c));
  }

  groupLabel(g: string): string {
    return GROUPS.find((x) => x.value === g)?.label ?? g;
  }

  parentsFor(group: ProductType, excludeId?: number): AdminCategory[] {
    return this.categories().filter((c) => c.group === group && !c.parent_id && c.id !== excludeId);
  }

  pickDraftImage(event: Event): void {
    this.draftImage = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.draftPreview.set(this.preview(this.draftImage));
  }

  clearDraftImage(): void {
    this.draftImage = null;
    this.draftPreview.set(null);
    (document.getElementById('c-img') as HTMLInputElement).value = '';
  }

  pickEditImage(event: Event): void {
    this.editImage = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.editPreview.set(this.preview(this.editImage));
  }

  create(): void {
    this.api.post<AdminCategory>('categorias', this.draft).subscribe({
      next: (category) => {
        const finish = () => {
          this.ui.success(`Categoría «${category.name}» creada.`);
          this.draft = { ...this.empty(), group: this.draft.group };
          this.clearDraftImage();
          this.load();
        };
        // La imagen se sube después de crear la categoría (necesita su id).
        if (this.draftImage) {
          this.api.upload(`categorias/${category.id}/imagen`, { image: this.draftImage }).subscribe({
            next: finish,
            error: (e) => { finish(); this.ui.apiError(e, 'La categoría se creó, pero la imagen no se pudo subir.'); },
          });
        } else {
          finish();
        }
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  edit(c: AdminCategory): void {
    this.editForm = { group: c.group, name: c.name, parent_id: c.parent_id, sort_order: c.sort_order, active: c.active };
    this.editImage = null;
    this.editPreview.set(null);
    this.editing.set(c);
  }

  saveEdit(): void {
    const c = this.editing();
    if (!c) return;
    this.api.put(`categorias/${c.id}`, this.editForm).subscribe({
      next: () => {
        const finish = () => {
          this.editing.set(null);
          this.ui.success('Categoría actualizada.');
          this.load();
        };
        if (this.editImage) {
          this.api.upload(`categorias/${c.id}/imagen`, { image: this.editImage }).subscribe({
            next: finish,
            error: (e) => { finish(); this.ui.apiError(e, 'No se pudo subir la imagen.'); },
          });
        } else {
          finish();
        }
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  removeImage(): void {
    const c = this.editing();
    if (!c) return;
    this.api.upload<AdminCategory>(`categorias/${c.id}/imagen`, { remove: true }).subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.ui.success('Imagen quitada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private preview(file: File | null): string | null {
    return file ? URL.createObjectURL(file) : null;
  }

  async remove(c: AdminCategory): Promise<void> {
    // Con productos: ventana propia para avisar cuántos son y elegir a dónde pasan.
    if ((c.products_count ?? 0) > 0) {
      this.moveTo = null;
      this.deleting.set(c);
      return;
    }
    if (!(await this.ui.confirm(`¿Eliminar la categoría «${c.name}»?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.doDelete(c, null);
  }

  /** Categorías a las que se pueden pasar los productos (misma sección, distinta a la que se borra). */
  moveTargets(c: AdminCategory): AdminCategory[] {
    return this.categories().filter((x) => x.group === c.group && x.id !== c.id);
  }

  confirmDelete(): void {
    const c = this.deleting();
    if (c) this.doDelete(c, this.moveTo);
  }

  private doDelete(c: AdminCategory, moveTo: number | null): void {
    const query = (c.products_count ?? 0) > 0 ? `?force=1${moveTo ? '&move_to=' + moveTo : ''}` : '';
    this.deletingBusy.set(true);
    this.api.delete<{ moved: number; target: string | null }>(`categorias/${c.id}${query}`).subscribe({
      next: (res) => {
        this.deletingBusy.set(false);
        this.deleting.set(null);
        const extra = res.moved ? (res.target ? ` ${res.moved} producto(s) pasaron a «${res.target}».` : ` ${res.moved} producto(s) quedaron sin categoría.`) : '';
        this.ui.success(`Categoría «${c.name}» eliminada.${extra}`);
        this.load();
      },
      error: (e) => {
        this.deletingBusy.set(false);
        this.ui.apiError(e);
      },
    });
  }

  private empty(): CategoryForm {
    return { group: 'moto', name: '', parent_id: null, sort_order: 0, active: true };
  }
}
