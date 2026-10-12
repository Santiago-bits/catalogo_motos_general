import { Component, Input } from '@angular/core';

/** Silueta de moto usada como ícono y como placeholder de foto. */
@Component({
  selector: 'app-moto-icon',
  standalone: true,
  template: `
    <svg aria-hidden="true" [attr.width]="width" [attr.height]="height" viewBox="0 0 240 130" fill="none"
      [attr.stroke]="color" [attr.stroke-width]="strokeWidth" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="48" cy="92" r="32"></circle>
      @if (detailed) { <circle cx="48" cy="92" r="8"></circle> }
      <circle cx="192" cy="92" r="32"></circle>
      @if (detailed) { <circle cx="192" cy="92" r="8"></circle> }
      <path d="M48 92 82 50h52l22 18 36 24"></path>
      <path d="M82 50 100 30h40l14 20"></path>
      @if (detailed) {
        <path d="M150 30l14-14h14"></path>
        <path d="M104 70h40"></path>
      }
    </svg>
  `,
  styles: [`:host { display: contents; }`],
})
export class MotoIconComponent {
  @Input() width: string | number = '66%';
  @Input() height: string | number | null = null;
  @Input() color = '#A5A7AE';
  @Input() strokeWidth = 3;
  @Input() detailed = true;
}
