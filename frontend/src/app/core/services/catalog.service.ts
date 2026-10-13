import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BrandRef, CatalogFilters, CategoryRef, PaginatedResponse, Product, ProductType } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  private endpointFor(type: ProductType): string {
    return { moto: 'motos', casco: 'cascos', repuesto: 'repuestos' }[type];
  }

  list(type: ProductType, filters: CatalogFilters = {}): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<PaginatedResponse<Product>>(`${this.baseUrl}/${this.endpointFor(type)}`, { params });
  }

  show(type: ProductType, slug: string): Observable<{ data: Product }> {
    return this.http.get<{ data: Product }>(`${this.baseUrl}/${this.endpointFor(type)}/${slug}`);
  }

  featured(): Observable<{ data: Product[] }> {
    return this.http.get<{ data: Product[] }>(`${this.baseUrl}/destacados`);
  }

  search(term: string): Observable<{ data: Product[] }> {
    return this.http.get<{ data: Product[] }>(`${this.baseUrl}/buscar`, { params: { q: term } });
  }

  /** Marcas activas; con sección, sólo las de esa sección (motos, cascos o repuestos). */
  brands(group?: ProductType): Observable<BrandRef[]> {
    const params = group ? new HttpParams().set('grupo', group) : undefined;
    return this.http.get<BrandRef[]>(`${this.baseUrl}/marcas`, { params });
  }

  categories(group?: ProductType): Observable<CategoryRef[]> {
    const params = group ? new HttpParams().set('grupo', group) : undefined;
    return this.http.get<CategoryRef[]>(`${this.baseUrl}/categorias`, { params });
  }

  sendInquiry(payload: { product_id?: number; name: string; email?: string; phone?: string; message?: string; source?: string }) {
    return this.http.post(`${this.baseUrl}/consultas`, payload);
  }

  compare(ids: number[]): Observable<{ data: Product[] }> {
    return this.http.get<{ data: Product[] }>(`${this.baseUrl}/comparar`, { params: { ids: ids.join(',') } });
  }

  services(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/servicios`);
  }

  service(slug: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/servicios/${slug}`);
  }

  settings(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.baseUrl}/ajustes`);
  }
}
