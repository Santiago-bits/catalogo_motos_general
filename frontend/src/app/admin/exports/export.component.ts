import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminBrand, AdminCategory, ProductType } from '../core/admin-api.service';
import { UiService } from '../core/ui.service';

interface Dataset {
  key: string;
  title: string;
  description: string;
  catalog: boolean;
}

const ICONS: Record<string, string> = {
  motos: 'bi-bicycle', usadas: 'bi-arrow-repeat', cascos: 'bi-shield-shaded', repuestos: 'bi-nut-fill',
  consultas: 'bi-chat-dots-fill', cotizaciones: 'bi-receipt', auditoria: 'bi-clipboard-check-fill',
};

@Component({
  selector: 'app-admin-export',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card-admin">
      <div class="card-admin__head">
        <h2><i class="bi bi-file-earmark-pdf"></i> Catálogo en PDF</h2>
      </div>
      <div class="card-admin__body">
        <p class="muted" style="margin-top:0">Un catálogo listo para mandar por WhatsApp o email: una tarjeta por producto con foto, ficha resumida y precio. Filtrá para armar catálogos a medida (por ejemplo, “Usadas hasta $ 4.000.000” o “Ofertas Honda”).</p>

        <div class="form-grid">
          <div>
            <label class="form-label" for="cat-set">Catálogo</label>
            <select class="form-select" id="cat-set" name="cat" [(ngModel)]="catalogSet" (ngModelChange)="onSetChange()">
              @for (d of catalogSets(); track d.key) { <option [value]="d.key">{{ d.title }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label" for="cat-cat">Categoría</label>
            <select class="form-select" id="cat-cat" name="categoria" [(ngModel)]="f.categoria">
              <option value="">Todas</option>
              @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label" for="cat-brand">Marca</label>
            <select class="form-select" id="cat-brand" name="marca" [(ngModel)]="f.marca">
              <option value="">Todas</option>
              @for (b of brands(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label" for="cat-estado">Estado</label>
            <select class="form-select" id="cat-estado" name="estado" [(ngModel)]="f.estado">
              <option value="">Todos menos vendidas</option>
              <option value="disponible">Disponibles</option>
              <option value="reservado">Reservadas</option>
              <option value="consultar">A consultar</option>
              <option value="vendido">Vendidas</option>
            </select>
          </div>
          <div>
            <label class="form-label">Precio</label>
            <div class="range">
              <input class="form-control" type="number" min="0" name="pmin" [(ngModel)]="f.precio_min" placeholder="Desde" />
              <input class="form-control" type="number" min="0" name="pmax" [(ngModel)]="f.precio_max" placeholder="Hasta" />
            </div>
          </div>
          @if (setType() === 'moto') {
            <div>
              <label class="form-label">Año</label>
              <div class="range">
                <input class="form-control" type="number" name="amin" [(ngModel)]="f.anio_min" placeholder="Desde" />
                <input class="form-control" type="number" name="amax" [(ngModel)]="f.anio_max" placeholder="Hasta" />
              </div>
            </div>
          }
          <div>
            <label class="form-label" for="cat-orden">Orden</label>
            <select class="form-select" id="cat-orden" name="orden" [(ngModel)]="f.orden">
              <option value="destacados">Destacados primero</option>
              <option value="nombre">Nombre A-Z</option>
              <option value="precio_asc">Precio: menor a mayor</option>
              <option value="precio_desc">Precio: mayor a menor</option>
              @if (setType() === 'moto') { <option value="anio_desc">Año: más nuevas primero</option> }
              <option value="recientes">Últimos cargados</option>
              <option value="codigo">Código</option>
            </select>
          </div>
          <div class="span-2">
            <label class="form-label" for="cat-title">Título del PDF</label>
            <input class="form-control" id="cat-title" name="titulo" [(ngModel)]="f.titulo" maxlength="80" [placeholder]="'Catálogo · ' + setTitle()" />
          </div>
        </div>

        <div class="checks">
          <label class="filter-check"><input type="checkbox" name="precios" [(ngModel)]="withPrices" /> Con precios</label>
          <label class="filter-check"><input type="checkbox" name="dest" [(ngModel)]="f.solo_destacados" /> Sólo destacados</label>
          <label class="filter-check"><input type="checkbox" name="ofer" [(ngModel)]="f.solo_ofertas" /> Sólo en oferta</label>
          <label class="filter-check"><input type="checkbox" name="foto" [(ngModel)]="f.solo_con_foto" /> Sólo con foto</label>
          <label class="filter-check"><input type="checkbox" name="nopub" [(ngModel)]="includeHidden" /> Incluir no publicados</label>
        </div>

        <div class="row-gap" style="margin-top:16px">
          <button type="button" class="btn btn-ghost" (click)="resetFilters()">Limpiar filtros</button>
          <button type="button" class="btn btn-accent ml-auto" (click)="catalog()" [disabled]="busy() === 'catalog'"><i class="bi bi-file-earmark-pdf"></i> {{ busy() === 'catalog' ? 'Generando…' : 'Generar PDF' }}</button>
        </div>
        @if (!pdfImages()) {
          <p class="form-hint"><i class="bi bi-info-circle"></i> El servidor no tiene la extensión GD de PHP: el catálogo sale sin fotos. Activá <code>extension=gd</code> en php.ini para incluirlas.</p>
        }
      </div>
    </div>

    <div class="card-admin">
      <div class="card-admin__head"><h2><i class="bi bi-download"></i> Exportar datos</h2></div>
      <div class="card-admin__body">
        <div class="sets">
          @for (d of datasets(); track d.key) {
            <div class="set">
              <h3><i class="bi" [class]="icon(d.key)"></i> {{ d.title }}</h3>
              <p class="muted small">{{ d.description }}</p>
              <div class="set__btns">
                <button type="button" class="btn btn-accent btn-sm" (click)="download(d, 'xlsx')" [disabled]="!!busy()"><i class="bi bi-file-earmark-excel"></i> Excel</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="download(d, 'csv')" [disabled]="!!busy()"><i class="bi bi-filetype-csv"></i> CSV</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="download(d, 'pdf')" [disabled]="!!busy()"><i class="bi bi-filetype-pdf"></i> PDF</button>
              </div>
            </div>
          }
        </div>
        @if (!xlsx()) { <p class="form-hint">El servidor no tiene la extensión zip: “Excel” entrega un CSV, que Excel abre igual.</p> }
      </div>
    </div>
  `,
  styles: [`
    .sets { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .set { border: 1px solid var(--a-line); border-top: 3px solid var(--a-text); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .set h3 { margin: 0; font-size: 19px; display: flex; gap: 8px; align-items: center; }
    .set h3 .bi { color: var(--a-red); }
    .set p { margin: 0 0 6px; flex-grow: 1; }
    .set__btns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .set__btns .btn { padding: 5px 6px; gap: 6px; font-size: 13px; letter-spacing: 0.04em; }
    .range { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .checks { display: flex; flex-wrap: wrap; gap: 10px 24px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--a-line-2); }
  `],
})
export class ExportComponent implements OnInit {
  private api = inject(AdminApiService);
  private ui = inject(UiService);

  datasets = signal<Dataset[]>([]);
  catalogSets = signal<{ key: string; title: string; type: string }[]>([]);
  categories = signal<AdminCategory[]>([]);
  brands = signal<AdminBrand[]>([]);
  xlsx = signal(true);
  pdfImages = signal(true);
  busy = signal<string | null>(null);

  catalogSet = 'motos';
  withPrices = true;
  includeHidden = false;
  f = this.emptyFilters();

  ngOnInit(): void {
    this.api.brands().subscribe((b) => this.brands.set(b));
    this.loadCategories();
    this.api.get<{ datasets: Dataset[]; catalog_sets: { key: string; title: string; type: string }[]; xlsx: boolean; pdf_images: boolean }>('exportar').subscribe((res) => {
      this.datasets.set(res.datasets);
      this.catalogSets.set(res.catalog_sets);
      this.xlsx.set(res.xlsx);
      this.pdfImages.set(res.pdf_images);
    });
  }

  icon(key: string): string {
    return ICONS[key] ?? 'bi-table';
  }

  download(d: Dataset, format: 'xlsx' | 'csv' | 'pdf'): void {
    this.busy.set(d.key);
    this.api.download(`exportar/${d.key}/${format}`, {}, `${d.key}.${format}`).subscribe({
      next: () => this.busy.set(null),
      error: (e) => {
        this.busy.set(null);
        this.ui.apiError(e, 'No se pudo exportar.');
      },
    });
  }

  setType(): string {
    return this.catalogSets().find((c) => c.key === this.catalogSet)?.type ?? 'moto';
  }

  setTitle(): string {
    return this.catalogSets().find((c) => c.key === this.catalogSet)?.title ?? '';
  }

  /** Al cambiar de catálogo, la categoría y el año dejan de aplicar (son de otro tipo). */
  onSetChange(): void {
    this.f.categoria = '';
    if (this.setType() !== 'moto') {
      this.f.anio_min = null;
      this.f.anio_max = null;
      if (this.f.orden === 'anio_desc') this.f.orden = 'destacados';
    }
    this.loadCategories();
  }

  resetFilters(): void {
    this.f = this.emptyFilters();
  }

  catalog(): void {
    this.busy.set('catalog');
    const params = { ...this.f, precios: this.withPrices ? 1 : '0', incluir_no_publicados: this.includeHidden };
    this.api.download(`exportar/catalogo/${this.catalogSet}`, params, `catalogo-${this.catalogSet}.pdf`).subscribe({
      next: () => this.busy.set(null),
      error: (e) => {
        this.busy.set(null);
        this.ui.apiError(e, 'No se pudo generar el PDF.');
      },
    });
  }

  private loadCategories(): void {
    this.api.categories(this.setType() as ProductType).subscribe((c) => this.categories.set(c));
  }

  private emptyFilters() {
    return {
      categoria: '',
      marca: '',
      estado: '',
      precio_min: null as number | null,
      precio_max: null as number | null,
      anio_min: null as number | null,
      anio_max: null as number | null,
      orden: 'destacados',
      titulo: '',
      solo_destacados: false,
      solo_ofertas: false,
      solo_con_foto: false,
    };
  }
}
