import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { CompareService } from '../../core/services/compare.service';
import { SiteService } from '../../core/services/site.service';
import { Product, ProductType } from '../../core/models/product.model';
import { MotoIconComponent } from '../../shared/moto-icon.component';
import { PricePipe } from '../../shared/price.pipe';
import { AVAILABILITY } from '../../shared/product-card.component';

/**
 * Enlace de YouTube o Vimeo → URL del reproductor incrustado.
 * Acepta watch?v=, youtu.be/, shorts/, embed/ y vimeo.com/ID. Devuelve null si no lo reconoce.
 */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;

    if (host === 'youtube.com' || host === 'music.youtube.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
    } else if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0] || null;
    }
    if (id && /^[\w-]{6,}$/.test(id)) {
      return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const vimeoId = u.pathname.match(/(\d{6,})/)?.[1];
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }
  } catch {
    /* URL inválida */
  }
  return null;
}

interface Row {
  label: string;
  value: string;
}

const SECTION: Record<ProductType, { label: string; path: string }> = {
  moto: { label: 'Motos', path: '/motos' },
  casco: { label: 'Cascos y accesorios', path: '/cascos' },
  repuesto: { label: 'Repuestos', path: '/repuestos' },
};

/** Campos técnicos de cada tipo que se muestran en la ficha, con su etiqueta y unidad. */
const FIELDS: Record<ProductType, [key: string, label: string, unit?: string][]> = {
  moto: [
    ['year', 'Año'], ['km', 'Kilómetros', 'km'], ['color', 'Color'], ['displacement_cc', 'Cilindrada', 'cc'],
    ['power_hp', 'Potencia', 'hp'], ['torque_nm', 'Torque', 'Nm'], ['cylinders', 'Cilindros'],
    ['transmission', 'Transmisión'], ['cooling', 'Refrigeración'], ['starter', 'Arranque'], ['fuel_type', 'Combustible'],
    ['fuel_capacity_l', 'Tanque', 'L'], ['weight_kg', 'Peso', 'kg'], ['seat_height_mm', 'Altura de asiento', 'mm'],
    ['brakes_front', 'Freno delantero'], ['brakes_rear', 'Freno trasero'],
    ['suspension_front', 'Suspensión delantera'], ['suspension_rear', 'Suspensión trasera'],
    ['warranty', 'Garantía'], ['location', 'Ubicación'],
  ],
  casco: [
    ['helmet_type', 'Tipo'], ['size', 'Talle'], ['color', 'Color'], ['material', 'Material'],
    ['certification', 'Homologación'], ['visor_type', 'Visor'], ['weight_grams', 'Peso', 'g'], ['warranty', 'Garantía'],
  ],
  repuesto: [
    ['oem_code', 'Código OEM'], ['manufacturer_code', 'Código fabricante'], ['manufacturer', 'Fabricante'],
    ['origin', 'Origen'], ['unit', 'Unidad'], ['weight_kg', 'Peso', 'kg'],
  ],
};

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, MotoIconComponent, PricePipe],
  template: `
    @if (product(); as p) {
      <section class="r-page-head head">
        <div class="r-page-head__inner r-container head__inner">
          <nav class="r-crumbs" aria-label="Ruta">
            <a routerLink="/">Inicio</a><span>/</span>
            <a [routerLink]="section().path">{{ section().label }}</a><span>/</span>
            <span>{{ p.name }}</span>
          </nav>
        </div>
      </section>

      <section class="detail r-container">
        <div class="gallery">
          <div class="gallery__main">
            @if (activeImage(); as img) {
              <img [src]="img" [alt]="p.name" />
            } @else {
              <app-moto-icon width="62%" />
              <span class="gallery__tag">[FOTO]</span>
            }
            @if (badge(); as b) {
              <span class="badge" [class.badge--dark]="b.dark">{{ b.label }}</span>
            }
          </div>
          @if (p.images && p.images.length > 1) {
            <div class="gallery__thumbs">
              @for (img of p.images; track img.path) {
                <button type="button" class="thumb" [class.is-active]="activeImage() === img.path" (click)="activeImage.set(img.path)">
                  <img [src]="img.thumb_path ?? img.path" [alt]="img.alt || p.name" />
                </button>
              }
            </div>
          }

        </div>

        <aside class="side">
          <div class="side__box r-panel">
            <div class="titles">
              @if (p.brand || p.category) {
                <span class="titles__eyebrow">{{ p.brand?.name }}{{ p.brand && p.category ? ' · ' : '' }}{{ p.category?.name }}</span>
              }
              <h1 class="titles__name">{{ p.name }}</h1>
              <div class="titles__price">
                @if (p.price.visible) {
                  @if (p.price.is_offer && p.price.offer) { <s>{{ p.price.final | price: p.price.currency }}</s> }
                  <strong>{{ p.price | price }}</strong>
                } @else {
                  <strong class="titles__consult">Consultar precio</strong>
                }
              </div>
            </div>

            <dl class="quick">
              @for (row of quickRows(); track row.label) {
                <div><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
              }
            </dl>

            @if (p.tags && p.tags.length) {
              <div class="tags">
                @for (tag of p.tags; track tag.id) { <span class="tag">{{ tag.name }}</span> }
              </div>
            }

            <div class="side__actions">
              <button type="button" class="r-btn r-btn--dark" (click)="addToCart(p)">{{ addedToCart() ? '✓ En el cotizador' : 'Agregar al cotizador' }}</button>
              <button type="button" class="r-btn r-btn--outline" [attr.aria-pressed]="compare.has(p.id)" (click)="compare.toggle(p.id)">
                {{ compare.has(p.id) ? '✓ Comparando' : 'Comparar' }}
              </button>
            </div>
          </div>

          <form id="consultar" class="side__box r-panel inquiry" (ngSubmit)="sendInquiry(p.id)">
            <h2 class="block__title">Consultar por esta {{ p.type === 'moto' ? 'moto' : 'pieza' }}</h2>
            <p class="wa-hint">Te respondemos por WhatsApp. Escribí tu nombre y lo que querés saber, y se abre el chat con el mensaje listo.</p>
            <label class="r-field">Nombre<input class="r-input" type="text" name="name" [(ngModel)]="form.name" required /></label>
            <label class="r-field">Mensaje<textarea class="r-input" name="message" [(ngModel)]="form.message" rows="3"></textarea></label>
            @if (error()) { <p class="form-error">{{ error() }}</p> }
            @if (sent()) { <p class="r-success">¡Listo! Se abrió WhatsApp con tu consulta. Si no se abrió, tocá el botón otra vez.</p> }
            <button type="submit" class="r-btn r-btn--whatsapp">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>
              Consultar por WhatsApp
            </button>
          </form>
        </aside>

        <div class="info">
          @if (p.description || p.short_description) {
            <div class="block r-panel">
              <h2 class="block__title">Descripción</h2>
              @if (p.short_description) { <p class="lead">{{ p.short_description }}</p> }
              @if (p.description) { <p class="desc">{{ p.description }}</p> }
            </div>
          }

          @if (techRows().length) {
            <div class="block r-panel">
              <h2 class="block__title">Ficha técnica</h2>
              <dl class="tech">
                @for (row of techRows(); track row.label) {
                  <div><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
                }
              </dl>
            </div>
          }

          @if (p.compatibility?.length) {
            <div class="block r-panel">
              <h2 class="block__title">Compatible con</h2>
              <ul class="compat">
                @for (moto of p.compatibility; track moto) { <li>{{ moto }}</li> }
              </ul>
              <p class="compat__hint">¿No está tu moto? Consultanos por WhatsApp y te decimos si te sirve.</p>
            </div>
          }

          @if (videos().length) {
            <div class="block r-panel">
              @for (v of videos(); track v.key) {
                <div class="video">
                  @if (v.embed) {
                    <iframe [src]="v.embed" [title]="v.title || 'Video de ' + p.name" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
                  } @else if (v.file) {
                    <video [src]="v.file" controls preload="metadata"></video>
                  }
                </div>
                @if (v.title) { <p class="video__title">{{ v.title }}</p> }
              }
            </div>
          }

          @if (p.public_documents?.length) {
            <div class="block r-panel">
              <h2 class="block__title">Documentación</h2>
              <ul class="docs">
                @for (d of p.public_documents; track d.url) {
                  <li>
                    <a [href]="d.url" target="_blank" rel="noopener">
                      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"></path></svg>
                      <span><strong>{{ d.title }}</strong><small>{{ docKind(d.kind) }}</small></span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </section>
    } @else if (notFound()) {
      <section class="r-container r-section missing">
        <h1 class="r-h2">No encontramos este producto</h1>
        <p class="r-lead">Puede que ya se haya vendido o que el enlace no sea correcto.</p>
        <a routerLink="/motos" class="r-btn r-btn--red">Ver el stock</a>
      </section>
    } @else {
      <p class="r-status r-container">Cargando...</p>
    }
  `,
  styles: [`
    .head .head__inner { padding-top: 22px; padding-bottom: 22px; }

    .side__box { text-align: center; }
    .side__box .r-input { text-align: left; }
    .quick div, .tags { justify-content: center; }
    .inquiry .r-btn { gap: 10px; }
    .titles { align-items: center; }
    .titles__price { justify-content: center; }
    .titles { display: flex; flex-direction: column; gap: 8px; padding-bottom: 18px; border-bottom: 1px solid var(--r-line); }
    .titles__eyebrow { font-family: var(--r-display); font-weight: 700; font-size: 15px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--r-red); }
    .titles__name { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: clamp(36px, 4vw, 52px); line-height: 0.95; text-transform: uppercase; color: var(--r-ink); overflow-wrap: anywhere; }
    .titles__price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-family: var(--r-display); }
    .titles__price strong { font-weight: 800; font-size: 42px; line-height: 1; color: var(--r-red); }
    .titles__price s { font-size: 20px; color: var(--r-muted); }
    .titles__consult { font-size: 30px !important; color: var(--r-ink) !important; }

    .detail { padding-top: 48px; padding-bottom: 96px; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); grid-template-areas: 'gallery side' 'info side'; gap: 32px; align-items: start; }
    .gallery { grid-area: gallery; }
    .side { grid-area: side; }
    .info { grid-area: info; display: flex; flex-direction: column; gap: 24px; min-width: 0; }
    @media (max-width: 960px) {
      .detail { grid-template-columns: 1fr; grid-template-areas: 'gallery' 'side' 'info'; }
    }

    .gallery { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
    .gallery__main { position: relative; aspect-ratio: 16 / 10; background: var(--r-photo); border: 1px solid var(--r-line); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .gallery__main img { width: 100%; height: 100%; object-fit: contain; padding: 14px; background: #FFFFFF; }
    .gallery__tag { position: absolute; bottom: 12px; right: 14px; font-size: 12px; letter-spacing: 0.14em; color: var(--r-muted); }
    .gallery__thumbs { display: flex; flex-wrap: wrap; gap: 10px; margin-top: -12px; }
    .thumb { width: 96px; aspect-ratio: 16 / 10; padding: 0; border: 2px solid transparent; background: var(--r-photo); }
    .thumb img { width: 100%; height: 100%; object-fit: contain; padding: 3px; background: #FFFFFF; display: block; }
    .thumb.is-active, .thumb:hover { border-color: var(--r-red); }
    .badge { position: absolute; top: 14px; left: 14px; font-family: var(--r-display); font-weight: 700; font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; color: #FFFFFF; background: var(--r-red); }
    .badge--dark { background: var(--r-ink); }

    .block { padding: 32px; display: flex; flex-direction: column; gap: 16px; text-align: center; }
    .block__title { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 30px; line-height: 1; text-transform: uppercase; }
    .lead { margin: 0; font-size: 19px; font-weight: 600; }
    .desc { margin: 0; font-size: 17px; line-height: 1.6; color: var(--r-text-2); white-space: pre-line; }
    .tech { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0 24px; }
    .tech div { padding: 12px 0; border-bottom: 1px solid var(--r-line); }
    .tech dt { font-size: 12px; color: var(--r-muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .tech dd { margin: 4px 0 0; font-weight: 600; }
    .compat { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .compat li { padding: 8px 14px; border: 1px solid var(--r-line); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; font-size: 15px; }
    .compat__hint { margin: 0; color: var(--r-muted); font-size: 15px; }
    .wa-hint { margin: -6px 0 0; color: var(--r-muted-2); font-size: 15px; line-height: 1.45; }
    .video { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; }
    .video iframe, .video video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .video + .video, .video__title + .video { margin-top: 16px; }
    .video__title { margin: 8px 0 0; font-weight: 600; }
    .docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .docs a { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 1px solid var(--r-line); color: var(--r-ink); text-decoration: none; transition: border-color .15s; }
    .docs a:hover { border-color: var(--r-red); color: var(--r-ink); }
    .docs svg { color: var(--r-red); flex-shrink: 0; }
    .docs span { display: flex; flex-direction: column; }
    .docs small { color: var(--r-muted); text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; }

    .side { display: flex; flex-direction: column; gap: 24px; position: sticky; top: 104px; }
    @media (max-width: 960px) { .side { position: static; } }
    .side__box { padding: 28px; display: flex; flex-direction: column; gap: 18px; }
    .quick { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .quick dt { font-size: 12px; color: var(--r-muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .quick dd { margin: 4px 0 0; font-weight: 600; font-size: 17px; overflow-wrap: anywhere; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { font-family: var(--r-display); font-weight: 700; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 10px; border: 1px solid var(--r-red); color: var(--r-red); }
    .side__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .side__actions .r-btn { font-size: 17px; padding: 12px 14px; }
    .inquiry { scroll-margin-top: 110px; }
    .form-error { margin: 0; color: var(--r-red); font-weight: 600; }
    .missing { display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
  `],
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private catalog = inject(CatalogService);
  cart = inject(CartService);
  compare = inject(CompareService);
  site = inject(SiteService);

  type!: ProductType;
  product = signal<Product | null>(null);
  private sanitizer = inject(DomSanitizer);

  /**
   * Videos listos para mostrar. Se calcula una sola vez por producto: si la URL
   * "segura" se regenerara en cada render, el reproductor se recargaría solo.
   */
  videos = computed(() =>
    (this.product()?.public_videos ?? []).map((v, i) => {
      const embed = v.is_file ? null : embedUrl(v.url);
      return {
        key: i + v.url,
        title: v.title,
        embed: embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null,
        file: v.is_file ? v.url : null,
      };
    }).filter((v) => v.embed || v.file)
  );

  docKind(kind: string): string {
    return ({ ficha: 'Ficha técnica', manual: 'Manual', garantia: 'Garantía', folleto: 'Folleto', otro: 'Documento' } as Record<string, string>)[kind] ?? 'Documento';
  }
  notFound = signal(false);
  activeImage = signal<string | null>(null);
  addedToCart = signal(false);
  sending = signal(false);
  sent = signal(false);
  error = signal('');
  form = { name: '', message: '' };

  ngOnInit(): void {
    this.site.load();
    this.type = this.route.snapshot.data['type'] as ProductType;

    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug')!;
      this.product.set(null);
      this.notFound.set(false);
      this.sent.set(false);
      this.addedToCart.set(false);

      this.catalog.show(this.type, slug).subscribe({
        next: (res) => {
          this.product.set(res.data);
          const main = res.data.images?.find((i) => i.is_main) ?? res.data.images?.[0];
          this.activeImage.set(main?.path ?? null);
          this.form.message = `Quiero más información sobre ${res.data.name}.`;
          // El ancla #consultar se pide antes de que exista el formulario: se resuelve al cargar.
          if (this.route.snapshot.fragment === 'consultar') {
            setTimeout(() => document.getElementById('consultar')?.scrollIntoView({ behavior: 'smooth' }));
          }
        },
        error: () => this.notFound.set(true),
      });
    });
  }

  section() {
    return SECTION[this.type];
  }

  badge(): { label: string; dark: boolean } | null {
    const p = this.product();
    const condition = (p?.moto as { condition_type?: string } | undefined)?.condition_type;
    if (condition) return condition === 'nueva' ? { label: '0 km', dark: false } : { label: 'Usada', dark: true };
    if (p?.price.is_offer) return { label: 'Oferta', dark: false };
    if (p?.is_new) return { label: 'Nuevo', dark: false };
    return null;
  }

  quickRows(): Row[] {
    const p = this.product()!;
    const moto = p.moto as Record<string, unknown> | undefined;
    if (p.type === 'moto' && moto) {
      return [
        { label: 'Año', value: moto['year'] ? String(moto['year']) : '—' },
        { label: 'Km', value: moto['km'] !== null && moto['km'] !== undefined ? this.number(moto['km']) : '—' },
        moto['color']
          ? { label: 'Color', value: String(moto['color']) }
          : { label: 'Motor', value: moto['displacement_cc'] ? `${moto['displacement_cc']} cc` : '—' },
      ];
    }
    return [
      { label: 'Marca', value: p.brand?.name ?? '—' },
      { label: 'Código', value: p.code },
      { label: 'Stock', value: AVAILABILITY[p.availability] ?? p.availability },
    ];
  }

  /** Datos técnicos del tipo de producto + características cargadas desde el panel. */
  techRows(): Row[] {
    const p = this.product()!;
    const data = (p[p.type] ?? {}) as Record<string, unknown>;
    const rows: Row[] = [];

    for (const [key, label, unit] of FIELDS[p.type]) {
      const value = data[key];
      if (value === null || value === undefined || value === '') continue;
      if (key === 'km' && Number(value) === 0) continue;
      // El año va sin separador de miles (2026, no 2.026).
      const text = key === 'year' ? String(value) : typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? this.number(value) : this.capitalize(String(value));
      rows.push({ label, value: unit ? `${text} ${unit}` : text });
    }

    for (const spec of p.specs ?? []) {
      if (rows.some((r) => r.label === spec.feature)) continue;
      const value = /^\d+(\.\d+)?$/.test(String(spec.value)) ? this.number(spec.value) : String(spec.value);
      rows.push({ label: spec.feature, value: spec.unit ? `${value} ${spec.unit}` : value });
    }

    return rows;
  }

  addToCart(p: Product): void {
    this.cart.add(p);
    this.addedToCart.set(true);
  }

  /**
   * La consulta se manda por WhatsApp con el mensaje armado. También queda
   * registrada en el panel (Consultas) para el seguimiento.
   */
  sendInquiry(productId: number): void {
    const p = this.product();
    if (!p) return;
    if (!this.form.name.trim()) {
      this.error.set('Ingresá tu nombre.');
      return;
    }
    this.error.set('');

    // El saludo ya va al principio: si el mensaje también arranca con "Hola", se saca.
    const message = this.form.message.trim().replace(/^hola[\s,.!]*/i, '') || `Quiero más información sobre ${p.name}.`;
    const text = [
      `Hola, soy ${this.form.name.trim()}. ${message.charAt(0).toUpperCase()}${message.slice(1)}`,
      window.location.href.split('#')[0],
    ].join('\n');

    // Primero se abre el chat (desde el clic, para que el navegador no lo bloquee).
    if (!this.site.openWhatsapp(text)) {
      this.error.set('Todavía no hay un WhatsApp configurado. Probá más tarde.');
      return;
    }
    this.sent.set(true);
    this.catalog.sendInquiry({ product_id: productId, name: this.form.name.trim(), message: this.form.message, source: 'whatsapp' }).subscribe({ error: () => undefined });
  }

  private number(value: unknown): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(value));
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
