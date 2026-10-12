import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/admin/login']);
};

/**
 * Exige el permiso indicado en data.perm (uno o varios). Si el usuario
 * todavía no se cargó, lo pide antes de decidir.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required: string[] = ([] as string[]).concat(route.data['perm'] ?? []);

  if (required.length === 0) return true;

  const decide = () => (auth.can(...required) ? true : router.createUrlTree(['/admin/sin-permiso']));

  if (auth.user()) return decide();

  return auth.fetchMe().pipe(map(() => decide()));
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/admin']) : of(true);
};
