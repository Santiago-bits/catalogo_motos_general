import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminBrand, ProductType } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';
import { ModalComponent } from '../shared/modal.component';

/** Secciones de una marca: las mismas que las categorías. */
const GROUPS: { value: ProductType; label: string }[] = [
  { value: 'moto', label: 'Motos' },
  { value: 'casco', label: 'Cascos y accesorios' },
  { value: 'repuesto', label: 'Repuestos' },
];

@Component({
  selector: 'app-admin-brands',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="grid-side">
      <div class="card-admin">
        <div class="card-admin__head">
          <h2><i class="bi bi-award-fill"></i> Marcas <span class="count">{{ filtered().length }} registro(s)</span></h2>
          <div class="r-tabs-mini">
            <button type="button" [class.is-on]="group() === ''" (click)="group.set('')">Todas</button>
            @for (g of groups; track g.value) { <button type="button" [class.is-on]="group() === g.value" (click)="group.set(g.value)">{{ g.label }}</button> }
          </div>
          <input type="search" class="form-control" style="max-width:240px;min-height:36px" placeholder="Buscar marca" [(ngModel)]="search" />
        </div>
        <div class="card-admin__body card-admin__body--flush">
          <div class="table-wrap">
            <table class="table-admin">
              <thead><tr><th>Marca</th><th>Secciones</th><th class="num">Productos</th><th>Estado</th><th class="actions">Acciones</th></tr></thead>
              <tbody>
                @for (b of filtered(); track b.id) {
                  <tr>
                    <td>
                      <div class="table-product">
                        @if (b.logo_path) { <img class="table-thumb logo" [src]="b.logo_path" alt="" /> } @else { <span class="table-thumb"><i class="bi bi-award"></i></span> }
                        <span class="table-product__name">{{ b.name }}</span>
                      </div>
                    </td>
                    <td>@for (g of b.groups ?? []; track g) { <span class="chip chip--neutral">{{ groupLabel(g) }}</span> }</td>
                    <td class="num">{{ b.products_count ?? 0 }}</td>
                    <td>@if (b.active) { <span class="chip chip--ok">Activa</span> } @else { <span class="chip chip--neutral">Inactiva</span> }</td>
                    <td class="actions">
                      <button type="button" class="btn-icon" (click)="edit(b)" title="Editar"><i class="bi bi-pencil"></i></button>
                      <button type="button" class="btn-icon btn-icon--danger" (click)="remove(b)" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5"><div class="empty-state"><i class="bi bi-inbox"></i>No hay marcas.</div></td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-plus-circle"></i> Nueva marca</h2></div>
        <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()">
          <div>
            <label class="form-label" for="b-name">Nombre *</label>
            <input class="form-control" id="b-name" name="name" [(ngModel)]="draft.name" maxlength="120" required />
          </div>
          <fieldset class="groups">
            <legend class="form-label">Secciones *</legend>
            @for (g of groups; track g.value) {
              <label class="filter-check"><input type="checkbox" [name]="'b-g-' + g.value" [checked]="draft.groups.includes(g.value)" (change)="toggle(draft.groups, g.value)" /> {{ g.label }}</label>
            }
            <p class="form-hint">En qué listados y formularios aparece. Una marca puede estar en varias (Honda: motos y repuestos).</p>
          </fieldset>
          <div>
            <label class="form-label" for="b-logo">Logo (opcional)</label>
            <input class="form-control" type="file" id="b-logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="draftLogo = $any($event.target).files?.[0] ?? null" />
            <p class="form-hint">Se muestra en “Marcas que trabajamos” del inicio.</p>
          </div>
          <label class="filter-check"><input type="checkbox" name="active" [(ngModel)]="draft.active" /> Activa</label>
          <button type="submit" class="btn btn-accent btn-block" [disabled]="!draft.name.trim() || !draft.groups.length || busy()"><i class="bi bi-plus-lg"></i> Crear marca</button>
        </form>
      </div>
    </div>

    <app-modal [open]="!!editing()" [title]="'Editar «' + (editing()?.name ?? '') + '»'" (closed)="editing.set(null)">
      @if (editing(); as e) {
        <div class="stack" style="gap:14px">
          <div>
            <label class="form-label" for="e-name">Nombre *</label>
            <input class="form-control" id="e-name" name="e-name" [(ngModel)]="editForm.name" maxlength="120" />
          </div>
          <fieldset class="groups">
            <legend class="form-label">Secciones *</legend>
            @for (g of groups; track g.value) {
              <label class="filter-check"><input type="checkbox" [name]="'e-g-' + g.value" [checked]="editForm.groups.includes(g.value)" (change)="toggle(editForm.groups, g.value)" /> {{ g.label }}</label>
            }
          </fieldset>
          <div>
            <label class="form-label">Logo</label>
            <div class="row-gap">
              @if (e.logo_path) { <img [src]="e.logo_path" alt="" style="height:48px;max-width:140px;object-fit:contain;border:1px solid var(--a-line);padding:4px" /> }
              <input class="form-control" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="flex:1" (change)="editLogo = $any($event.target).files?.[0] ?? null" />
              @if (e.logo_path) { <button type="button" class="btn btn-danger btn-sm" (click)="removeLogo(e)">Quitar logo</button> }
            </div>
          </div>
          <label class="filter-check"><input type="checkbox" name="e-active" [(ngModel)]="editForm.active" /> Activa</label>
        </div>
      }
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="saveEdit()" [disabled]="!editForm.groups.length || busy()"><i class="bi bi-check-lg"></i> Guardar</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    .logo { object-fit: contain; background: #FFF; border: 1px solid var(--a-line); padding: 3px; }
    .chip + .chip { margin-left: 4px; }
    .groups { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .r-tabs-mini { display: flex; flex-wrap: wrap; border: 1px solid var(--a-line); }
    .r-tabs-mini button { border: 0; background: #FFF; padding: 6px 12px; font-family: var(--r-display); font-weight: 700; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; color: var(--a-muted); }
    .r-tabs-mini button.is-on { background: var(--a-text); color: #FFF; }
  `],
})
export class BrandsComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  brands = signal<AdminBrand[]>([]);
  editing = signal<AdminBrand | null>(null);
  busy = signal(false);
  search = '';
  groups = GROUPS;
  group = signal<ProductType | ''>('');

  draft: { name: string; groups: ProductType[]; active: boolean } = { name: '', groups: ['moto'], active: true };
  draftLogo: File | null = null;
  editForm: { name: string; groups: ProductType[]; active: boolean } = { name: '', groups: [], active: true };
  editLogo: File | null = null;

  ngOnInit(): void {
    this.load();
  }

  filtered(): AdminBrand[] {
    const q = this.search.trim().toLowerCase();
    const g = this.group();
    return this.brands().filter((b) => (!g || b.groups?.includes(g)) && (!q || b.name.toLowerCase().includes(q)));
  }

  groupLabel(g: string): string {
    return GROUPS.find((x) => x.value === g)?.label ?? g;
  }

  toggle(list: ProductType[], g: ProductType): void {
    const i = list.indexOf(g);
    if (i >= 0) list.splice(i, 1);
    else list.push(g);
  }

  load(): void {
    this.api.brands().subscribe((b) => this.brands.set(b));
  }

  create(): void {
    this.busy.set(true);
    this.api.post<AdminBrand>('marcas', this.draft).subscribe({
      next: (brand) => {
        const finish = () => {
          this.busy.set(false);
          this.draft = { name: '', groups: [...this.draft.groups], active: true };
          this.draftLogo = null;
          (document.getElementById('b-logo') as HTMLInputElement).value = '';
          this.ui.success(`Marca «${brand.name}» creada.`);
          this.load();
        };
        if (this.draftLogo) this.api.upload(`marcas/${brand.id}/logo`, { logo: this.draftLogo }).subscribe({ next: finish, error: (e) => { finish(); this.ui.apiError(e, 'La marca se creó pero el logo no se pudo subir.'); } });
        else finish();
      },
      error: (e) => {
        this.busy.set(false);
        this.ui.apiError(e);
      },
    });
  }

  edit(b: AdminBrand): void {
    this.editForm = { name: b.name, groups: [...(b.groups ?? [])], active: b.active };
    this.editLogo = null;
    this.editing.set(b);
  }

  saveEdit(): void {
    const b = this.editing();
    if (!b) return;
    this.busy.set(true);
    this.api.put<AdminBrand>(`marcas/${b.id}`, this.editForm).subscribe({
      next: () => {
        const finish = () => {
          this.busy.set(false);
          this.editing.set(null);
          this.ui.success('Marca actualizada.');
          this.load();
        };
        if (this.editLogo) this.api.upload(`marcas/${b.id}/logo`, { logo: this.editLogo }).subscribe({ next: finish, error: (e) => { finish(); this.ui.apiError(e, 'No se pudo subir el logo.'); } });
        else finish();
      },
      error: (e) => {
        this.busy.set(false);
        this.ui.apiError(e);
      },
    });
  }

  removeLogo(b: AdminBrand): void {
    this.api.upload<AdminBrand>(`marcas/${b.id}/logo`, { remove: true }).subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(b: AdminBrand): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar la marca «${b.name}»?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`marcas/${b.id}`).subscribe({
      next: () => {
        this.ui.success('Marca eliminada.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }
}
