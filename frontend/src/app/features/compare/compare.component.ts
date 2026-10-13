import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CompareService } from '../../core/services/compare.service';
import { SiteService } from '../../core/services/site.service';
import { Product, ProductType } from '../../core/models/product.model';
import { MotoIconComponent } from '../../shared/moto-icon.component';
import { PricePipe } from '../../shared/price.pipe';
import { AVAILABILITY } from '../../shared/product-card.component';

const MAX_ITEMS = 4;

/** Una fila del comparador: de dónde sale el dato, su unidad y cuál valor es "el mejor". */
interface RowDef {
  label: string;
  value: (p: Product) => unknown;
  unit?: string;
  best?: 'max' | 'min';
  kind?: 'number' | 'year' | 'text' | 'bool';
}

interface Section {
  title: string;
  rows: RowDef[];
}

/** Dato de la ficha del tipo (moto, casco o repuesto). */
const detail = (key: string) => (p: Product) => (p[p.type] as Record<string, unknown> | undefined)?.[key];

const SECTIONS: Record<ProductType, Section[]> = {
  moto: [
    {
      title: 'Motor',
      rows: [
        { label: 'Cilindrada', value: detail('displacement_cc'), unit: 'cc', best: 'max' },
        { label: 'Potencia', value: detail('power_hp'), unit: 'hp', best: 'max' },
        { label: 'Torque', value: detail('torque_nm'), unit: 'Nm', best: 'max' },
        { label: 'Cilindros', value: detail('cylinders') },
        { label: 'Refrigeración', value: detail('cooling'), kind: 'text' },
        { label: 'Combustible', value: detail('fuel_type'), kind: 'text' },
        { label: 'Arranque', value: detail('starter'), kind: 'text' },
      ],
    },
    {
      title: 'Transmisión y chasis',
      rows: [
        { label: 'Transmisión', value: detail('transmission'), kind: 'text' },
        { label: 'Freno delantero', value: detail('brakes_front'), kind: 'text' },
        { label: 'Freno trasero', value: detail('brakes_rear'), kind: 'text' },
        { label: 'Suspensión delantera', value: detail('suspension_front'), kind: 'text' },
        { label: 'Suspensión trasera', value: detail('suspension_rear'), kind: 'text' },
      ],
    },
    {
      title: 'Dimensiones y peso',
      rows: [
        { label: 'Peso', value: detail('weight_kg'), unit: 'kg', best: 'min' },
        { label: 'Altura de asiento', value: detail('seat_height_mm'), unit: 'mm' },
        { label: 'Tanque', value: detail('fuel_capacity_l'), unit: 'L', best: 'max' },
      ],
    },
    {
      title: 'Garantía y más',
      rows: [
        { label: 'Garantía', value: detail('warranty'), kind: 'text' },
        { label: 'Color', value: detail('color'), kind: 'text' },
        { label: 'Ubicación', value: detail('location'), kind: 'text' },
      ],
    },
  ],
  casco: [
    {
      title: 'Ficha',
      rows: [
        { label: 'Tipo', value: detail('helmet_type'), kind: 'text' },
        { label: 'Talle', value: detail('size'), kind: 'text' },
        { label: 'Homologación', value: detail('certification'), kind: 'text' },
        { label: 'Visor', value: detail('visor_type'), kind: 'text' },
        { label: 'Material', value: detail('material'), kind: 'text' },
        { label: 'Color', value: detail('color'), kind: 'text' },
        { label: 'Peso', value: detail('weight_grams'), unit: 'g', best: 'min' },
        { label: 'Bluetooth', value: detail('has_bluetooth'), kind: 'bool' },
        { label: 'Garantía', value: detail('warranty'), kind: 'text' },
      ],
    },
  ],
  repuesto: [
    {
      title: 'Ficha',
      rows: [
        { label: 'Fabricante', value: detail('manufacturer'), kind: 'text' },
        { label: 'Origen', value: detail('origin'), kind: 'text' },
        { label: 'Unidad', value: detail('unit'), kind: 'text' },
        { label: 'Peso', value: detail('weight_kg'), unit: 'kg', best: 'min' },
      ],
    },
  ],
};

