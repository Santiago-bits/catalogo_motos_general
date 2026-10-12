import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Paginador compacto: ← 1 … 4 5 [6] 7 8 … 20 → */
@Component({
  selector: 'app-pager',
  standalone: true,
  template: `
    @if (last > 1) {
      <nav class="pager" aria-label="Páginas">
        <button type="button" [disabled]="current <= 1" (click)="go(current - 1)" aria-label="Anterior"><i class="bi bi-chevron-left"></i></button>
        @for (p of pages(); track $index) {
          @if (p === 0) {
            <span class="muted">…</span>
          } @else {
            <button type="button" [class.is-active]="p === current" [attr.aria-current]="p === current ? 'page' : null" (click)="go(p)">{{ p }}</button>
          }
        }
        <button type="button" [disabled]="current >= last" (click)="go(current + 1)" aria-label="Siguiente"><i class="bi bi-chevron-right"></i></button>
      </nav>
    }
  `,
})
export class PagerComponent {
  @Input() current = 1;
  @Input() last = 1;
  @Output() page = new EventEmitter<number>();

  go(p: number): void {
    if (p >= 1 && p <= this.last && p !== this.current) this.page.emit(p);
  }

  /** Números a mostrar; 0 = puntos suspensivos. */
  pages(): number[] {
    const set = new Set<number>([1, this.last]);
    for (let p = this.current - 2; p <= this.current + 2; p++) {
      if (p >= 1 && p <= this.last) set.add(p);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push(0);
      out.push(p);
    });
    return out;
  }
}
