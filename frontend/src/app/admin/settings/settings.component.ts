import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { AdminApiService } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';
import { SiteService } from '../../core/services/site.service';

interface SettingDef {
  label: string;
  type: 'text' | 'textarea' | 'email' | 'url' | 'tel' | 'select' | 'bool' | 'image';
  help?: string;
  options?: Record<string, string>;
}

interface SettingGroup {
  key: string;
  label: string;
  icon: string;
  settings: Record<string, SettingDef>;
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, KeyValuePipe],
  template: `
    <form (ngSubmit)="save()">
      <div class="grid-2">
        @for (group of groups(); track group.key) {
          <div class="card-admin">
            <div class="card-admin__head"><h2><i class="bi" [class]="'bi-' + group.icon"></i> {{ group.label }}</h2></div>
            <div class="card-admin__body stack" style="gap:16px">
              @for (s of group.settings | keyvalue: keepOrder; track s.key) {
                <div>
                  @if (s.value.type === 'bool') {
                    <div class="form-switch-row" style="padding:0">
                      <div><strong>{{ s.value.label }}</strong>@if (s.value.help) { <small>{{ s.value.help }}</small> }</div>
                      <label class="switch"><input type="checkbox" [name]="s.key" [ngModel]="values[s.key] === '1'" (ngModelChange)="values[s.key] = $event ? '1' : '0'" /><span></span></label>
                    </div>
                  } @else {
                    <label class="form-label" [for]="'set-' + s.key">{{ s.value.label }}</label>
                    @if (s.value.type === 'textarea') {
                      <textarea class="form-control" [id]="'set-' + s.key" [name]="s.key" rows="3" [(ngModel)]="values[s.key]"></textarea>
                    } @else if (s.value.type === 'select') {
                      <select class="form-select" [id]="'set-' + s.key" [name]="s.key" [(ngModel)]="values[s.key]">
                        @for (o of s.value.options! | keyvalue: keepOrder; track o.key) { <option [value]="o.key">{{ o.value }}</option> }
                      </select>
                    } @else if (s.value.type === 'image') {
                      <div class="img-setting">
                        @if (values[s.key]) {
                          <img [src]="values[s.key]" alt="" />
                        } @else {
                          <span class="img-empty"><i class="bi bi-image"></i></span>
                        }
                        <div class="stack" style="gap:8px;flex:1">
                          <input class="form-control" type="file" [accept]="s.key === 'site_logo' || s.key === 'brand_icon' ?'image/png,image/jpeg,image/webp,image/svg+xml' : 'image/png,image/jpeg,image/webp'" (change)="uploadImage(s.key, $event)" />
                          @if (values[s.key]) { <button type="button" class="btn btn-danger btn-sm" style="align-self:flex-start" (click)="removeImage(s.key)">Quitar imagen</button> }
                        </div>
                      </div>
                    } @else {
                      <input class="form-control" [type]="s.value.type" [id]="'set-' + s.key" [name]="s.key" [(ngModel)]="values[s.key]" />
                    }
                    @if (s.value.help) { <p class="form-hint">{{ s.value.help }}</p> }
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>

      <div class="pform-footer">
        <div class="pform-footer__meta">Las imágenes se guardan al elegirlas; el resto, con el botón.</div>
        <div class="pform-footer__actions">
          <button type="submit" class="btn btn-accent" [disabled]="saving()"><i class="bi bi-check-lg"></i> {{ saving() ? 'Guardando…' : 'Guardar configuración' }}</button>
        </div>
      </div>
    </form>
  `,
  styles: [`
    .img-setting { display: flex; gap: 14px; align-items: flex-start; }
    .img-setting img, .img-empty { width: 128px; height: 86px; object-fit: cover; border: 1px solid var(--a-line); flex-shrink: 0; }
    .img-empty { display: grid; place-items: center; background: #F3F2EF; color: #B4B4B4; font-size: 24px; }
  `],
})
export class SettingsComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);
  private site = inject(SiteService);

  groups = signal<SettingGroup[]>([]);
  saving = signal(false);
  values: Record<string, string> = {};

  /** keyvalue ordena alfabéticamente por defecto: esto conserva el orden del backend. */
  keepOrder = () => 0;

  ngOnInit(): void {
    this.api.get<{ groups: SettingGroup[]; values: Record<string, string> }>('ajustes').subscribe((res) => {
      this.groups.set(res.groups);
      this.values = { ...res.values };
    });
  }

  save(): void {
    this.saving.set(true);
    const settings: Record<string, string> = {};
    this.groups().forEach((g) => Object.entries(g.settings).forEach(([key, def]) => {
      if (def.type !== 'image') settings[key] = this.values[key] ?? '';
    }));
    this.api.put('ajustes', { settings }).subscribe({
      next: () => {
        this.saving.set(false);
        this.site.settings.update((all) => ({ ...all, ...settings }));
        this.ui.success('Configuración guardada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.ui.apiError(e);
      },
    });
  }

  uploadImage(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.api.upload<{ value: string }>(`ajustes/imagen/${key}`, { image: file }).subscribe({
      next: (res) => {
        this.values[key] = res.value;
        this.site.settings.update((all) => ({ ...all, [key]: res.value }));
        input.value = '';
        this.ui.success('Imagen actualizada.');
      },
      error: (e) => this.ui.apiError(e, 'No se pudo subir la imagen.'),
    });
  }

  removeImage(key: string): void {
    this.api.upload<{ value: string }>(`ajustes/imagen/${key}`, { remove: true }).subscribe({
      next: () => {
        this.values[key] = '';
        this.site.settings.update((all) => ({ ...all, [key]: '' }));
        this.ui.success('Imagen quitada.');
      },
      error: (e) => this.ui.apiError(e),
    });
  }
}