/** Precio que paga el cliente (la oferta si hay), o null si el precio está oculto. */
const finalPrice = (p: Product): number | null => {
  if (!p.price.visible) return null;
  return Number(p.price.is_offer && p.price.offer ? p.price.offer : p.price.final) || null;
};

const SUMMARY: Section = {
  title: 'Resumen',
  rows: [
    { label: 'Precio', value: finalPrice, best: 'min' },
    { label: 'Condición', value: (p) => (p.type === 'moto' ? (detail('condition_type')(p) === 'nueva' ? '0 km' : detail('condition_type')(p)) : null), kind: 'text' },
    { label: 'Año', value: detail('year'), kind: 'year', best: 'max' },
    { label: 'Kilómetros', value: detail('km'), unit: 'km', best: 'min' },
    { label: 'Marca', value: (p) => p.brand?.name, kind: 'text' },
    { label: 'Categoría', value: (p) => p.category?.name, kind: 'text' },
    { label: 'Disponibilidad', value: (p) => AVAILABILITY[p.availability] ?? p.availability, kind: 'text' },
  ],
};

interface Cell {
  text: string;
  best: boolean;
  empty: boolean;
}

interface Row {
  label: string;
  cells: Cell[];
  same: boolean;
  isPrice: boolean;
}

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [RouterLink, PricePipe, MotoIconComponent],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>Comparar</span></nav>
        <span class="r-eyebrow">Comparador</span>
        <h1 class="r-page-head__title">Compará <span>lado a lado</span></h1>
        <p class="r-page-head__text">Precio, motor, frenos y medidas de hasta {{ max }} motos o productos, con lo mejor de cada punto resaltado.</p>
      </div>
    </section>

    <section class="r-container r-section compare">
      @if (loading()) {
        <p class="r-status">Cargando...</p>
      } @else if (products().length === 0) {
        <div class="empty r-panel">
          <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"></path></svg>
          <h2>Tu comparador está vacío</h2>
          <p>Tocá <strong>"Comparar"</strong> en hasta {{ max }} motos o productos y acá los vas a ver uno al lado del otro.</p>
          <a routerLink="/motos" class="r-btn r-btn--red">Elegir motos</a>
        </div>
      } @else {
        <div class="toolbar">
          <p><strong>{{ products().length }}</strong> de {{ max }} {{ products().length === 1 ? 'producto' : 'productos' }}</p>
          <div class="toolbar__actions">
            @if (products().length > 1) {
              <label class="switch">
                <input type="checkbox" [checked]="onlyDiff()" (change)="onlyDiff.set(!onlyDiff())" />
                <span class="switch__track" aria-hidden="true"></span>
                Solo diferencias
              </label>
            }
            <button type="button" class="r-btn r-btn--outline r-btn--sm" (click)="clear()">Vaciar</button>
          </div>
        </div>

        <div class="table-wrap r-panel">
          <table class="table" [style.--cols]="columns()">
            <thead>
              <tr>
                <th scope="col" class="corner">
                  @if (products().length > 1) {
                    <span class="legend"><span class="legend__dot"></span> Mejor valor</span>
                  }
                </th>
                @for (p of products(); track p.id) {
                  <th scope="col">
                    <div class="head">
                      <button type="button" class="head__remove" (click)="remove(p.id)" [attr.aria-label]="'Quitar ' + p.name" title="Quitar">
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>
                      </button>
                      <a [routerLink]="link(p)" class="head__photo">
                        @if (image(p); as src) { <img [src]="src" [alt]="p.name" loading="lazy" /> } @else { <app-moto-icon width="55%" /> }
                      </a>
                      <div class="head__tags">
                        @if (condition(p); as c) { <span class="tag" [class.tag--used]="c !== '0 km'">{{ c }}</span> }
                        @if (year(p); as y) { <span class="tag tag--plain">{{ y }}</span> }
                      </div>
                      <a [routerLink]="link(p)" class="head__name">{{ p.name }}</a>
                      <div class="head__price">
                        @if (p.price.visible) {
                          @if (p.price.is_offer && p.price.offer) { <s>{{ p.price.final | price: p.price.currency }}</s> }
                          <strong>{{ p.price | price }}</strong>
                        } @else {
                          <strong class="head__consult">Consultar precio</strong>
                        }
                      </div>
                      <div class="head__actions">
                        <a [routerLink]="link(p)" class="r-btn r-btn--outline r-btn--sm">Ver ficha</a>
                        <button type="button" class="r-btn r-btn--whatsapp r-btn--sm" (click)="consult(p)">Consultar</button>
                      </div>
                    </div>
                  </th>
                }
                @if (products().length < max) {
                  <th scope="col" class="add">
                    <a routerLink="/motos" class="add__box">
                      <span class="add__plus" aria-hidden="true">+</span>
                      Agregar otra
                      <small>Te quedan {{ max - products().length }} lugar(es)</small>
                    </a>
                  </th>
                }
              </tr>
            </thead>
            @for (section of sections(); track section.title) {
              <tbody>
                <tr class="section"><th scope="rowgroup" [attr.colspan]="columns() + 1">{{ section.title }}</th></tr>
                @for (row of section.rows; track row.label) {
                  <tr [class.row--same]="row.same && products().length > 1">
                    <th scope="row">{{ row.label }}</th>
                    @for (cell of row.cells; track $index) {
                      <td [class.best]="cell.best" [class.empty]="cell.empty" [class.price]="row.isPrice">
                        {{ cell.text }}
                        @if (cell.best) { <span class="best__tag">Mejor</span> }
                      </td>
                    }
                    @if (products().length < max) { <td class="add-col"></td> }
                  </tr>
                }
              </tbody>
            }
          </table>
        </div>
        @if (onlyDiff() && hiddenCount() > 0) {
          <p class="hint">Se ocultaron {{ hiddenCount() }} fila(s) donde todos coinciden.</p>
        }
      }
    </section>
  `,
  styles: [`
    .compare { display: flex; flex-direction: column; gap: 20px; }
    .empty { padding: 56px 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; color: var(--r-muted-2); }
    .empty svg { color: var(--r-red); }
    .empty h2 { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 32px; text-transform: uppercase; color: var(--r-ink); }
    .empty p { margin: 0 0 8px; max-width: 480px; font-size: 18px; line-height: 1.5; }

    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .toolbar p { margin: 0; font-size: 17px; color: var(--r-muted-2); }
    .toolbar strong { font-family: var(--r-display); font-size: 28px; color: var(--r-ink); }
    .toolbar__actions { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .switch { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer; user-select: none; }
    .switch input { position: absolute; opacity: 0; pointer-events: none; }
    .switch__track { width: 42px; height: 24px; border-radius: 12px; background: var(--r-line); position: relative; transition: background .15s; }
    .switch__track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s; }
    .switch input:checked + .switch__track { background: var(--r-red); }
    .switch input:checked + .switch__track::after { transform: translateX(18px); }
    .switch input:focus-visible + .switch__track { outline: 2px solid var(--r-ink); outline-offset: 2px; }

    .table-wrap { overflow-x: auto; }
    .table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: calc(190px + var(--cols) * 230px); table-layout: fixed; }
    .table th, .table td { padding: 14px 18px; border-bottom: 1px solid var(--r-line); vertical-align: middle; text-align: center; }
    /* Primera columna fija al deslizar de costado (celular). */
    .table tbody th, .corner { position: sticky; left: 0; z-index: 1; background: #FFFFFF; width: 190px; text-align: left; }
    .table tbody th { font-size: 12px; font-weight: 600; color: var(--r-muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .table td { font-weight: 600; color: var(--r-ink); }
    .table td.empty { color: var(--r-grey); font-weight: 400; }
    .section th { background: var(--r-ink) !important; color: #FFFFFF !important; font-family: var(--r-display); font-size: 15px !important; letter-spacing: 0.14em !important; padding: 10px 18px !important; }
    .row--same td, .row--same th { opacity: 0.6; }

    .best { background: #EAF6EE; color: #1F6B3A !important; }
    .best__tag { display: inline-block; margin-left: 6px; padding: 2px 7px; border-radius: 10px; background: #1F6B3A; color: #FFFFFF; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; vertical-align: middle; }
    .price { font-family: var(--r-display); font-weight: 800 !important; font-size: 22px; }
    .legend { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--r-muted); text-transform: none; letter-spacing: 0; }
    .legend__dot { width: 12px; height: 12px; border-radius: 3px; background: #EAF6EE; border: 1px solid #1F6B3A; }

    .head { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .head__remove { position: absolute; top: -4px; right: -6px; z-index: 2; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--r-line); background: #FFFFFF; color: var(--r-muted); display: grid; place-items: center; cursor: pointer; }
    .head__remove:hover { color: #FFFFFF; background: var(--r-red); border-color: var(--r-red); }
    /* Todas las fotos del mismo tamaño para que las motos queden alineadas. */
    .head__photo { width: 100%; height: 170px; background: #FFFFFF; border: 1px solid var(--r-line); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .head__photo img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .head__tags { display: flex; gap: 6px; min-height: 24px; }
    .tag { font-family: var(--r-display); font-weight: 700; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; background: var(--r-red); color: #FFFFFF; }
    .tag--used { background: var(--r-ink); }
    .tag--plain { background: transparent; color: var(--r-muted); border: 1px solid var(--r-line); }
    .head__name { font-family: var(--r-display); font-weight: 800; font-size: 22px; line-height: 1.05; text-transform: uppercase; color: var(--r-ink); text-decoration: none; min-height: 46px; display: flex; align-items: center; }
    .head__name:hover { color: var(--r-red); }
    .head__price { display: flex; flex-direction: column; align-items: center; font-family: var(--r-display); line-height: 1; }
    .head__price strong { font-weight: 800; font-size: 28px; color: var(--r-red); }
    .head__price s { font-size: 16px; color: var(--r-muted); }
    .head__consult { font-size: 20px !important; color: var(--r-ink) !important; }
    .head__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; width: 100%; }
    .head__actions .r-btn { padding: 9px 6px; font-size: 14px; justify-content: center; }

    .add { vertical-align: top !important; }
    .add__box { height: 170px; border: 2px dashed var(--r-line); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--r-muted); font-family: var(--r-display); font-weight: 700; font-size: 18px; text-transform: uppercase; text-decoration: none; transition: border-color .15s, color .15s; }
    .add__box:hover { border-color: var(--r-red); color: var(--r-red); }
    .add__plus { font-size: 40px; line-height: 1; }
    .add__box small { font-family: var(--r-body); font-weight: 400; font-size: 13px; text-transform: none; }
    .add-col { background: #FAFAFA; }
    .hint { margin: 0; text-align: center; color: var(--r-muted); font-size: 15px; }

    @media (max-width: 640px) {
      .table { min-width: calc(130px + var(--cols) * 200px); }
      .table tbody th, .corner { width: 130px; padding: 12px; }
      .head__photo, .add__box { height: 130px; }
      .head__name { font-size: 19px; }
      .head__actions { grid-template-columns: 1fr; }
    }
  `],
})
export class CompareComponent implements OnInit {
  private catalog = inject(CatalogService);
  private site = inject(SiteService);
  compareService = inject(CompareService);

  readonly max = MAX_ITEMS;
  products = signal<Product[]>([]);
  loading = signal(true);
  onlyDiff = signal(false);

  /** Columnas de datos (productos + el lugar libre para agregar otro). */
  columns = computed(() => this.products().length + (this.products().length < MAX_ITEMS ? 1 : 0));

  private allSections = computed(() => {
    const list = this.products();
    const types = [...new Set(list.map((p) => p.type))];
    const sections: Section[] = [SUMMARY, ...types.flatMap((t) => SECTIONS[t])];

    // Características extra cargadas en el panel (las que no están en la ficha fija).
    const extra = new Set<string>();
    list.forEach((p) => p.specs?.forEach((s) => extra.add(s.feature)));
    if (extra.size) {
      sections.push({
        title: 'Otras características',
        rows: [...extra].map((name) => ({
          label: name,
          kind: 'text' as const,
          value: (p: Product) => {
            const spec = p.specs?.find((s) => s.feature === name);
            return spec ? (spec.unit ? `${spec.value} ${spec.unit}` : spec.value) : null;
          },
        })),
      });
    }

    return sections
      .map((s) => ({ title: s.title, rows: s.rows.map((def) => this.buildRow(def, list)).filter((r): r is Row => r !== null) }))
      .filter((s) => s.rows.length > 0);
  });

  sections = computed(() =>
    this.allSections()
      .map((s) => ({ ...s, rows: this.onlyDiff() ? s.rows.filter((r) => !r.same) : s.rows }))
      .filter((s) => s.rows.length > 0),
  );

  hiddenCount = computed(() => this.allSections().reduce((n, s) => n + s.rows.filter((r) => r.same).length, 0));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const ids = this.compareService.ids();
    if (ids.length === 0) {
      this.products.set([]);
      this.loading.set(false);
      return;
    }
    this.catalog.compare(ids).subscribe({
      next: (res) => {
        // Mismo orden en que se fueron agregando.
        this.products.set(ids.map((id) => res.data.find((p) => p.id === id)).filter((p): p is Product => !!p));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  remove(id: number): void {
    this.compareService.remove(id);
    this.products.update((list) => list.filter((p) => p.id !== id));
  }

  clear(): void {
    this.compareService.clear();
    this.products.set([]);
  }

  consult(p: Product): void {
    this.site.openWhatsapp(`Hola, estoy comparando y quiero consultar por ${p.name}.\n${location.origin}/${p.type}s/${p.slug}`);
  }

  link(p: Product): unknown[] {
    return ['/', p.type + 's', p.slug];
  }

  image(p: Product): string | null {
    const main = p.images?.find((i) => i.is_main) ?? p.images?.[0];
    return main ? main.path : null;
  }

  condition(p: Product): string | null {
    const c = detail('condition_type')(p);
    if (p.type !== 'moto' || !c) return null;
    return c === 'nueva' ? '0 km' : String(c);
  }

  year(p: Product): string | null {
    const y = detail('year')(p);
    return y ? String(y) : null;
  }

  /** Arma una fila; devuelve null si ningún producto tiene ese dato. */
  private buildRow(def: RowDef, list: Product[]): Row | null {
    const raw = list.map((p) => def.value(p));
    if (raw.every((v) => v === null || v === undefined || v === '')) return null;

    const kind = def.kind ?? 'number';
    const numbers = raw.map((v) => (kind === 'number' || kind === 'year') && v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : null);

    // "Mejor": sólo si hay al menos dos valores numéricos y no son todos iguales.
    let bestValue: number | null = null;
    const present = numbers.filter((n): n is number => n !== null);
    if (def.best && present.length >= 2 && new Set(present).size > 1) {
      bestValue = def.best === 'max' ? Math.max(...present) : Math.min(...present);
    }

    const isPrice = def.label === 'Precio';
    const cells: Cell[] = raw.map((v, i) => {
      const empty = v === null || v === undefined || v === '';
      return {
        text: empty ? (isPrice ? 'Consultar' : '—') : this.format(v, kind, def.unit, isPrice ? list[i].price.currency : null),
        best: bestValue !== null && numbers[i] === bestValue,
        empty,
      };
    });

    return { label: def.label, cells, same: new Set(cells.map((c) => c.text)).size === 1, isPrice };
  }

  private format(value: unknown, kind: string, unit?: string, currency?: string | null): string {
    if (kind === 'bool') return value ? 'Sí' : 'No';
    if (kind === 'year') return String(value);
    if (kind === 'number' && !isNaN(Number(value))) {
      const n = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(value));
      if (currency) return `${currency === 'USD' ? 'US$' : '$'} ${n}`;
      return unit ? `${n} ${unit}` : n;
    }
    const text = String(value);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
