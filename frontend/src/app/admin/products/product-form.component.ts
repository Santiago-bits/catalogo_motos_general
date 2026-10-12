import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, AdminBrand, AdminCategory, AdminFeature, AdminTag, ProductType } from '../core/admin-api.service';
import { AuthService } from '../core/auth.service';
import { AVAILABILITY, CatalogSection, SECTIONS, date, money, publicUrl } from '../core/labels';
import { UiService } from '../core/ui.service';
import { StockMoveModalComponent, StockMoveType, StockTarget } from '../stock/stock-move-modal.component';

type Tab = 'general' | 'precio' | 'ficha' | 'fotos' | 'docs';

interface Field {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  suffix?: string;
  placeholder?: string;
}

const opts = (values: string[], labels?: string[]) => values.map((v, i) => ({ value: v, label: labels?.[i] ?? v.charAt(0).toUpperCase() + v.slice(1) }));

/** Ficha técnica por tipo, agrupada en tarjetas como en el formulario de SH. */
const SPEC_GROUPS: Record<ProductType, { title: string; fields: Field[] }[]> = {
  moto: [
    { title: 'Estado de la moto', fields: [
      { key: 'condition_type', label: 'Condición', kind: 'select', options: opts(['nueva', 'usada', 'reacondicionada'], ['0 km', 'Usada', 'Reacondicionada']) },
      { key: 'year', label: 'Año', kind: 'number', placeholder: 'Ej.: 2026' },
      { key: 'km', label: 'Kilómetros', kind: 'number', suffix: 'km' },
      { key: 'color', label: 'Color' },
      { key: 'warranty', label: 'Garantía', placeholder: 'Ej.: 2 años de fábrica' },
    ] },
    { title: 'Motor y transmisión', fields: [
      { key: 'displacement_cc', label: 'Cilindrada', kind: 'number', suffix: 'cc' },
      { key: 'cylinders', label: 'Cilindros', kind: 'number' },
      { key: 'power_hp', label: 'Potencia', kind: 'number', suffix: 'HP' },
      { key: 'torque_nm', label: 'Torque', kind: 'number', suffix: 'Nm' },
      { key: 'transmission', label: 'Transmisión', kind: 'select', options: opts(['manual', 'automatica', 'semiautomatica'], ['Manual', 'Automática', 'Semiautomática']) },
      { key: 'cooling', label: 'Refrigeración', kind: 'select', options: opts(['aire', 'liquido', 'aceite'], ['Aire', 'Líquido', 'Aceite']) },
      { key: 'starter', label: 'Arranque', kind: 'select', options: opts(['electrico', 'pedal', 'ambos'], ['Eléctrico', 'Pedal', 'Ambos']) },
      { key: 'fuel_type', label: 'Combustible', kind: 'select', options: opts(['nafta', 'electrico', 'hibrido'], ['Nafta', 'Eléctrico', 'Híbrido']) },
    ] },
    { title: 'Chasis y dimensiones', fields: [
      { key: 'brakes_front', label: 'Freno delantero', placeholder: 'Ej.: Disco 276 mm ABS' },
      { key: 'brakes_rear', label: 'Freno trasero' },
      { key: 'suspension_front', label: 'Suspensión delantera' },
      { key: 'suspension_rear', label: 'Suspensión trasera' },
      { key: 'fuel_capacity_l', label: 'Tanque', kind: 'number', suffix: 'L' },
      { key: 'weight_kg', label: 'Peso', kind: 'number', suffix: 'kg' },
      { key: 'seat_height_mm', label: 'Altura de asiento', kind: 'number', suffix: 'mm' },
    ] },
  ],
  casco: [
    { title: 'Características del casco', fields: [
      { key: 'helmet_type', label: 'Tipo', kind: 'select', options: opts(['integral', 'abierto', 'modular', 'cross', 'infantil']) },
      { key: 'size', label: 'Talle', kind: 'select', options: opts(['XS', 'S', 'M', 'L', 'XL', 'XXL']) },
      { key: 'certification', label: 'Homologación', placeholder: 'Ej.: ECE 22.06' },
      { key: 'visor_type', label: 'Visor' },
      { key: 'material', label: 'Material' },
      { key: 'color', label: 'Color' },
      { key: 'weight_grams', label: 'Peso', kind: 'number', suffix: 'g' },
      { key: 'warranty', label: 'Garantía' },
    ] },
  ],
  repuesto: [
    { title: 'Datos del repuesto', fields: [
      { key: 'manufacturer', label: 'Fabricante' },
      { key: 'oem_code', label: 'Código OEM' },
      { key: 'manufacturer_code', label: 'Código del fabricante' },
      { key: 'origin', label: 'Origen', kind: 'select', options: opts(['original', 'alternativo', 'remanufacturado']) },
      { key: 'unit', label: 'Unidad de venta', placeholder: 'Ej.: unidad, juego, kit' },
      { key: 'weight_kg', label: 'Peso', kind: 'number', suffix: 'kg' },
    ] },
  ],
};

const DOC_KINDS = [
  { value: 'ficha', label: 'Ficha técnica' },
  { value: 'manual', label: 'Manual' },
  { value: 'garantia', label: 'Garantía' },
  { value: 'folleto', label: 'Folleto' },
  { value: 'otro', label: 'Otro' },
];

