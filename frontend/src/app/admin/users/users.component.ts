import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService, AdminRole, AdminUserRow } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { date } from '../core/labels';
import { UiService } from '../core/ui.service';
import { DropdownComponent } from '../shared/dropdown.component';
import { ModalComponent } from '../shared/modal.component';

interface UserForm {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role_id: number | null;
  phone: string;
  position: string;
  active: boolean;
  must_change_password: boolean;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, RouterLink, DropdownComponent, ModalComponent],
  template: `
    <div class="grid-side">
      <div class="stack">
        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-people-fill"></i> Usuarios <span class="count">{{ users().length }} registro(s)</span></h2></div>
          <div class="card-admin__body card-admin__body--flush">
            <div class="table-wrap">
              <table class="table-admin">
                <thead><tr><th>Usuario</th><th>Rol</th><th>Último ingreso</th><th>Estado</th><th class="actions">Acciones</th></tr></thead>
                <tbody>
                  @for (u of users(); track u.id) {
                    <tr>
                      <td>
                        <div class="table-product" style="min-width:200px">
                          <span class="avatar">{{ u.name.charAt(0).toUpperCase() }}</span>
                          <span>
                            <span class="table-product__name">{{ u.name }} @if (u.id === auth.user()?.id) { <span class="chip chip--neutral">Vos</span> }</span>
                            <span class="table-product__meta small">{{ u.email }}{{ u.position ? ' · ' + u.position : '' }}</span>
                          </span>
                        </div>
                      </td>
                      <td><span class="chip" [class.chip--dark]="u.is_admin" [class.chip--neutral]="!u.is_admin">{{ u.role_name ?? 'Sin rol' }}</span></td>
                      <td class="muted small nowrap">{{ u.last_login_at ? date(u.last_login_at, true) : 'Nunca' }}</td>
                      <td>
                        @if (u.active) { <span class="chip chip--ok">Activo</span> } @else { <span class="chip chip--neutral">Inactivo</span> }
                        @if (u.must_change_password) { <span class="chip chip--warn" title="Debe cambiar la contraseña al ingresar">Cambiar clave</span> }
                      </td>
                      <td class="actions">
                        @if (canManage) {
                          <app-dd [width]="210">
                            <button trigger type="button" class="btn-icon" title="Acciones"><i class="bi bi-three-dots-vertical"></i></button>
                            <button type="button" class="dd-item" (click)="edit(u)"><i class="bi bi-pencil"></i> Editar</button>
                            @if (u.id !== auth.user()?.id) {
                              <button type="button" class="dd-item" (click)="toggleActive(u)"><i class="bi" [class.bi-pause-circle]="u.active" [class.bi-play-circle]="!u.active"></i> {{ u.active ? 'Desactivar' : 'Activar' }}</button>
                              <div class="dd-divider"></div>
                              <button type="button" class="dd-item dd-item--danger" (click)="remove(u)"><i class="bi bi-trash"></i> Eliminar</button>
                            }
                          </app-dd>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card-admin">
          <div class="card-admin__head">
            <h2><i class="bi bi-key-fill"></i> Roles</h2>
            @if (auth.can('roles.manage')) { <a routerLink="/admin/roles" class="btn btn-ghost btn-sm">Administrar roles</a> }
          </div>
          <div class="card-admin__body card-admin__body--flush">
            <table class="table-admin">
              <thead><tr><th>Rol</th><th>Descripción</th><th class="num">Usuarios</th></tr></thead>
              <tbody>
                @for (r of roles(); track r.id) {
                  <tr><td><strong>{{ r.name }}</strong></td><td class="muted small">{{ r.description }}</td><td class="num">{{ r.users_count }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (canManage) {
        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-person-plus"></i> Nuevo usuario</h2></div>
          <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="create()" autocomplete="off">
            <div><label class="form-label" for="u-name">Nombre *</label><input class="form-control" id="u-name" name="name" [(ngModel)]="draft.name" maxlength="120" /></div>
            <div><label class="form-label" for="u-email">Email *</label><input class="form-control" type="email" id="u-email" name="email" [(ngModel)]="draft.email" maxlength="160" autocomplete="off" /></div>
            <div><label class="form-label" for="u-pass">Contraseña *</label><input class="form-control" type="password" id="u-pass" name="password" [(ngModel)]="draft.password" minlength="8" autocomplete="new-password" /><p class="form-hint">Mínimo 8 caracteres.</p></div>
            <div><label class="form-label" for="u-pass2">Repetir contraseña *</label><input class="form-control" type="password" id="u-pass2" name="password_confirmation" [(ngModel)]="draft.password_confirmation" autocomplete="new-password" /></div>
            <div>
              <label class="form-label" for="u-role">Rol *</label>
              <select class="form-select" id="u-role" name="role_id" [(ngModel)]="draft.role_id">
                <option [ngValue]="null" disabled>Elegí un rol</option>
                @for (r of activeRoles(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }
              </select>
            </div>
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px">
              <div><label class="form-label" for="u-phone">Teléfono</label><input class="form-control" id="u-phone" name="phone" [(ngModel)]="draft.phone" maxlength="40" /></div>
              <div><label class="form-label" for="u-pos">Cargo</label><input class="form-control" id="u-pos" name="position" [(ngModel)]="draft.position" maxlength="120" /></div>
            </div>
            <label class="filter-check"><input type="checkbox" name="active" [(ngModel)]="draft.active" /> Cuenta activa</label>
            <label class="filter-check"><input type="checkbox" name="must" [(ngModel)]="draft.must_change_password" /> Debe cambiar la contraseña al ingresar</label>
            <button type="submit" class="btn btn-accent btn-block"><i class="bi bi-person-plus"></i> Crear usuario</button>
          </form>
        </div>
      }
    </div>

    <app-modal [open]="!!editing()" [title]="'Editar «' + (editing()?.name ?? '') + '»'" (closed)="editing.set(null)">
      <div class="form-grid">
        <div class="span-all"><label class="form-label">Nombre *</label><input class="form-control" name="e-name" [(ngModel)]="editForm.name" maxlength="120" /></div>
        <div class="span-all"><label class="form-label">Email *</label><input class="form-control" type="email" name="e-email" [(ngModel)]="editForm.email" maxlength="160" /></div>
        <div>
          <label class="form-label">Rol *</label>
          <select class="form-select" name="e-role" [(ngModel)]="editForm.role_id" [disabled]="editing()?.id === auth.user()?.id">
            @for (r of roles(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }
          </select>
        </div>
        <div><label class="form-label">Teléfono</label><input class="form-control" name="e-phone" [(ngModel)]="editForm.phone" maxlength="40" /></div>
        <div><label class="form-label">Cargo</label><input class="form-control" name="e-pos" [(ngModel)]="editForm.position" maxlength="120" /></div>
        <div><label class="form-label">Nueva contraseña</label><input class="form-control" type="password" name="e-pass" [(ngModel)]="editForm.password" autocomplete="new-password" placeholder="Dejar vacío para no cambiarla" /></div>
        @if (editing()?.id !== auth.user()?.id) { <label class="filter-check span-all"><input type="checkbox" name="e-active" [(ngModel)]="editForm.active" /> Cuenta activa</label> }
        <label class="filter-check span-all"><input type="checkbox" name="e-must" [(ngModel)]="editForm.must_change_password" /> Debe cambiar la contraseña al ingresar</label>
      </div>
      <ng-container footer>
        <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
        <button type="button" class="btn btn-accent" (click)="saveEdit()"><i class="bi bi-check-lg"></i> Guardar</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`.avatar { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; background: #15161A; color: #FFF; font-family: var(--r-display); font-weight: 800; font-size: 18px; }`],
})
export class UsersComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);
  auth = inject(AuthService);

  users = signal<AdminUserRow[]>([]);
  roles = signal<AdminRole[]>([]);
  editing = signal<AdminUserRow | null>(null);
  draft: UserForm = this.empty();
  editForm: UserForm = this.empty();
  canManage = false;
  date = date;

  ngOnInit(): void {
    this.canManage = this.auth.can('users.manage');
    this.load();
    this.api.get<AdminRole[]>('roles').subscribe((r) => this.roles.set(r));
  }

  activeRoles(): AdminRole[] {
    return this.roles().filter((r) => r.active);
  }

  load(): void {
    this.api.get<AdminUserRow[]>('usuarios').subscribe((u) => this.users.set(u));
  }

  create(): void {
    if (this.draft.password !== this.draft.password_confirmation) {
      this.ui.error('Las contraseñas no coinciden.');
      return;
    }
    this.api.post('usuarios', this.draft).subscribe({
      next: () => {
        this.ui.success(`Usuario ${this.draft.email} creado.`);
        this.draft = this.empty();
        this.load();
        this.api.get<AdminRole[]>('roles').subscribe((r) => this.roles.set(r));
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  edit(u: AdminUserRow): void {
    this.editForm = { name: u.name, email: u.email, password: '', password_confirmation: '', role_id: u.role_id, phone: u.phone ?? '', position: u.position ?? '', active: u.active, must_change_password: u.must_change_password };
    this.editing.set(u);
  }

  saveEdit(): void {
    const u = this.editing();
    if (!u) return;
    this.api.put(`usuarios/${u.id}`, this.editForm).subscribe({
      next: () => {
        this.editing.set(null);
        this.ui.success('Usuario actualizado.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  toggleActive(u: AdminUserRow): void {
    this.api.put(`usuarios/${u.id}`, { name: u.name, email: u.email, role_id: u.role_id, phone: u.phone, position: u.position, active: !u.active, must_change_password: u.must_change_password }).subscribe({
      next: () => {
        this.ui.success(u.active ? 'Usuario desactivado.' : 'Usuario activado.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async remove(u: AdminUserRow): Promise<void> {
    if (!(await this.ui.confirm(`¿Eliminar a ${u.name} (${u.email})? Pierde el acceso al panel.`, { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`usuarios/${u.id}`).subscribe({
      next: () => {
        this.ui.success('Usuario eliminado.');
        this.load();
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  private empty(): UserForm {
    return { name: '', email: '', password: '', password_confirmation: '', role_id: null, phone: '', position: '', active: true, must_change_password: false };
  }
}
