import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminApiService } from '../core/admin-api.service';

/** Novedades del panel: muestra resources/content/novedades.html (se edita a mano, como en SH). */
@Component({
  selector: 'app-admin-news',
  standalone: true,
  template: `
    <div class="card-admin">
      <div class="card-admin__head">
        <h2><i class="bi bi-megaphone-fill"></i> Novedades</h2>
        <span class="muted small">Notas de las actualizaciones del sistema</span>
      </div>
      <div class="card-admin__body">
        @if (html()) {
          <div class="news-body" [innerHTML]="html()"></div>
        } @else if (loaded()) {
          <p class="muted" style="margin:0">Todavía no hay novedades cargadas.</p>
        } @else {
          <p class="muted" style="margin:0">Cargando…</p>
        }
      </div>
    </div>
  `,
})
export class NewsComponent implements OnInit {
  private api = inject(AdminApiService);
  html = signal('');
  loaded = signal(false);

  ngOnInit(): void {
    this.api.get<{ html: string }>('novedades').subscribe({
      next: (res) => {
        this.html.set(res.html);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }
}