const CODE_TYPES = [
  { value: 'oem', label: 'OEM' },
  { value: 'fabricante', label: 'Fabricante' },
  { value: 'alternativo', label: 'Alternativo' },
  { value: 'cruzado', label: 'Cruzado' },
  { value: 'interno', label: 'Interno' },
];

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink, StockMoveModalComponent],
  template: `
    <form (ngSubmit)="save()" #f="ngForm" novalidate>
      <!-- ================= ENCABEZADO ================= -->
      <header class="pform-header">
        <nav class="breadcrumbs">
          <a [routerLink]="['/admin', section.key]">{{ section.title }}</a><span>{{ isEdit() ? 'Editar' : 'Nueva' }}</span>
        </nav>
        <div class="pform-header__row">
          <h1 class="pform-title">{{ isEdit() ? form.name || 'Sin nombre' : 'Nueva ' + section.singular }}</h1>
          @if (isEdit()) {
            <span class="pform-code">{{ form.code }}</span>
            <span class="chip" [class]="'chip--' + (availability[form.availability]?.chip ?? 'neutral')">{{ availability[form.availability]?.label }}</span>
            @if (!form.active) { <span class="chip chip--neutral">Sin publicar</span> }
          }
        </div>
      </header>

      @if (!canEdit()) {
        <div class="alert alert--info"><span><i class="bi bi-eye"></i> Tu rol sólo puede ver esta ficha: los cambios no se guardan.</span></div>
      }

      <!-- ================= PESTAÑAS ================= -->
      <nav class="form-tabs" role="tablist" aria-label="Secciones del producto">
        <button type="button" class="form-tab" role="tab" [attr.aria-selected]="tab() === 'general'" (click)="tab.set('general')">General</button>
        <button type="button" class="form-tab" role="tab" [attr.aria-selected]="tab() === 'precio'" (click)="tab.set('precio')">Precio</button>
        <button type="button" class="form-tab" role="tab" [attr.aria-selected]="tab() === 'ficha'" (click)="tab.set('ficha')">Ficha técnica</button>
        <button type="button" class="form-tab" role="tab" [attr.aria-selected]="tab() === 'fotos'" (click)="tab.set('fotos')">Fotos y video <span class="badge-dot">{{ images().length + videos().length }}</span></button>
        <button type="button" class="form-tab" role="tab" [attr.aria-selected]="tab() === 'docs'" (click)="tab.set('docs')">Documentos <span class="badge-dot">{{ documents().length }}</span></button>
      </nav>

      <div class="pform-body">
        <div class="pform-main">

          <!-- ========== GENERAL ========== -->
          @if (tab() === 'general') {
            <div class="pform-card">
              <h2 class="pform-card__title">Identificación</h2>
              <div class="form-grid">
                <div>
                  <label class="form-label" for="code">Código interno</label>
                  <input class="form-control mono" id="code" name="code" [(ngModel)]="form.code" maxlength="60" [class.is-invalid]="errors()['code']" [placeholder]="isEdit() ? '' : 'Automático'" />
                  @if (errors()['code']) { <p class="form-error">{{ errors()['code'] }}</p> } @else if (!isEdit()) { <p class="form-hint">Si lo dejás vacío se asigna el siguiente.</p> }
                </div>
                <div class="span-2">
                  <label class="form-label" for="name">Nombre público *</label>
                  <input class="form-control" id="name" name="name" [(ngModel)]="form.name" maxlength="200" required [class.is-invalid]="errors()['name']" />
                  @if (errors()['name']) { <p class="form-error">{{ errors()['name'] }}</p> }
                </div>
                <div>
                  <label class="form-label" for="category_id">Categoría</label>
                  <select class="form-select" id="category_id" name="category_id" [(ngModel)]="form.category_id">
                    <option [ngValue]="null">Sin categoría</option>
                    @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.parent ? c.parent.name + ' › ' : '' }}{{ c.name }}</option> }
                  </select>
                </div>
                <div>
                  <label class="form-label" for="brand_id">Marca</label>
                  <select class="form-select" id="brand_id" name="brand_id" [(ngModel)]="form.brand_id">
                    <option [ngValue]="null">Sin marca</option>
                    @for (b of brands(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
                  </select>
                </div>
                @if (type === 'moto') {
                  <div>
                    <label class="form-label" for="model">Modelo</label>
                    <input class="form-control" id="model" name="model" [(ngModel)]="detail['model']" maxlength="120" placeholder="Ej.: CB 250 Twister" />
                  </div>
                }
              </div>
            </div>

            <div class="pform-card">
              <h2 class="pform-card__title">Descripción</h2>
              <label class="form-label" for="short_description">Resumen — se ve en el listado</label>
              <input class="form-control" id="short_description" name="short_description" [(ngModel)]="form.short_description" maxlength="255" />
              <p class="form-hint">{{ (form.short_description ?? '').length }}/255</p>
              <label class="form-label" for="description" style="margin-top:14px">Descripción completa</label>
              <textarea class="form-control" id="description" name="description" rows="7" [(ngModel)]="form.description"></textarea>
            </div>

            <div class="pform-card">
              <h2 class="pform-card__title">Buscadores (SEO) <span class="muted small" style="text-transform:none;letter-spacing:0;font-family:var(--r-body);font-weight:400">Opcional</span></h2>
              <div class="form-grid">
                <div class="span-all">
                  <label class="form-label" for="meta_title">Título para Google</label>
                  <input class="form-control" id="meta_title" name="meta_title" [(ngModel)]="form.meta_title" maxlength="160" [placeholder]="form.name" />
                </div>
                <div class="span-all">
                  <label class="form-label" for="meta_description">Descripción para Google</label>
                  <input class="form-control" id="meta_description" name="meta_description" [(ngModel)]="form.meta_description" maxlength="255" [placeholder]="form.short_description || ''" />
                </div>
              </div>
            </div>
          }

          <!-- ========== PRECIO ========== -->
          @if (tab() === 'precio') {
            <div class="pform-card">
              <h2 class="pform-card__title">Precio</h2>
              <div class="form-grid">
                <div>
                  <label class="form-label" for="currency">Moneda</label>
                  <select class="form-select" id="currency" name="currency" [(ngModel)]="form.currency">
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                <div>
                  <label class="form-label" for="cost_price">Costo</label>
                  <input class="form-control" type="number" min="0" step="0.01" id="cost_price" name="cost_price" [(ngModel)]="form.cost_price" (ngModelChange)="recalc()" />
                </div>
                <div>
                  <label class="form-label" for="profit_percent">Ganancia (%)</label>
                  <input class="form-control" type="number" min="0" step="0.1" id="profit_percent" name="profit_percent" [(ngModel)]="form.profit_percent" (ngModelChange)="recalc()" />
                </div>
                <div>
                  <label class="form-label" for="final_price">Precio final *</label>
                  <input class="form-control" type="number" min="0" step="0.01" id="final_price" name="final_price" [(ngModel)]="form.final_price" required [class.is-invalid]="errors()['final_price']" />
                  <p class="form-hint">{{ money(form.final_price, form.currency) }}</p>
                </div>
              </div>
              <p class="form-hint">Si cargás costo y ganancia, el precio final se calcula solo. Podés pisarlo a mano.</p>
            </div>

            <div class="pform-card">
              <h2 class="pform-card__title">Oferta y visibilidad del precio</h2>
              <div class="form-switch-row">
                <div><strong>Oferta activa</strong><small>Muestra el precio de lista tachado</small></div>
                <label class="switch"><input type="checkbox" name="is_offer" [(ngModel)]="form.is_offer" /><span></span></label>
              </div>
              @if (form.is_offer) {
                <div style="max-width:280px;padding-bottom:12px">
                  <label class="form-label" for="offer_price">Precio de oferta</label>
                  <input class="form-control" type="number" min="0" step="0.01" id="offer_price" name="offer_price" [(ngModel)]="form.offer_price" />
                </div>
              }
              <div class="form-switch-row">
                <div><strong>Mostrar precio al público</strong><small>Si está apagado dice “Consultar precio”</small></div>
                <label class="switch"><input type="checkbox" name="price_visible" [(ngModel)]="form.price_visible" /><span></span></label>
              </div>
            </div>

            @if (priceHistory().length) {
              <div class="pform-card">
                <h2 class="pform-card__title">Historial de precios</h2>
                <table class="table-admin">
                  <thead><tr><th>Fecha</th><th class="num">Antes</th><th class="num">Ahora</th></tr></thead>
                  <tbody>
                    @for (h of priceHistory(); track h.id) {
                      <tr><td>{{ date(h.created_at ?? h.changed_at, true) }}</td><td class="num muted">{{ h.old_price !== null ? money(h.old_price, h.currency) : '—' }}</td><td class="num"><strong>{{ money(h.new_price, h.currency) }}</strong></td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }

          <!-- ========== FICHA TÉCNICA ========== -->
          @if (tab() === 'ficha') {
            @for (group of specGroups(); track group.title) {
              <div class="pform-card">
                <h2 class="pform-card__title">{{ group.title }}</h2>
                <div class="form-grid">
                  @for (field of group.fields; track field.key) {
                    <div>
                      <label class="form-label" [for]="'d-' + field.key">{{ field.label }}</label>
                      @if (field.kind === 'select') {
                        <select class="form-select" [id]="'d-' + field.key" [name]="'d-' + field.key" [(ngModel)]="detail[field.key]">
                          <option [ngValue]="null">—</option>
                          @for (o of field.options; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                        </select>
                      } @else if (field.suffix) {
                        <div class="input-group">
                          <input class="form-control" [type]="field.kind === 'number' ? 'number' : 'text'" [id]="'d-' + field.key" [name]="'d-' + field.key" [(ngModel)]="detail[field.key]" [placeholder]="field.placeholder ?? ''" />
                          <span class="input-group__addon">{{ field.suffix }}</span>
                        </div>
                      } @else {
                        <input class="form-control" [type]="field.kind === 'number' ? 'number' : 'text'" [id]="'d-' + field.key" [name]="'d-' + field.key" [(ngModel)]="detail[field.key]" [placeholder]="field.placeholder ?? ''" />
                      }
                    </div>
                  }
                  @if (type === 'casco') {
                    <div style="display:flex;align-items:flex-end;padding-bottom:10px">
                      <label class="filter-check"><input type="checkbox" name="d-bluetooth" [(ngModel)]="detail['has_bluetooth']" /> Trae Bluetooth / intercomunicador</label>
                    </div>
                  }
                </div>
              </div>
            }

            @if (features().length) {
              <div class="pform-card">
                <h2 class="pform-card__title">Características adicionales <a routerLink="/admin/caracteristicas" class="small" style="font-family:var(--r-body);text-transform:none;letter-spacing:0;font-weight:500">Administrar</a></h2>
                <div class="form-grid">
                  @for (feature of features(); track feature.id) {
                    <div>
                      <label class="form-label" [for]="'s-' + feature.id">{{ feature.name }}</label>
                      <div class="input-group">
                        <input class="form-control" [type]="feature.value_type === 'number' ? 'number' : 'text'" [id]="'s-' + feature.id" [name]="'s-' + feature.id" [(ngModel)]="specs[feature.id]" />
                        @if (feature.unit) { <span class="input-group__addon">{{ feature.unit }}</span> }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            @if (type === 'repuesto') {
              <div class="pform-card">
                <h2 class="pform-card__title">Códigos alternativos</h2>
                @if (!isEdit()) {
                  <p class="muted">Guardá el repuesto para poder cargar códigos alternativos.</p>
                } @else {
                  <div class="list-rows">
                    @for (c of codes(); track c.id) {
                      <div>
                        <span class="chip chip--neutral">{{ codeTypeLabel(c.code_type) }}</span>
                        <strong class="mono">{{ c.code }}</strong>
                        <span class="muted small">{{ c.brand?.name }}{{ c.note ? ' · ' + c.note : '' }}</span>
                        @if (canEdit()) { <button type="button" class="btn-icon btn-icon--danger ml-auto" (click)="removeCode(c)" title="Quitar"><i class="bi bi-trash"></i></button> }
                      </div>
                    } @empty { <div class="muted small">Sin códigos alternativos.</div> }
                  </div>
                  @if (canEdit()) {
                    <div class="form-grid" style="margin-top:14px">
                      <select class="form-select" name="nc-type" [(ngModel)]="newCode.code_type">
                        @for (t of codeTypes; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
                      </select>
                      <input class="form-control mono" name="nc-code" [(ngModel)]="newCode.code" placeholder="Código" />
                      <select class="form-select" name="nc-brand" [(ngModel)]="newCode.brand_id">
                        <option [ngValue]="null">Marca (opcional)</option>
                        @for (b of brands(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
                      </select>
                      <button type="button" class="btn btn-dark" (click)="addCode()" [disabled]="!newCode.code"><i class="bi bi-plus-lg"></i> Agregar código</button>
                    </div>
                  }
                }
              </div>

              <div class="pform-card">
                <h2 class="pform-card__title">Motos compatibles</h2>
                @if (!isEdit()) {
                  <p class="muted">Guardá el repuesto para poder cargar la compatibilidad.</p>
                } @else {
                  <div class="list-rows">
                    @for (c of compatibilities(); track c.id) {
                      <div>
                        <i class="bi bi-check2-circle" style="color:var(--a-ok)"></i>
                        <strong>{{ c.brand?.name }} {{ c.model }}</strong>
                        <span class="muted small">{{ years(c) }}{{ c.note ? ' · ' + c.note : '' }}</span>
                        @if (canEdit()) { <button type="button" class="btn-icon btn-icon--danger ml-auto" (click)="removeCompat(c)" title="Quitar"><i class="bi bi-trash"></i></button> }
                      </div>
                    } @empty { <div class="muted small">Todavía no cargaste modelos compatibles.</div> }
                  </div>
                  @if (canEdit()) {
                    <div class="form-grid" style="margin-top:14px">
                      <select class="form-select" name="cp-brand" [(ngModel)]="newCompat.brand_id">
                        <option [ngValue]="null">Marca</option>
                        @for (b of brands(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
                      </select>
                      <input class="form-control" name="cp-model" [(ngModel)]="newCompat.model" placeholder="Modelo *" />
                      <input class="form-control" type="number" name="cp-from" [(ngModel)]="newCompat.year_from" placeholder="Desde (año)" />
                      <input class="form-control" type="number" name="cp-to" [(ngModel)]="newCompat.year_to" placeholder="Hasta (año)" />
                      <button type="button" class="btn btn-dark" (click)="addCompat()" [disabled]="!newCompat.model"><i class="bi bi-plus-lg"></i> Agregar</button>
                    </div>
                  }
                }
              </div>
            }
          }

          <!-- ========== FOTOS Y VIDEO ========== -->
          @if (tab() === 'fotos') {
            <div class="pform-card">
              <h2 class="pform-card__title">Fotos <span class="muted small" style="font-family:var(--r-body);text-transform:none;letter-spacing:0;font-weight:400">La marcada como principal es la que se ve en el listado</span></h2>
              @if (!isEdit()) {
                <p class="muted">Guardá el producto primero; después vas a poder subir las fotos acá.</p>
              } @else {
                @if (canEdit()) {
                  <label class="dropzone" [class.is-over]="dragOver()" (dragover)="$event.preventDefault(); dragOver.set(true)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
                    <i class="bi bi-cloud-arrow-up"></i>
                    <strong>{{ uploading() ? 'Subiendo ' + uploading() + ' foto(s)…' : 'Arrastrá las fotos acá o hacé clic para elegirlas' }}</strong>
                    <span class="small">JPG, PNG o WEBP · hasta 5 MB cada una · podés elegir varias</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden (change)="onFiles($event)" />
                  </label>
                }
                @if (images().length) {
                  <div class="gallery" style="margin-top:16px">
                    @for (img of images(); track img.id) {
                      <div class="gallery__item" [class.is-main]="img.is_main">
                        <img [src]="img.thumb_path ?? img.path" [alt]="form.name" />
                        @if (img.is_main) { <span class="chip chip--accent gallery__badge">Principal</span> }
                        @if (canEdit()) {
                          <div class="gallery__actions">
                            <button type="button" class="btn-icon" [disabled]="img.is_main" (click)="setMain(img)" title="Usar como principal"><i class="bi" [class.bi-star-fill]="img.is_main" [class.bi-star]="!img.is_main"></i></button>
                            <button type="button" class="btn-icon btn-icon--danger" (click)="removeImage(img)" title="Eliminar foto"><i class="bi bi-trash"></i></button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p class="muted" style="margin-top:12px">Todavía no hay fotos.</p>
                }
              }
            </div>

            <div class="pform-card">
              <h2 class="pform-card__title">Video</h2>
              @if (!isEdit()) {
                <p class="muted">Guardá el producto primero para agregar videos.</p>
              } @else {
                <div class="list-rows">
                  @for (v of videos(); track v.id) {
                    <div>
                      <i class="bi" [class.bi-youtube]="!v.is_file" [class.bi-camera-video]="v.is_file" style="color:var(--a-red);font-size:20px"></i>
                      <a [href]="v.url" target="_blank" rel="noopener" class="small" style="word-break:break-all">{{ v.title || v.url }}</a>
                      @if (canEdit()) { <button type="button" class="btn-icon btn-icon--danger ml-auto" (click)="removeVideo(v)" title="Quitar"><i class="bi bi-trash"></i></button> }
                    </div>
                  } @empty { <div class="muted small">Sin videos.</div> }
                </div>
                @if (canEdit()) {
                  <div class="form-grid" style="margin-top:14px">
                    <div class="span-2">
                      <label class="form-label" for="video-url">Enlace de YouTube o Vimeo</label>
                      <input class="form-control" id="video-url" name="video-url" [(ngModel)]="newVideoUrl" placeholder="https://www.youtube.com/watch?v=…" />
                    </div>
                    <div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-dark btn-block" (click)="addVideoUrl()" [disabled]="!newVideoUrl"><i class="bi bi-link-45deg"></i> Agregar enlace</button></div>
                  </div>
                  <label class="form-label" for="video-file" style="margin-top:14px">O subí un video desde tu compu (MP4/WEBM, hasta 100 MB)</label>
                  <input class="form-control" type="file" id="video-file" accept="video/mp4,video/webm,video/quicktime" (change)="onVideoFile($event)" />
                }
              }
            </div>
          }

          <!-- ========== DOCUMENTOS ========== -->
          @if (tab() === 'docs') {
            <div class="pform-card">
              <h2 class="pform-card__title">Documentación</h2>
              @if (!isEdit()) {
                <p class="muted">Guardá el producto primero para adjuntar documentos.</p>
              } @else {
                <div class="list-rows">
                  @for (d of documents(); track d.id) {
                    <div>
                      <i class="bi bi-file-earmark-pdf" style="color:var(--a-red);font-size:22px"></i>
                      <span>
                        <a [href]="d.url" target="_blank" rel="noopener"><strong>{{ d.title }}</strong></a>
                        <span class="muted small" style="display:block">{{ docKindLabel(d.kind) }} · {{ size(d.size) }} · {{ d.is_public ? 'Visible en el sitio' : 'Sólo interno' }}</span>
                      </span>
                      @if (canEdit()) { <button type="button" class="btn-icon btn-icon--danger ml-auto" (click)="removeDocument(d)" title="Quitar"><i class="bi bi-trash"></i></button> }
                    </div>
                  } @empty { <div class="muted small">Sin documentos adjuntos.</div> }
                </div>
                @if (canEdit()) {
                  <h3 class="form-section__title">Adjuntar documento</h3>
                  <div class="form-grid">
                    <div>
                      <label class="form-label" for="doc-title">Título</label>
                      <input class="form-control" id="doc-title" name="doc-title" [(ngModel)]="newDoc.title" placeholder="Ej.: Ficha técnica oficial" />
                    </div>
                    <div>
                      <label class="form-label" for="doc-kind">Tipo</label>
                      <select class="form-select" id="doc-kind" name="doc-kind" [(ngModel)]="newDoc.kind">
                        @for (k of docKinds; track k.value) { <option [value]="k.value">{{ k.label }}</option> }
                      </select>
                    </div>
                    <div class="span-2">
                      <label class="form-label" for="doc-file">Archivo (PDF, Word, Excel o imagen · hasta 20 MB)</label>
                      <input class="form-control" type="file" id="doc-file" (change)="newDocFile = $any($event.target).files?.[0] ?? null" />
                    </div>
                  </div>
                  <div class="row-gap" style="margin-top:12px">
                    <label class="filter-check"><input type="checkbox" name="doc-public" [(ngModel)]="newDoc.is_public" /> Mostrar en la ficha pública del sitio</label>
                    <button type="button" class="btn btn-dark ml-auto" (click)="addDocument()" [disabled]="!newDocFile"><i class="bi bi-paperclip"></i> Adjuntar</button>
                  </div>
                }
              }
            </div>
          }
        </div>

        <!-- ================= BARRA LATERAL FIJA ================= -->
        <aside class="pform-side">
          <div class="pform-card">
            <h2 class="pform-card__title">Publicación</h2>
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px">
              <div>
                <label class="form-label" for="availability">Estado</label>
                <select class="form-select" id="availability" name="availability" [(ngModel)]="form.availability">
                  @for (s of availabilityKeys; track s) { <option [value]="s">{{ availability[s].label }}</option> }
                </select>
              </div>
              @if (type === 'moto') {
                <div>
                  <label class="form-label" for="location">Ubicación</label>
                  <input class="form-control" id="location" name="location" [(ngModel)]="detail['location']" maxlength="160" placeholder="Ej.: Showroom" />
                </div>
              }
            </div>
            <div class="form-switch-row">
              <div><strong>Publicada en el sitio</strong><small>Si está apagada no aparece en el catálogo</small></div>
              <label class="switch"><input type="checkbox" name="active" [(ngModel)]="form.active" /><span></span></label>
            </div>
            <div class="form-switch-row">
              <div><strong>Destacada</strong><small>Aparece en “Motos destacadas” del inicio</small></div>
              <label class="switch"><input type="checkbox" name="featured" [(ngModel)]="form.featured" /><span></span></label>
            </div>
            <div class="form-switch-row">
              <div><strong>Marcar como nuevo ingreso</strong><small>Muestra la etiqueta “Nuevo”</small></div>
              <label class="switch"><input type="checkbox" name="is_new" [(ngModel)]="form.is_new" /><span></span></label>
            </div>
          </div>

          @if (tags().length) {
            <div class="pform-card">
              <h2 class="pform-card__title">Etiquetas</h2>
              <div class="row-gap">
                @for (tag of tags(); track tag.id) {
                  <button type="button" class="tag-toggle" [class.is-on]="tagIds.includes(tag.id)" (click)="toggleTag(tag.id)" [attr.aria-pressed]="tagIds.includes(tag.id)">
                    <span class="tag" [class]="'tag--' + tag.color + (tagIds.includes(tag.id) ? ' is-solid' : '')">{{ tag.name }}</span>
                  </button>
                }
              </div>
              <p class="form-hint">Tocá para activar. Se administran desde <a routerLink="/admin/etiquetas">Etiquetas</a>.</p>
            </div>
          }

          @if (isEdit() && canSeeStock) {
            <div class="pform-card">
              <h2 class="pform-card__title">Stock
                <a routerLink="/admin/stock/movimientos" [queryParams]="{ producto: productId(), nombre: form.name }" class="small" style="font-family:var(--r-body);text-transform:none;letter-spacing:0;font-weight:500">Movimientos</a>
              </h2>
              <div class="stock-box">
                <strong class="stock-qty" [class.is-out]="stockQty() <= 0" [class.is-low]="stockQty() > 0 && stockMin() > 0 && stockQty() <= stockMin()">{{ stockQty() }}</strong>
                <span>
                  unidad(es)
                  <small class="muted" style="display:block">{{ stockQty() <= 0 ? 'Sin stock' : stockMin() > 0 && stockQty() <= stockMin() ? 'Stock bajo (mínimo ' + stockMin() + ')' : 'En stock' }}</small>
                </span>
              </div>
              @if (canManageStock) {
                <div class="stock-btns">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="openStock('ingreso')"><i class="bi bi-plus-lg"></i> Ingreso</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="openStock('egreso')" [disabled]="stockQty() <= 0"><i class="bi bi-dash-lg"></i> Egreso</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="openStock('ajuste')"><i class="bi bi-sliders"></i> Ajuste</button>
                </div>
              }
              <p class="form-hint" style="margin-bottom:0">El stock cambia sólo con movimientos, así queda registrado quién y por qué.</p>
            </div>
          }

          @if (isEdit() && stats()) {
            <div class="pform-card">
              <h2 class="pform-card__title">Actividad</h2>
              <div class="form-switch-row"><div><strong>{{ stats()!.views }}</strong><small>visitas a la ficha</small></div></div>
              <div class="form-switch-row"><div><strong>{{ date(stats()!.created_at) }}</strong><small>fecha de alta</small></div></div>
            </div>
          }
        </aside>
      </div>

      <!-- ================= PIE FIJO ================= -->
      <div class="pform-footer">
        <div class="pform-footer__meta">
          @if (isEdit() && updatedAt()) {
            Último guardado {{ date(updatedAt(), true) }}@if (updatedBy()) { por {{ updatedBy() }} }
          } @else if (!isEdit()) {
            {{ capitalize(section.singular) }} nueva — todavía sin guardar
          }
        </div>
        <div class="pform-footer__actions">
          <a [routerLink]="['/admin', section.key]" class="btn btn-ghost">Cancelar</a>
          @if (isEdit() && slug()) {
            <a [href]="publicUrl({ type: type, slug: slug()! })" target="_blank" rel="noopener" class="btn btn-outline-accent"><i class="bi bi-eye"></i> Ver en el sitio</a>
          }
          @if (canEdit()) {
            <button type="submit" class="btn btn-accent" [disabled]="saving()">
              <i class="bi bi-check-lg"></i> {{ saving() ? 'Guardando…' : isEdit() ? 'Guardar cambios' : 'Crear ' + section.singular }}
            </button>
          }
        </div>
      </div>
    </form>

    <app-stock-move-modal [product]="stockTarget()" [initialType]="stockMoveType" (closed)="stockTarget.set(null)" (saved)="onStockSaved($event)" />
  `,
  styles: [`
    .stock-box { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .stock-qty { font-family: var(--r-display); font-weight: 800; font-size: 44px; line-height: 1; }
    .stock-qty.is-out { color: var(--a-red); }
    .stock-qty.is-low { color: var(--a-warn); }
    .stock-btns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .stock-btns .btn { padding: 5px 6px; font-size: 13px; }
    .tag-toggle { background: none; border: 0; padding: 0; cursor: pointer; opacity: .45; transition: opacity .15s; }
    .tag-toggle.is-on { opacity: 1; }
    .tag-toggle:hover { opacity: .85; }
  `],
})
export class ProductFormComponent implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = inject(UiService);
  private auth = inject(AuthService);

  section!: CatalogSection;
  type: ProductType = 'moto';

  tab = signal<Tab>('general');
  productId = signal<number | null>(null);
  isEdit = computed(() => this.productId() !== null);
  canEdit = computed(() => (this.isEdit() ? this.auth.can('products.edit') : this.auth.can('products.create')));

  brands = signal<AdminBrand[]>([]);
  categories = signal<AdminCategory[]>([]);
  tags = signal<AdminTag[]>([]);
  features = signal<AdminFeature[]>([]);
  images = signal<any[]>([]);
  videos = signal<any[]>([]);
  documents = signal<any[]>([]);
  codes = signal<any[]>([]);
  compatibilities = signal<any[]>([]);
  priceHistory = signal<any[]>([]);
  stats = signal<{ views: number; created_at: string } | null>(null);
  updatedAt = signal<string | null>(null);
  updatedBy = signal<string | null>(null);
  slug = signal<string | null>(null);
  stockQty = signal(0);
  stockMin = signal(0);
  stockTarget = signal<StockTarget | null>(null);
  stockMoveType: StockMoveType = 'ingreso';
  canSeeStock = false;
  canManageStock = false;

  saving = signal(false);
  uploading = signal(0);
  dragOver = signal(false);
  errors = signal<Record<string, string>>({});

  form: any = this.emptyForm();
  detail: Record<string, any> = {};
  specs: Record<number, string | number | null> = {};
  tagIds: number[] = [];

  newVideoUrl = '';
  newDoc = { title: '', kind: 'ficha', is_public: true };
  newDocFile: File | null = null;
  newCode: { code_type: string; code: string; brand_id: number | null } = { code_type: 'oem', code: '', brand_id: null };
  newCompat: { brand_id: number | null; model: string; year_from: number | null; year_to: number | null } = { brand_id: null, model: '', year_from: null, year_to: null };

  availability = AVAILABILITY;
  availabilityKeys = Object.keys(AVAILABILITY);
  docKinds = DOC_KINDS;
  codeTypes = CODE_TYPES;
  money = money;
  date = date;
  publicUrl = publicUrl;

  private rawSpecs: { feature: string; value: string | number }[] = [];

  specGroups = () => SPEC_GROUPS[this.type];

  ngOnInit(): void {
    this.canSeeStock = this.auth.can('stock.view');
    this.canManageStock = this.auth.can('stock.manage');
    this.section = SECTIONS[this.route.snapshot.data['section'] as CatalogSection['key']];
    this.type = this.section.type;

    this.api.brands().subscribe((b) => this.brands.set(b));
    this.api.categories(this.type).subscribe((c) => this.categories.set(c));
    this.api.tags().subscribe((t) => this.tags.set(t));
    this.api.features().subscribe((f) => {
      this.features.set(f);
      this.applyRawSpecs();
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
      if (tab) this.tab.set(tab);

      if (id) {
        this.productId.set(Number(id));
        this.load(Number(id));
      } else {
        this.productId.set(null);
        this.form = this.emptyForm();
        this.detail = this.type === 'moto' ? { condition_type: this.section.condicion ?? 'nueva', km: this.section.condicion ? null : 0 } : {};
      }
    });
  }

  // ------------------------------------------------------------------
  // Carga y guardado
  // ------------------------------------------------------------------
  private load(id: number): void {
    this.api.get<any>(`productos/${id}`).subscribe({
      next: (res) => this.fill(res),
      error: (e) => {
        this.ui.apiError(e, 'No se encontró el producto.');
        this.router.navigate(['/admin', this.section.key]);
      },
    });
  }

  private fill(res: any): void {
    const p = res.data;
    this.type = p.type;
    this.form = {
      code: p.code,
      name: p.name,
      brand_id: p.brand?.id ?? null,
      category_id: p.category?.id ?? null,
      short_description: p.short_description ?? '',
      description: p.description ?? '',
      cost_price: p.cost_price,
      profit_percent: p.profit_percent,
      final_price: p.price.final,
      offer_price: p.price.offer,
      currency: p.price.currency,
      price_visible: p.price.visible,
      availability: p.availability,
      featured: p.featured,
      is_new: p.is_new,
      is_offer: p.price.is_offer,
      active: p.active,
      meta_title: p.meta_title ?? '',
      meta_description: p.meta_description ?? '',
    };
    const detail = { ...(p.moto ?? p.casco ?? p.repuesto ?? {}) };
    delete detail.product_id;
    this.detail = detail;
    this.images.set(p.images ?? []);
    this.videos.set(p.videos ?? []);
    this.documents.set(p.documents ?? []);
    this.tagIds = (p.tags ?? []).map((t: any) => t.id);
    this.rawSpecs = p.specs ?? [];
    this.applyRawSpecs();
    this.priceHistory.set(res.price_history ?? []);
    this.codes.set(res.codes ?? []);
    this.compatibilities.set(res.compatibilities ?? []);
    this.updatedAt.set(p.updated_at);
    this.updatedBy.set(p.updated_by_name ?? null);
    this.slug.set(p.slug);
    this.stats.set({ views: p.views, created_at: p.created_at });
    this.stockQty.set(p.stock_qty ?? 0);
    this.stockMin.set(p.stock_min ?? 0);
  }

  save(): void {
    if (!this.canEdit()) return;
    const errors: Record<string, string> = {};
    if (!this.form.name?.trim()) errors['name'] = 'Ingresá el nombre.';
    if (this.form.final_price === null || this.form.final_price === '' || this.form.final_price < 0) errors['final_price'] = 'Ingresá el precio (0 si es a consultar).';
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.tab.set(errors['name'] ? 'general' : 'precio');
      this.ui.error('Revisá los campos marcados.');
      return;
    }

    const payload = {
      ...this.form,
      code: this.form.code?.trim() || null,
      type: this.type,
      offer_price: this.form.is_offer ? this.form.offer_price : null,
      detail: this.cleanDetail(),
      tag_ids: this.tagIds,
      specs: this.specs,
    };

    this.saving.set(true);
    const id = this.productId();
    const request$ = id ? this.api.put<any>(`productos/${id}`, payload) : this.api.post<any>('productos', payload);

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (id) {
          this.fill(res);
          this.ui.success('Cambios guardados.');
          // Si cambió de 0 km a usada (o al revés), pasa a la otra sección.
          const target = this.sectionFor(res.data);
          if (target !== this.section.key) this.router.navigate(['/admin', target, id], { replaceUrl: true });
        } else {
          this.ui.success(`${this.capitalize(this.section.singular)} creada. Ahora podés subir las fotos.`);
          this.router.navigate(['/admin', this.sectionFor(res.data), res.data.id], { queryParams: { tab: 'fotos' } });
        }
      },
      error: (e) => {
        this.saving.set(false);
        const fieldErrors: Record<string, string> = {};
        Object.entries((e?.error?.errors ?? {}) as Record<string, string[]>).forEach(([k, v]) => (fieldErrors[k] = v[0]));
        this.errors.set(fieldErrors);
        this.ui.apiError(e, 'No se pudo guardar el producto. Revisá los datos.');
      },
    });
  }

  openStock(type: StockMoveType): void {
    this.stockMoveType = type;
    this.stockTarget.set({ id: this.productId()!, name: this.form.name, code: this.form.code, stock_qty: this.stockQty() });
  }

  /** El movimiento puede cambiar el estado (sin stock → Consultar): se refleja en la columna de Publicación. */
  onStockSaved(res: { stock_qty: number; availability: string }): void {
    this.stockTarget.set(null);
    this.stockQty.set(res.stock_qty);
    this.form.availability = res.availability;
  }

  recalc(): void {
    const cost = Number(this.form.cost_price);
    const pct = Number(this.form.profit_percent);
    if (cost > 0 && this.form.profit_percent !== null && this.form.profit_percent !== '' && pct >= 0) {
      this.form.final_price = Math.round(cost * (1 + pct / 100) * 100) / 100;
    }
  }

  toggleTag(id: number): void {
    this.tagIds = this.tagIds.includes(id) ? this.tagIds.filter((t) => t !== id) : [...this.tagIds, id];
  }

  // ------------------------------------------------------------------
  // Fotos
  // ------------------------------------------------------------------
  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadImages(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.uploadImages(Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/')));
  }

  private uploadImages(files: File[]): void {
    const id = this.productId();
    if (!id || files.length === 0) return;
    this.uploading.set(files.length);
    let pending = files.length;
    let failed = 0;
    const done = () => {
      pending--;
      this.uploading.set(pending);
      if (pending === 0) {
        this.refreshMedia();
        if (failed) this.ui.error(`${failed} foto(s) no se pudieron subir (¿más de 5 MB o formato no válido?).`);
        else this.ui.success(files.length === 1 ? 'Foto subida.' : `${files.length} fotos subidas.`);
      }
    };
    // De a una, para respetar el orden y no saturar el servidor.
    const next = (i: number) => {
      if (i >= files.length) return;
      this.api.upload(`productos/${id}/imagenes`, { image: files[i] }).subscribe({
        next: () => { done(); next(i + 1); },
        error: () => { failed++; done(); next(i + 1); },
      });
    };
    next(0);
  }

  setMain(img: any): void {
    this.api.post(`productos/${this.productId()}/imagenes/${img.id}/principal`).subscribe({
      next: () => this.images.update((list) => list.map((i) => ({ ...i, is_main: i.id === img.id }))),
      error: (e) => this.ui.apiError(e),
    });
  }

  async removeImage(img: any): Promise<void> {
    if (!(await this.ui.confirm('¿Eliminar esta foto?', { confirmLabel: 'Eliminar', danger: true }))) return;
    this.api.delete(`productos/${this.productId()}/imagenes/${img.id}`).subscribe({
      next: () => this.refreshMedia(),
      error: (e) => this.ui.apiError(e),
    });
  }

  // ------------------------------------------------------------------
  // Video
  // ------------------------------------------------------------------
  addVideoUrl(): void {
    this.api.upload(`productos/${this.productId()}/videos`, { url: this.newVideoUrl.trim() }).subscribe({
      next: (video) => {
        this.videos.update((list) => [...list, video]);
        this.newVideoUrl = '';
        this.ui.success('Video agregado.');
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  onVideoFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.ui.info('Subiendo el video…');
    this.api.upload(`productos/${this.productId()}/videos`, { file }).subscribe({
      next: (video) => {
        this.videos.update((list) => [...list, video]);
        this.ui.success('Video subido.');
        input.value = '';
      },
      error: (e) => {
        this.ui.apiError(e, 'No se pudo subir el video (¿supera el tamaño permitido por el servidor?).');
        input.value = '';
      },
    });
  }

  async removeVideo(video: any): Promise<void> {
    if (!(await this.ui.confirm('¿Quitar este video?', { confirmLabel: 'Quitar', danger: true }))) return;
    this.api.delete(`productos/${this.productId()}/videos/${video.id}`).subscribe({
      next: () => this.videos.update((list) => list.filter((v) => v.id !== video.id)),
      error: (e) => this.ui.apiError(e),
    });
  }

  // ------------------------------------------------------------------
  // Documentos
  // ------------------------------------------------------------------
  addDocument(): void {
    if (!this.newDocFile) return;
    this.api.upload(`productos/${this.productId()}/documentos`, { file: this.newDocFile, title: this.newDoc.title, kind: this.newDoc.kind, is_public: this.newDoc.is_public }).subscribe({
      next: (doc) => {
        this.documents.update((list) => [doc, ...list]);
        this.newDoc = { title: '', kind: 'ficha', is_public: true };
        this.newDocFile = null;
        (document.getElementById('doc-file') as HTMLInputElement | null)?.value && ((document.getElementById('doc-file') as HTMLInputElement).value = '');
        this.ui.success('Documento adjuntado.');
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  async removeDocument(doc: any): Promise<void> {
    if (!(await this.ui.confirm(`¿Quitar «${doc.title}»?`, { confirmLabel: 'Quitar', danger: true }))) return;
    this.api.delete(`productos/${this.productId()}/documentos/${doc.id}`).subscribe({
      next: () => this.documents.update((list) => list.filter((d) => d.id !== doc.id)),
      error: (e) => this.ui.apiError(e),
    });
  }

  // ------------------------------------------------------------------
  // Repuestos: códigos y compatibilidad
  // ------------------------------------------------------------------
  addCode(): void {
    this.api.post(`productos/${this.productId()}/codigos`, this.newCode).subscribe({
      next: (code) => {
        this.codes.update((list) => [...list, code]);
        this.newCode = { code_type: this.newCode.code_type, code: '', brand_id: null };
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  removeCode(code: any): void {
    this.api.delete(`productos/${this.productId()}/codigos/${code.id}`).subscribe({
      next: () => this.codes.update((list) => list.filter((c) => c.id !== code.id)),
      error: (e) => this.ui.apiError(e),
    });
  }

  addCompat(): void {
    this.api.post(`productos/${this.productId()}/compatibilidad`, this.newCompat).subscribe({
      next: (compat) => {
        this.compatibilities.update((list) => [...list, compat]);
        this.newCompat = { brand_id: this.newCompat.brand_id, model: '', year_from: null, year_to: null };
      },
      error: (e) => this.ui.apiError(e),
    });
  }

  removeCompat(compat: any): void {
    this.api.delete(`productos/${this.productId()}/compatibilidad/${compat.id}`).subscribe({
      next: () => this.compatibilities.update((list) => list.filter((c) => c.id !== compat.id)),
      error: (e) => this.ui.apiError(e),
    });
  }

  // ------------------------------------------------------------------
  // Auxiliares
  // ------------------------------------------------------------------
  codeTypeLabel(type: string): string {
    return CODE_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  docKindLabel(kind: string): string {
    return DOC_KINDS.find((k) => k.value === kind)?.label ?? kind;
  }

  years(c: any): string {
    if (c.year_from && c.year_to && c.year_from !== c.year_to) return `${c.year_from}–${c.year_to}`;
    return c.year_from ? String(c.year_from) : 'Todos los años';
  }

  size(bytes: number | null): string {
    if (!bytes) return '—';
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private refreshMedia(): void {
    this.api.get<any>(`productos/${this.productId()}`).subscribe((res) => this.images.set(res.data.images ?? []));
  }

  private sectionFor(p: any): CatalogSection['key'] {
    if (p.type === 'casco') return 'cascos';
    if (p.type === 'repuesto') return 'repuestos';
    return ['usada', 'reacondicionada'].includes(p.moto?.condition_type) ? 'usadas' : 'motos';
  }

  private cleanDetail(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    Object.entries(this.detail).forEach(([k, v]) => {
      if (['id', 'product_id', 'created_at', 'updated_at'].includes(k)) return;
      out[k] = v === '' ? null : v;
    });
    if (this.type === 'casco') out['has_bluetooth'] = !!this.detail['has_bluetooth'];
    return out;
  }

  private applyRawSpecs(): void {
    if (this.rawSpecs.length === 0 || this.features().length === 0) return;
    this.specs = {};
    this.rawSpecs.forEach((s) => {
      const feature = this.features().find((f) => f.name === s.feature);
      if (feature) this.specs[feature.id] = feature.value_type === 'number' ? Number(s.value) : s.value;
    });
  }

  private emptyForm(): any {
    return {
      code: '',
      name: '',
      brand_id: null,
      category_id: null,
      short_description: '',
      description: '',
      cost_price: null,
      profit_percent: null,
      final_price: 0,
      offer_price: null,
      currency: 'ARS',
      price_visible: true,
      availability: 'disponible',
      featured: false,
      is_new: false,
      is_offer: false,
      active: true,
      meta_title: '',
      meta_description: '',
    };
  }
}
