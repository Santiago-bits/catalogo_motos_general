import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, AdminRole, PermissionGroup } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'app-admin-role-edit',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (role(); as r) {
      <form (ngSubmit)="save()">
        <div class="card-admin">
          <div class="card-admin__head">
            <h2><i class="bi bi-key-fill"></i> {{ r.name }} <span class="count">{{ r.users_count }} usuario(s)</span></h2>
            <a routerLink="/admin/roles" class="btn btn-ghost btn-sm"><i class="bi bi-arrow-left"></i> Volver</a>
          </div>
          <div class="card-admin__body">
            <div class="form-grid">
              <div><label class="form-label" for="r-name">Nombre *</label><input class="form-control" id="r-name" name="name" [(ngModel)]="form.name" maxlength="60" /></div>
              <div class="span-2"><label class="form-label" for="r-desc">Descripción</label><input class="form-control" id="r-desc" name="description" [(ngModel)]="form.description" maxlength="255" /></div>
              @if (!r.is_system) {
                <label class="filter-check span-all"><input type="checkbox" name="active" [(ngModel)]="form.active" /> Rol activo (si se desactiva, sus usuarios no pueden entrar al panel)</label>
              }
            </div>
          </div>
        </div>

        <div class="card-admin">
          <div class="card-admin__head">
            <h2><i class="bi bi-list-check"></i> Permisos</h2>
            @if (!r.is_system) {
              <div class="row-gap">
                <button type="button" class="btn btn-ghost btn-sm" (click)="all(true)">Marcar todos</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="all(false)">Desmarcar todos</button>
              </div>
            }
          </div>
          <div class="card-admin__body">
            @if (r.is_system) {
              <div class="alert alert--info"><span><i class="bi bi-shield-lock"></i> El rol de administrador tiene siempre todos los permisos y no se puede recortar.</span></div>
            }
            <div class="modules">
              @for (g of groups(); track g.module) {
                <div class="module">
                  <div class="module__head">
                    <h3>{{ g.module }}</h3>
                    @if (!r.is_system) { <button type="button" class="btn btn-ghost btn-sm" (click)="toggleModule(g)">{{ moduleFull(g) ? 'Ninguno' : 'Todos' }}</button> }
                  </div>
                  @for (p of g.permissions; track p.id) {
                    <label class="filter-check perm">
                      <input type="checkbox" [checked]="selected.has(p.id)" [disabled]="r.is_system" (change)="toggle(p.id)" />
                      <span>{{ p.label }} <span class="mono muted">{{ p.key }}</span></span>
                    </label>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <div class="pform-footer">
          <div class="pform-footer__meta">{{ r.is_system ? 'Rol del sistema' : selected.size + ' permiso(s) seleccionado(s)' }}</div>
          <div class="pform-footer__actions">
            <a routerLink="/admin/roles" class="btn btn-ghost">Cancelar</a>
            <button type="submit" class="btn btn-accent" [disabled]="saving()"><i class="bi bi-check-lg"></i> Guardar permisos</button>
          </div>
        </div>
      </form>
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: [`
    .modules { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .module { border: 1px solid var(--a-line); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
    .module__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
    .module__head h3 { margin: 0; font-size: 18px; }
    .perm span.mono { display: block; font-size: 11.5px; }
    .perm { align-items: flex-start; }
    .perm input { margin-top: 2px; }
  `],
})
export class RoleEditComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  private auth = inject(AuthService);

  role = signal<AdminRole | null>(null);
  groups = signal<PermissionGroup[]>([]);
  saving = signal(false);
  selected = new Set<number>();
  form = { name: '', description: '', active: true };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.api.get<PermissionGroup[]>('roles/permisos').subscribe((g) => this.groups.set(g));
    this.api.get<AdminRole>(`roles/${id}`).subscribe({
      next: (r) => this.set(r),
      error: (e) => {
        this.ui.apiError(e, 'El rol no existe.');
        this.router.navigate(['/admin/roles']);
      },
    });
  }

  toggle(id: number): void {
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
  }

  moduleFull(g: PermissionGroup): boolean {
    return g.permissions.every((p) => this.selected.has(p.id));
  }

  toggleModule(g: PermissionGroup): void {
    const full = this.moduleFull(g);
    g.permissions.forEach((p) => (full ? this.selected.delete(p.id) : this.selected.add(p.id)));
  }

  all(on: boolean): void {
    this.groups().forEach((g) => g.permissions.forEach((p) => (on ? this.selected.add(p.id) : this.selected.delete(p.id))));
  }

  save(): void {
    const r = this.role();
    if (!r) return;
    this.saving.set(true);
    this.api.put<AdminRole>(`roles/${r.id}`, { ...this.form, permissions: [...this.selected] }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.set(updated);
        this.ui.success('Permisos guardados.');
        // Si editó su propio rol, se refrescan sus permisos en el menú.
        this.auth.fetchMe().subscribe();
      },
      error: (e) => {
        this.saving.set(false);
        this.ui.apiError(e);
      },
    });
  }

  private set(r: AdminRole): void {
    this.role.set(r);
    this.form = { name: r.name, description: r.description ?? '', active: r.active };
    this.selected = new Set(r.permission_ids);
  }
}
