import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'catalogo_motos_compare';
const MAX_ITEMS = 4;

@Injectable({ providedIn: 'root' })
export class CompareService {
  ids = signal<number[]>(this.loadFromStorage());
  count = computed(() => this.ids().length);

  has(id: number): boolean {
    return this.ids().includes(id);
  }

  toggle(id: number): void {
    if (this.has(id)) {
      this.remove(id);
    } else {
      this.add(id);
    }
  }

  add(id: number): void {
    if (this.has(id) || this.ids().length >= MAX_ITEMS) return;
    this.ids.update((ids) => [...ids, id]);
    this.persist();
  }

  remove(id: number): void {
    this.ids.update((ids) => ids.filter((i) => i !== id));
    this.persist();
  }

  clear(): void {
    this.ids.set([]);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ids()));
    } catch {
      /* localStorage unavailable */
    }
  }

  private loadFromStorage(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }
}
