import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService, AdminRole, PermissionGroup } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="grid-side">
      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-key-fill"></i> Roles <span class="count">{{ roles().length }} registro(s)</span></h2></div>
        <div class="card-admin__body card-admin__body--flush">
          <table class="table-admin">
            <thead><tr><th>Rol</th><th>Descripción</th><th class="num">Permisos</th><th class="num">Usuarios</th><th>Tipo</th><th class="actions">Acciones</th></tr></thead>
            <tbody>
              @for (r of roles(); track r.id) {
                <tr>
                  <td><a [routerLink]="['/admin/roles', r.id]"><strong>{{ r.name }}</strong></a> @if (!r.active) { <span class="chip chip--neutral">Inactivo</span> }</td>
                  <td class="muted small">{{ r.description }}</td>
                  <td class="num">{{ r.is_system ? 'Todos' : r.permission_ids.length }}</td>
                  <td class="num">{{ r.users_count }}</td>
                  <td>@if (r.is_system) { <span class="chip chip--dark">Sistema</span> } @else { <span class="chip chip--neutral">Personalizado</span> }</td>
                  <td class="actions">
                    <a class="btn-icon" [routerLink]="['/admin/roles', r.id]" title="Editar permisos"><i class="bi bi-pencil"></i></a>
                    @if (!r.is_system) { <button type="button" class="btn-icon btn-icon--danger" (click)="remove(r)" title="Eliminar"><i class="bi bi-trash"></i></button> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-admin">
        <div class="card-admin__head"><h2><i class="bi bi-plus-circle"></i> Nuevo rol</h2></div>
        <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()">
          <div><label class="form-label" for="r-name">Nombre *</label><input class="form-control" id="r-name" name="name" [(ngModel)]="draft.name" maxlength="60" placeholder="Ej.: Vendedor de salón" /></div>
          <div><label class="form-label" for="r-desc">Descripción</label><input class="form-control" id="r-desc" name="description" [(ngModel)]="draft.description" maxlength="255" /></div>
          <div>
            <label class="form-label">Permisos</label>
            <div class="perm-box">
              @for (g of groups(); track g.module) {
                <p class="perm-module">{{ g.module }}</p>
                @for (p of g.permissions; track p.id) {
                  <label class="filter-check"><input type="checkbox" [checked]="draft.permissions.includes(p.id)" (change)="toggle(p.id)" /> {{ p.label }}</label>
                }
              }
            </div>
          </div>
          <button type="submit" class="btn btn-accent btn-block" [disabled]="!draft.name.trim()"><i class="bi bi-plus-lg"></i> Crear rol</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .perm-box { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; border: 1px solid var(--a-line); padding: 10px 12px; }
    .perm-module { margin: 8px 0 2px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--a-muted); }
    .perm-module:first-child { margin-top: 0; }
  `],
})
export class RolesComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  roles = signal<AdminRole[]>([]);
  groups = signal<PermissionGroup[]>([]);
  draft: { name: string; description: string; permissions: number[] } = { name: '', description: '', permissions: [] };

  ngOnInit(): void {
    this.load();
    this.api.get<PermissionGroup[]>('roles/permisos').subscribe((g) => this.groups.set(g));
  }

  load(): void {
    this.api.get<AdminRole[]>('roles').subscribe((r) => this.roles.set(r));
  }

  toggle(id: number): void {
    const list = this.draft.permissions;
    this.draft.permissions = list.includes(id) ? list.filter((p) => p !== id) : [...list, id];
  }

  create(): void {
    this.api.post('roles', { ...this.draft, active: true }).subscribe({
      next: () => {
        this.ui.success(`Rol «${this.draft.name}» creado.`);
        this.draft = { name: '', description: '', permissions: [] };
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(r: AdminRole): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar el rol «${r.name}»?`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`roles/${r.id}`).subscribe({
      next: () => {
        this.ui.success('Rol eliminado.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }
}
