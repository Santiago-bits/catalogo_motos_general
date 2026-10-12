import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  role: string | null;
  role_name: string | null;
  is_admin: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  permissions: string[];
}

const TOKEN_KEY = 'catalogo_motos_admin_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = `${environment.apiUrl}/admin`;

  user = signal<AdminUser | null>(null);
  private permissionSet = computed(() => new Set(this.user()?.permissions ?? []));

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  /** ¿El usuario tiene alguno de estos permisos? */
  can(...permissions: string[]): boolean {
    const user = this.user();
    if (!user) return false;
    if (user.is_admin) return true;
    return permissions.some((p) => this.permissionSet().has(p));
  }

  login(email: string, password: string) {
    return this.http
      .post<{ token: string; user: AdminUser }>(`${this.baseUrl}/login`, { email, password })
      .pipe(tap((res) => this.startSession(res)));
  }

  /** "Iniciar sesión con Google": manda el ID token que entrega Google para que el backend lo verifique. */
  loginWithGoogle(credential: string) {
    return this.http
      .post<{ token: string; user: AdminUser }>(`${this.baseUrl}/login/google`, { credential })
      .pipe(tap((res) => this.startSession(res)));
  }

  /** ID de cliente de Google si el login con Google está activo (null si no). */
  loginConfig() {
    return this.http.get<{ google_client_id: string | null }>(`${this.baseUrl}/login/config`);
  }

  private startSession(res: { token: string; user: AdminUser }): void {
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
    } catch {
      /* localStorage no disponible */
    }
    this.user.set(res.user);
  }

  fetchMe() {
    return this.http.get<AdminUser>(`${this.baseUrl}/me`).pipe(tap((user) => this.user.set(user)));
  }

  logout(): void {
    this.http.post(`${this.baseUrl}/logout`, {}).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  clearSession(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* localStorage no disponible */
    }
    this.user.set(null);
    this.router.navigate(['/admin/login']);
  }
}
