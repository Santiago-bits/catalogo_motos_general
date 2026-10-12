import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../core/admin-api.service';
import { AdminUser, AuthService } from '../core/auth.service';
import { date } from '../core/labels';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (auth.user()?.must_change_password) {
      <div class="alert alert--warn"><span><i class="bi bi-shield-exclamation"></i> Por seguridad tenés que elegir una contraseña nueva antes de seguir usando el panel.</span></div>
    }

    <div class="grid-2">
      <div class="stack">
        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-person-gear"></i> Mis datos</h2></div>
          <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="saveProfile()">
            <div><label class="form-label" for="p-name">Nombre *</label><input class="form-control" id="p-name" name="name" [(ngModel)]="profile.name" maxlength="120" [class.is-invalid]="profileErrors()['name']" />@if (profileErrors()['name']) { <p class="form-error">{{ profileErrors()['name'] }}</p> }</div>
            <div><label class="form-label" for="p-email">Email *</label><input class="form-control" type="email" id="p-email" name="email" [(ngModel)]="profile.email" maxlength="160" [class.is-invalid]="profileErrors()['email']" />@if (profileErrors()['email']) { <p class="form-error">{{ profileErrors()['email'] }}</p> }</div>
            <div><label class="form-label" for="p-phone">Teléfono</label><input class="form-control" id="p-phone" name="phone" [(ngModel)]="profile.phone" maxlength="40" /></div>
            <div>
              <label class="form-label" for="p-current">Contraseña actual * <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">— para confirmar los cambios</span></label>
              <input class="form-control" type="password" id="p-current" name="current_password" [(ngModel)]="profile.current_password" autocomplete="current-password" [class.is-invalid]="profileErrors()['current_password']" />
              @if (profileErrors()['current_password']) { <p class="form-error">{{ profileErrors()['current_password'] }}</p> }
            </div>
            <button type="submit" class="btn btn-accent" style="align-self:flex-start" [disabled]="busy() === 'profile'"><i class="bi bi-check-lg"></i> Guardar cambios</button>
          </form>
        </div>
      </div>

      <div class="stack">
        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-key"></i> Cambiar contraseña</h2></div>
          <form class="card-admin__body stack" style="gap:14px" (ngSubmit)="savePassword()">
            <div>
              <label class="form-label" for="pw-current">Contraseña actual *</label>
              <input class="form-control" type="password" id="pw-current" name="current_password" [(ngModel)]="pw.current_password" autocomplete="current-password" [class.is-invalid]="pwErrors()['current_password']" />
              @if (pwErrors()['current_password']) { <p class="form-error">{{ pwErrors()['current_password'] }}</p> }
            </div>
            <div>
              <label class="form-label" for="pw-new">Contraseña nueva *</label>
              <input class="form-control" type="password" id="pw-new" name="password" [(ngModel)]="pw.password" autocomplete="new-password" [class.is-invalid]="pwErrors()['password']" />
              @if (pwErrors()['password']) { <p class="form-error">{{ pwErrors()['password'] }}</p> } @else { <p class="form-hint">Mínimo 8 caracteres.</p> }
            </div>
            <div>
              <label class="form-label" for="pw-confirm">Repetir contraseña nueva *</label>
              <input class="form-control" type="password" id="pw-confirm" name="password_confirmation" [(ngModel)]="pw.password_confirmation" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-dark" style="align-self:flex-start" [disabled]="busy() === 'pw'"><i class="bi bi-shield-lock"></i> Cambiar contraseña</button>
            <p class="form-hint" style="margin:0">Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.</p>
          </form>
        </div>

        <div class="card-admin">
          <div class="card-admin__head"><h2><i class="bi bi-info-circle"></i> Sesión</h2></div>
          <div class="card-admin__body">
            <div class="form-switch-row"><div><strong>{{ auth.user()?.role_name }}</strong><small>Rol</small></div></div>
            <div class="form-switch-row"><div><strong>{{ auth.user()?.last_login_at ? date(auth.user()!.last_login_at, true) : '—' }}</strong><small>Último ingreso</small></div></div>
            <div class="form-switch-row"><div><strong>{{ auth.user()?.permissions?.length ?? 0 }}</strong><small>Permisos activos</small></div></div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);
  auth = inject(AuthService);

  busy = signal<'profile' | 'pw' | null>(null);
  profileErrors = signal<Record<string, string>>({});
  pwErrors = signal<Record<string, string>>({});
  profile = { name: '', email: '', phone: '', current_password: '' };
  pw = { current_password: '', password: '', password_confirmation: '' };
  date = date;

  ngOnInit(): void {
    const fill = (u: AdminUser | null) => {
      if (u) this.profile = { name: u.name, email: u.email, phone: u.phone ?? '', current_password: '' };
    };
    fill(this.auth.user());
    if (!this.auth.user()) this.auth.fetchMe().subscribe((u) => fill(u));
  }

  saveProfile(): void {
    this.busy.set('profile');
    this.api.put<AdminUser>('perfil', this.profile).subscribe({
      next: (user) => {
        this.busy.set(null);
        this.profileErrors.set({});
        this.auth.user.set(user);
        this.profile.current_password = '';
        this.ui.success('Tus datos se guardaron.');
      },
      error: (e) => {
        this.busy.set(null);
        this.profileErrors.set(this.fieldErrors(e));
        this.ui.apiError(e);
      },
    });
  }

  savePassword(): void {
    if (this.pw.password !== this.pw.password_confirmation) {
      this.pwErrors.set({ password: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    this.busy.set('pw');
    this.api.put('perfil/password', this.pw).subscribe({
      next: () => {
        this.busy.set(null);
        this.pwErrors.set({});
        this.pw = { current_password: '', password: '', password_confirmation: '' };
        const u = this.auth.user();
        if (u) this.auth.user.set({ ...u, must_change_password: false });
        this.ui.success('Contraseña cambiada.');
      },
      error: (e) => {
        this.busy.set(null);
        this.pwErrors.set(this.fieldErrors(e));
        this.ui.apiError(e);
      },
    });
  }

  private fieldErrors(e: any): Record<string, string> {
    const out: Record<string, string> = {};
    Object.entries((e?.error?.errors ?? {}) as Record<string, string[]>).forEach(([k, v]) => (out[k] = v[0]));
    return out;
  }
}
