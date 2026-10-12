import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  image: string | null;
}

const STORAGE_KEY = 'catalogo_motos_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  items = signal<CartItem[]>(this.loadFromStorage());
  count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  total = computed(() => this.items().reduce((sum, item) => sum + item.price * item.quantity, 0));

  add(product: Product, quantity = 1): void {
    const existing = this.items().find((i) => i.productId === product.id);
    const price = product.price.is_offer && product.price.offer ? product.price.offer : product.price.final;
    const image = product.images?.find((i) => i.is_main)?.path ?? product.images?.[0]?.path ?? null;

    if (existing) {
      this.items.update((items) =>
        items.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i))
      );
    } else {
      this.items.update((items) => [
        ...items,
        { productId: product.id, name: product.name, price, currency: product.price.currency, quantity, image },
      ]);
    }
    this.persist();
  }

  updateQuantity(productId: number, quantity: number): void {
    if (quantity < 1) return;
    this.items.update((items) => items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
    this.persist();
  }

  remove(productId: number): void {
    this.items.update((items) => items.filter((i) => i.productId !== productId));
    this.persist();
  }

  clear(): void {
    this.items.set([]);
    this.persist();
  }

  submit(payload: { name: string; email?: string; phone?: string; message?: string }) {
    const items = this.items().map((i) => ({ product_id: i.productId, quantity: i.quantity }));
    return this.http.post<{ ok: boolean; number: string }>(`${this.baseUrl}/cotizador`, { ...payload, items });
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
    } catch {
      /* localStorage unavailable */
    }
  }

  private loadFromStorage(): CartItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  }
}
