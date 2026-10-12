import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Modal del panel (cabecera negra, borde rojo), como los modales de edición de SH.
 * Contenido: el cuerpo va directo; el pie con [footer].
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (open) {
      <div class="adm-modal-backdrop" (mousedown)="onBackdrop($event)">
        <div class="adm-modal" [class.adm-modal--lg]="size === 'lg'" role="dialog" aria-modal="true" [attr.aria-label]="title">
          <div class="adm-modal__head">
            <h2>{{ title }}</h2>
            <button type="button" class="adm-modal__close" (click)="closed.emit()" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="adm-modal__body"><ng-content></ng-content></div>
          <div class="adm-modal__foot"><ng-content select="[footer]"></ng-content></div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() size: 'md' | 'lg' = 'md';
  @Output() closed = new EventEmitter<void>();

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.closed.emit();
  }
}
