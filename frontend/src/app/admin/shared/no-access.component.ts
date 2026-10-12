import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-no-access',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="card-admin">
      <div class="empty-state">
        <i class="bi bi-shield-lock"></i>
        <p><strong>Tu rol no tiene acceso a esta sección.</strong></p>
        <p>Si lo necesitás, pedile a un administrador que te agregue el permiso desde <em>Roles</em>.</p>
        <a routerLink="/admin/perfil" class="btn btn-ghost btn-sm">Ir a mi perfil</a>
      </div>
    </div>
  `,
})
export class NoAccessComponent {}
