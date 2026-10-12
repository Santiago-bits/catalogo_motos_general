import { Component, ElementRef, HostListener, Input, ViewChild, inject, signal } from '@angular/core';

/**
 * Menú desplegable con posición fija (no lo recortan las tablas con scroll),
 * equivalente al dropdown de Bootstrap con strategy "fixed" que usa SH.
 *
 * <app-dd>
 *   <button trigger class="btn-icon"><i class="bi bi-three-dots-vertical"></i></button>
 *   <button class="dd-item">…</button>
 * </app-dd>
 */
@Component({
  selector: 'app-dd',
  standalone: true,
  template: `
    <span class="dd" #trigger (click)="toggle($event)">
      <ng-content select="[trigger]"></ng-content>
    </span>
    @if (open()) {
      <div class="dd-menu" role="menu" [style.top.px]="top()" [style.left.px]="left()" (click)="close()">
        <ng-content></ng-content>
      </div>
    }
  `,
  styles: [`:host { display: inline-block; }`],
})
export class DropdownComponent {
  @Input() align: 'start' | 'end' = 'end';
  @Input() width = 220;
  @ViewChild('trigger', { static: true }) trigger!: ElementRef<HTMLElement>;

  private host = inject(ElementRef<HTMLElement>);
  open = signal(false);
  top = signal(0);
  left = signal(0);

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    const rect = this.trigger.nativeElement.getBoundingClientRect();
    const left = this.align === 'end' ? rect.right - this.width : rect.left;
    this.left.set(Math.max(8, Math.min(left, window.innerWidth - this.width - 8)));
    // Si no entra abajo, se abre hacia arriba (estimado: ~300px de menú).
    const below = rect.bottom + 4;
    this.top.set(below + 300 > window.innerHeight && rect.top > 320 ? Math.max(8, rect.top - 304) : below);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.close();
  }
}
