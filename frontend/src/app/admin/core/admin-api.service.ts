import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ProductType = 'moto' | 'casco' | 'repuesto';

export interface Paginated<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  // Formato de paginación "plano" de Laravel (consultas, auditoría, cotizaciones)
  current_page?: number;
  last_page?: number;
  total?: number;
  from?: number | null;
  to?: number | null;
}

export interface AdminBrand { id: number; name: string; slug: string; logo_path: string | null; active: boolean; products_count?: number; }
export interface AdminCategory { id: number; group: ProductType; name: string; slug: string; image_path?: string | null; parent_id: number | null; parent?: { id: number; name: string } | null; sort_order: number; active: boolean; products_count?: number; }
export interface AdminTag { id: number; name: string; slug: string; color: string; products_count?: number; }
export interface AdminFeature { id: number; name: string; slug: string; unit: string | null; value_type: 'text' | 'number'; sort_order: number; }
export interface AdminService { id: number; title: string; slug: string; icon: string | null; image_path: string | null; summary: string | null; description: string | null; sort_order: number; active: boolean; }

export interface AdminInquiry {
  id: number;
  product_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: 'nueva' | 'en_proceso' | 'respondida' | 'cerrada';
  source: string | null;
  assigned_to: number | null;
  internal_note: string | null;
  replied_at: string | null;
  created_at: string;
  product?: { id: number; name: string; slug: string; type: ProductType; code?: string } | null;
  assignee?: { id: number; name: string } | null;
}

export interface AdminRole { id: number; name: string; slug: string; description: string | null; is_system: boolean; active: boolean; users_count: number; permission_ids: number[]; }
export interface PermissionGroup { module: string; permissions: { id: number; key: string; module: string; label: string }[]; }
export interface AdminUserRow { id: number; name: string; email: string; phone: string | null; position: string | null; role_id: number | null; role_name: string | null; is_admin: boolean; active: boolean; must_change_password: boolean; last_login_at: string | null; created_at: string; }
export interface AuditLog { id: number; user_id: number | null; user?: { id: number; name: string } | null; action: string; module: string | null; subject_type: string | null; subject_id: number | null; description: string | null; changes: Record<string, [unknown, unknown]> | null; ip: string | null; created_at: string; }

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  readonly base = `${environment.apiUrl}/admin`;

  // ------------------------------------------------------------------
  // Genéricos
  // ------------------------------------------------------------------
  get<T = any>(path: string, params: Record<string, unknown> = {}): Observable<T> {
    return this.http.get<T>(`${this.base}/${path}`, { params: this.params(params) });
  }

  post<T = any>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body);
  }

  put<T = any>(path: string, body: unknown = {}): Observable<T> {
    return this.http.put<T>(`${this.base}/${path}`, body);
  }

  delete<T = any>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/${path}`);
  }

  upload<T = any>(path: string, fields: Record<string, string | Blob | boolean | null | undefined>): Observable<T> {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
    });
    return this.http.post<T>(`${this.base}/${path}`, form);
  }

  /** Descarga un archivo del panel (Excel, CSV, PDF, plantillas) y lo guarda en la PC. */
  download(path: string, params: Record<string, unknown> = {}, fallbackName = 'archivo'): Observable<void> {
    return this.http
      .get(`${this.base}/${path}`, { params: this.params(params), responseType: 'blob', observe: 'response' })
      .pipe(
        map((res: HttpResponse<Blob>) => this.saveBlob(res, fallbackName)),
        // En las descargas el error llega como Blob: se lee para mostrar el mensaje real del servidor.
        catchError((err: HttpErrorResponse) => {
          if (!(err.error instanceof Blob)) return throwError(() => err);
          return from(err.error.text()).pipe(
            switchMap((text) => {
              let body: unknown = null;
              try {
                body = JSON.parse(text);
              } catch {
                /* no era JSON */
              }
              return throwError(() => new HttpErrorResponse({ error: body, status: err.status, statusText: err.statusText, url: err.url ?? undefined }));
            })
          );
        })
      );
  }

  // ------------------------------------------------------------------
  // Atajos usados en varias pantallas
  // ------------------------------------------------------------------
  brands(): Observable<AdminBrand[]> {
    return this.get('marcas');
  }

  categories(group?: ProductType): Observable<AdminCategory[]> {
    return this.get('categorias', { grupo: group });
  }

  tags(): Observable<AdminTag[]> {
    return this.get('etiquetas');
  }

  features(): Observable<AdminFeature[]> {
    return this.get('caracteristicas');
  }

  counters(): Observable<{ inquiries_new: number; quotes_pending: number }> {
    return this.get('contadores');
  }

  private params(values: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== false) {
        params = params.set(key, value === true ? '1' : String(value));
      }
    });
    return params;
  }

  private saveBlob(res: HttpResponse<Blob>, fallbackName: string): void {
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const name = match ? match[1] : fallbackName;
    const url = URL.createObjectURL(res.body as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
