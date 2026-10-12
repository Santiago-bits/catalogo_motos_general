import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models/product.model';
import { SiteService } from '../core/services/site.service';
import { MotoIconComponent } from './moto-icon.component';
import { PricePipe } from './price.pipe';

interface CardSpec {
  label: string;
  value: string;
}

const TYPE_LABEL: Record<string, string> = { moto: 'Moto', casco: 'Casco', repuesto: 'Repuesto' };
export const AVAILABILITY: Record<string, string> = {
  disponible: 'En stock',
  reservado: 'Reservado',
  vendido: 'Vendido',
  consultar: 'Consultar',
};

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, MotoIconComponent, PricePipe],
  template: `
    <article class="card">
      <a class="card__photo" [routerLink]="link()" [attr.aria-label]="product.name" tabindex="-1">
        @if (imageUrl(); as src) {
          <img [src]="src" [alt]="product.name" loading="lazy" />
        } @else {
          <app-moto-icon />
          <span class="card__photo-tag">[FOTO]</span>
        }
        @if (badge(); as b) {
          <span class="card__badge" [class.card__badge--dark]="b.dark">{{ b.label }}</span>
        }
      </a>
      <div class="card__body">
        <span class="card__eyebrow">{{ product.category?.name || typeLabel() }}</span>
        <h3 class="card__title"><a [routerLink]="link()">{{ product.name }}</a></h3>
        @if (product.price.visible) {
          <span class="card__price">
            {{ product.price | price }}
            @if (product.price.is_offer && product.price.offer) {
              <s class="card__price-old">{{ product.price.final | price: product.price.currency }}</s>
            }
          </span>
        } @else {
          <span class="card__price card__price--consult">Consultar precio</span>
        }
        <dl class="card__specs">
          @for (spec of specs(); track spec.label) {
            <div><dt>{{ spec.label }}</dt><dd>{{ spec.value }}</dd></div>
          }
        </dl>
        <div class="card__actions">
          <a [routerLink]="link()" class="r-btn r-btn--red r-btn--sm">Ver más</a>
          @if (whatsapp(); as wa) {
            <a [href]="wa" target="_blank" rel="noopener" class="r-btn r-btn--outline r-btn--sm">Consultar</a>
          } @else {
            <a [routerLink]="link()" fragment="consultar" class="r-btn r-btn--outline r-btn--sm">Consultar</a>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .card { background: var(--r-white); display: flex; flex-direction: column; border: 1px solid var(--r-line); height: 100%; }
    .card__photo { position: relative; aspect-ratio: 16 / 10; background: var(--r-photo); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    /* Foto completa (sin recortar ruedas ni manubrio) sobre fondo blanco. */
    .card__photo img { width: 100%; height: 100%; object-fit: contain; padding: 10px; background: #FFFFFF; display: block; transition: transform .3s; }
    .card:hover .card__photo img { transform: scale(1.03); }
    .card__photo-tag { position: absolute; bottom: 12px; right: 14px; font-size: 12px; letter-spacing: 0.14em; color: var(--r-muted); }
    .card__badge { position: absolute; top: 14px; left: 14px; font-family: var(--r-display); font-weight: 700; font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; color: #FFFFFF; background: var(--r-red); }
    .card__badge--dark { background: var(--r-ink); }
    .card__body { padding: 24px; display: flex; flex-direction: column; gap: 14px; flex-grow: 1; text-align: center; }
    .card__eyebrow { font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--r-muted); }
    .card__title { margin: 0; font-family: var(--r-display); font-weight: 700; font-size: 30px; line-height: 1.05; text-transform: uppercase; }
    .card__title a { color: var(--r-ink); text-decoration: none; }
    .card__title a:hover { color: var(--r-red); }
    .card__price { font-family: var(--r-display); font-weight: 800; font-size: 30px; color: var(--r-red); display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 4px 12px; }
    .card__price-old { font-size: 18px; font-weight: 600; color: var(--r-muted); }
    .card__price--consult { font-size: 24px; color: var(--r-ink); }
    .card__specs { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; border-top: 1px solid var(--r-line); padding-top: 14px; }
    .card__specs dt { font-size: 12px; color: var(--r-muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .card__specs dd { margin: 4px 0 0; font-weight: 600; overflow-wrap: anywhere; }
    .card__actions { display: flex; gap: 10px; margin-top: auto; padding-top: 6px; }
    .card__actions .r-btn { flex: 1 1 auto; }
  `],
})
export class ProductCardComponent {
  private site = inject(SiteService);

  /** "Consultar" abre WhatsApp con la moto ya nombrada. */
  whatsapp(): string {
    return this.site.whatsappLink(`Hola, quiero consultar por ${this.product.name} (código ${this.product.code}).`);
  }

  @Input({ required: true }) product!: Product;

  link(): unknown[] {
    return ['/', this.product.type + 's', this.product.slug];
  }

  typeLabel(): string {
    return TYPE_LABEL[this.product.type] ?? '';
  }

  imageUrl(): string | null {
    const main = this.product.images?.find((img) => img.is_main) ?? this.product.images?.[0];
    return main ? main.thumb_path ?? main.path : null;
  }

  badge(): { label: string; dark: boolean } | null {
    const moto = this.product.moto as { condition_type?: string } | undefined;
    if (this.product.type === 'moto' && moto?.condition_type) {
      return moto.condition_type === 'nueva' ? { label: '0 km', dark: false } : { label: 'Usada', dark: true };
    }
    if (this.product.price.is_offer) return { label: 'Oferta', dark: false };
    if (this.product.is_new) return { label: 'Nuevo', dark: false };
    return null;
  }

  specs(): CardSpec[] {
    const p = this.product;
    const moto = p.moto as { year?: number; km?: number | null; color?: string | null; displacement_cc?: number | null } | undefined;

    if (p.type === 'moto' && moto) {
      return [
        { label: 'Año', value: moto.year ? String(moto.year) : '—' },
        { label: 'Km', value: moto.km !== null && moto.km !== undefined ? new Intl.NumberFormat('es-AR').format(moto.km) : '—' },
        moto.color
          ? { label: 'Color', value: moto.color }
          : { label: 'Motor', value: moto.displacement_cc ? `${moto.displacement_cc} cc` : '—' },
      ];
    }

    return [
      { label: 'Marca', value: p.brand?.name ?? '—' },
      { label: 'Código', value: p.code },
      { label: 'Stock', value: AVAILABILITY[p.availability] ?? p.availability },
    ];
  }
}
