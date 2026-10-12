import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SiteService } from '../../core/services/site.service';
import { BrandRef, CategoryRef, Product } from '../../core/models/product.model';
import { MotoIconComponent } from '../../shared/moto-icon.component';
import { ProductCardComponent } from '../../shared/product-card.component';

type Condition = 'todas' | 'nueva' | 'usada';

const CATEGORY_TEXT: Record<string, string> = {
  adventure: 'Para viajar lejos, por ruta o ripio.',
  naked: 'Ágiles y directas para la ciudad.',
  deportiva: 'Rendimiento y carenado completo.',
  deportivas: 'Rendimiento y carenado completo.',
  custom: 'Estilo clásico y manejo relajado.',
  cruiser: 'Estilo clásico y manejo relajado.',
  enduro: 'Livianas, hechas para el off-road.',
  scooter: 'Prácticas y económicas para moverte.',
  scooters: 'Prácticas y económicas para moverte.',
  touring: 'Confort y equipamiento para la ruta.',
  scrambler: 'Look retro, para asfalto y tierra.',
};

const PRICE_RANGES = [2000000, 4000000, 8000000, 15000000];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule, ProductCardComponent, MotoIconComponent],
  template: `
    <!-- Hero -->
    <section class="hero">
      <div class="hero__inner r-container">
        <div class="hero__copy">
          <span class="r-eyebrow hero__eyebrow">Concesionario oficial · 0 km y usadas</span>
          <h1 class="r-h1">Tu próxima moto<br><span class="hero__accent">te está esperando.</span></h1>
          <p class="hero__text">{{ site.settings()['hero_text'] || 'Motos nuevas y usadas seleccionadas, financiación a tu medida y un taller que te acompaña después de la compra.' }}</p>
          <div class="hero__actions">
            <a routerLink="/motos" class="r-btn r-btn--red hero__btn">Ver catálogo</a>
            <a routerLink="/" fragment="usada" class="r-btn r-btn--outline-light">Cotizá tu usada</a>
          </div>
        </div>
        <div class="hero__media">
          <div class="hero__slash"></div>
          <div class="hero__photo" [class.hero__photo--img]="!!site.settings()['hero_image']">
            @if (site.settings()['hero_image']; as heroImage) {
              <img [src]="heroImage" alt="" />
            } @else {
              <app-moto-icon width="62%" color="#6B6E77" />
              <span class="hero__photo-tag">[FOTO DE PORTADA]</span>
            }
          </div>
        </div>
      </div>
    </section>

    <!-- Buscador -->
    <div class="finder r-container">
      <form class="finder__form" aria-label="Buscar motos" (ngSubmit)="search()">
        <div class="finder__head">
          <h2 class="finder__title"><i class="finder__mark" aria-hidden="true"></i>Encontrá tu moto</h2>
          <div class="finder__cond" role="radiogroup" aria-label="Condición">
            <button type="button" role="radio" [attr.aria-checked]="finder.condicion === ''" (click)="finder.condicion = ''">Todas</button>
            <button type="button" role="radio" [attr.aria-checked]="finder.condicion === 'nueva'" (click)="finder.condicion = 'nueva'">0 km</button>
            <button type="button" role="radio" [attr.aria-checked]="finder.condicion === 'usada'" (click)="finder.condicion = 'usada'">Usadas</button>
          </div>
        </div>
        <div class="finder__row">
        <label class="r-field">Tipo
          <select class="r-input" name="categoria" [(ngModel)]="finder.categoria">
            <option value="">Todos los tipos</option>
            @for (c of categories(); track c.id) { <option [value]="c.slug">{{ c.name }}</option> }
          </select>
        </label>
        <label class="r-field">Marca
          <select class="r-input" name="marca" [(ngModel)]="finder.marca">
            <option value="">Todas las marcas</option>
            @for (b of brands(); track b.id) { <option [value]="b.slug">{{ b.name }}</option> }
          </select>
        </label>
        <label class="r-field">Precio hasta
          <select class="r-input" name="precio_max" [(ngModel)]="finder.precio_max">
            <option value="">Sin límite</option>
            @for (r of priceRanges; track r) { <option [value]="r">$ {{ formatNumber(r) }}</option> }
          </select>
        </label>
        <button type="submit" class="r-btn r-btn--red finder__btn">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
          Buscar
        </button>
        </div>
      </form>
    </div>

    <!-- Categorías -->
    @if (categories().length) {
      <section class="cats r-container">
        <div class="section-head">
          <h2 class="r-h2">Elegí tu estilo</h2>
          <a routerLink="/motos" class="section-link">Ver todas las categorías →</a>
        </div>
        <div class="cats__grid">
          @for (c of categories(); track c.id) {
            <a class="cat" routerLink="/motos" [queryParams]="{ categoria: c.slug }">
              @if (c.image_path) {
                <img class="cat__img" [src]="c.image_path" [alt]="c.name" loading="lazy" />
              } @else {
                <app-moto-icon width="80" height="44" color="#C8102E" [strokeWidth]="7" [detailed]="false" />
              }
              <span class="cat__name">{{ c.name }}</span>
              <span class="cat__text">{{ categoryText(c) }}</span>
            </a>
          }
        </div>
      </section>
    }

    <!-- Destacadas -->
    <section id="destacadas" class="featured r-container">
      <div class="section-head">
        <div class="section-head__titles">
          <span class="r-eyebrow">Stock disponible</span>
          <h2 class="r-h2">Motos destacadas</h2>
        </div>
        <div role="tablist" aria-label="Filtrar por condición" class="r-tabs">
          <button type="button" role="tab" class="r-tab" [attr.aria-selected]="tab() === 'todas'" (click)="tab.set('todas')">Todas</button>
          <button type="button" role="tab" class="r-tab" [attr.aria-selected]="tab() === 'nueva'" (click)="tab.set('nueva')">0 km</button>
          <button type="button" role="tab" class="r-tab" [attr.aria-selected]="tab() === 'usada'" (click)="tab.set('usada')">Usadas</button>
        </div>
      </div>
      @if (loadingFeatured()) {
        <p class="r-status">Cargando stock...</p>
      } @else if (visibleFeatured().length === 0) {
        <p class="r-status">No hay motos destacadas en esta categoría por ahora.</p>
      } @else {
        <div class="r-grid-cards">
          @for (product of visibleFeatured(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      }
      <div class="center">
        <a routerLink="/motos" [queryParams]="tab() === 'todas' ? {} : { condicion: tab() }" class="r-btn r-btn--outline">Ver todo el stock</a>
      </div>
    </section>

    <!-- Financiación -->
    <section id="financiacion" class="finance">
      <div class="finance__inner r-container">
        <div class="finance__copy">
          <span class="r-eyebrow finance__eyebrow">Financiación</span>
          <h2 class="finance__title">Llevátela hoy,<br>pagala en cuotas.</h2>
          <p class="finance__text">Planes con bancos y financieras, cuotas fijas y opción de entregar tu usada como parte de pago.{{ site.settings()['financing_details'] ? ' ' + site.settings()['financing_details'] : '' }}</p>
          <div>
            <a routerLink="/contacto" [queryParams]="{ motivo: 'financiacion' }" class="r-btn r-btn--white finance__btn">Pedir simulación</a>
          </div>
        </div>
        <ol class="finance__steps">
          <li><span class="step__num">01</span><strong>Elegí tu moto</strong><span>0 km o usada, del stock o por pedido.</span></li>
          <li><span class="step__num">02</span><strong>Simulá la cuota</strong><span>Te armamos el plan según tu anticipo.</span></li>
          <li><span class="step__num">03</span><strong>Aprobación</strong><span>Presentás la documentación y te avisamos.</span></li>
          <li><span class="step__num">04</span><strong>Retirala</strong><span>Patentada, con service de entrega incluido.</span></li>
        </ol>
      </div>
    </section>

    <!-- Tomamos tu usada -->
    <section id="usada" class="tradein r-container">
      <div class="tradein__copy">
        <span class="r-eyebrow">Plan canje</span>
        <h2 class="r-h2">Tomamos tu usada</h2>
        <p class="r-lead">Contanos qué moto tenés y te pasamos una cotización. Si te conviene, la usamos como parte de pago de la nueva.</p>
        <ul class="checks">
          <li><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8102E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"></path></svg>Peritaje en el local, sin cargo</li>
          <li><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8102E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"></path></svg>Nos ocupamos de la transferencia</li>
          <li><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8102E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"></path></svg>Combinable con financiación</li>
        </ul>
      </div>
      <form class="tradein__form r-panel" aria-label="Cotizar mi usada" (ngSubmit)="sendTradeIn()">
        <label class="r-field">Marca<input class="r-input" type="text" name="brand" [(ngModel)]="tradeIn.brand" placeholder="Ej.: Honda" /></label>
        <label class="r-field">Modelo<input class="r-input" type="text" name="model" [(ngModel)]="tradeIn.model" placeholder="Ej.: CB 250 Twister" /></label>
        <label class="r-field">Año<input class="r-input" type="number" name="year" [(ngModel)]="tradeIn.year" placeholder="Ej.: 2021" /></label>
        <label class="r-field">Kilómetros<input class="r-input" type="number" name="km" [(ngModel)]="tradeIn.km" placeholder="Ej.: 12000" /></label>
        <label class="r-field full">Tu nombre<input class="r-input" type="text" name="name" [(ngModel)]="tradeIn.name" required /></label>
        @if (tradeInError()) { <p class="form-error full">{{ tradeInError() }}</p> }
        @if (tradeInSent()) { <p class="r-success full">¡Listo! Se abrió WhatsApp con los datos de tu moto. Si no se abrió, tocá el botón otra vez.</p> }
        <button type="submit" class="r-btn r-btn--whatsapp full tradein__btn">Pedir cotización por WhatsApp</button>
      </form>
    </section>

    <!-- Por qué elegirnos -->
    <section class="why">
      <div class="why__inner r-container">
        <h2 class="r-h2">Por qué comprar con nosotros</h2>
        <div class="why__grid">
          <div class="why__item">
            <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF5A6E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"></path><path d="M8.5 12l2.5 2.5 4.5-5"></path></svg>
            <h3 class="r-h3">Garantía oficial</h3>
            <p>0 km con garantía de fábrica y usadas revisadas en nuestro taller antes de la venta.</p>
          </div>
          <div class="why__item">
            <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF5A6E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"></path></svg>
            <h3 class="r-h3">Taller propio</h3>
            <p>Service oficial con técnicos capacitados y repuestos originales.</p>
          </div>
          <div class="why__item">
            <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF5A6E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"></rect><path d="M8 9h8M8 13h8M8 17h5"></path></svg>
            <h3 class="r-h3">Trámites resueltos</h3>
            <p>Patentamiento, seguro y transferencia: te la entregamos lista para rodar.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Service y accesorios -->
    <section id="service" class="duo r-container">
      <div class="duo__card r-panel">
        <div class="duo__photo">
          @if (site.settings()['service_image']; as img) { <img [src]="img" alt="" /> } @else { [FOTO DEL TALLER] }
        </div>
        <div class="duo__body">
          <h2 class="duo__title">Service y mantenimiento</h2>
          <p>Services programados, diagnóstico y reparaciones para todas las marcas. Pedí tu turno y retirala el mismo día.</p>
          <a routerLink="/contacto" [queryParams]="{ motivo: 'service' }" class="r-btn r-btn--red duo__btn">Pedir turno</a>
        </div>
      </div>
      <div class="duo__card r-panel">
        <div class="duo__photo">
          @if (site.settings()['accessories_image']; as img) { <img [src]="img" alt="" /> } @else { [FOTO DE INDUMENTARIA] }
        </div>
        <div class="duo__body">
          <h2 class="duo__title">Repuestos y accesorios</h2>
          <p>Cascos, camperas, guantes, valijas y repuestos originales. Consultá stock o encargá lo que necesites.</p>
          <a routerLink="/repuestos" class="r-btn r-btn--outline duo__btn">Ver tienda</a>
        </div>
      </div>
    </section>

    <!-- Marcas -->
    @if (brands().length) {
      <!-- Como en SH: grilla de logos que se adapta sola a la cantidad de marcas -->
      <section class="brands">
        <div class="brands__inner r-container">
          <div class="section-head">
            <div class="section-head__titles">
              <span class="r-eyebrow">Marcas</span>
              <h2 class="r-h2">Con las que trabajamos</h2>
            </div>
          </div>
          <div class="brand-strip">
            @for (b of brands(); track b.id) {
              <a class="brand-cell" routerLink="/motos" [queryParams]="{ marca: b.slug }" [title]="b.name">
                @if (b.logo_path) {
                  <img [src]="b.logo_path" [alt]="b.name" loading="lazy" />
                } @else {
                  <span>{{ b.name }}</span>
                }
              </a>
            }
          </div>
        </div>
      </section>
    }

    <!-- Contacto -->
    <section id="contacto" class="visit r-container">
      <div class="visit__copy">
        <span class="r-eyebrow">Visitanos</span>
        <h2 class="r-h2">Vení a conocerlas</h2>
        <dl class="visit__list">
          <div><dt>Showroom</dt><dd>{{ site.address() || 'Consultá la dirección por WhatsApp' }}</dd></div>
          <div><dt>Horarios</dt><dd>{{ site.settings()['business_hours'] || 'Lunes a viernes 9 a 19 h · Sábados 9 a 13 h' }}</dd></div>
          @if (site.phone()) { <div><dt>WhatsApp</dt><dd><a [href]="site.whatsappUrl() || site.phoneUrl()" target="_blank" rel="noopener">{{ site.phone() }}</a></dd></div> }
        </dl>
        @if (site.whatsappUrl()) {
          <a [href]="site.whatsappUrl()" target="_blank" rel="noopener" class="r-btn r-btn--whatsapp visit__btn">Escribinos por WhatsApp</a>
        } @else {
          <a routerLink="/contacto" class="r-btn r-btn--whatsapp visit__btn">Escribinos</a>
        }
      </div>
      <div class="visit__map">
        @if (mapUrl(); as url) {
          <iframe [src]="url" title="Mapa del showroom" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        } @else {
          <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="#C8102E" stroke="none"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"></path></svg>
          <span class="visit__map-tag">[MAPA]</span>
        }
      </div>
    </section>
  `,
  styles: [`
    /* Hero */
    .hero { background: var(--r-ink); color: #FFFFFF; position: relative; overflow: hidden; }
    .hero__inner { padding-top: 72px; padding-bottom: 140px; display: flex; flex-wrap: wrap; gap: 48px; align-items: center; }
    .hero__copy { flex: 1 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 24px; }
    .hero__eyebrow { font-size: 18px; color: var(--r-red-soft); }
    .hero__accent { color: var(--r-red); }
    .hero__text { margin: 0; font-size: 20px; line-height: 1.55; color: #C9CBD1; max-width: 520px; white-space: pre-line; }
    .hero__actions { display: flex; flex-wrap: wrap; gap: 14px; }
    .hero__btn { padding: 16px 30px; }
    .hero__media { flex: 1 1 520px; min-width: 0; position: relative; }
    .hero__slash { position: absolute; inset: 8% -20% 8% 10%; background: var(--r-red); transform: skewX(-12deg); }
    .hero__photo { position: relative; aspect-ratio: 4 / 3; background: var(--r-ink-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 1px solid #34363E; overflow: hidden; }
    /* Con imagen cargada el recuadro toma la proporción de la foto: se ve entera, sin recortes. */
    .hero__photo--img { aspect-ratio: auto; background: #FFFFFF; }
    .hero__photo--img img { position: static; display: block; width: 100%; height: auto; max-height: 640px; object-fit: contain; }
    .hero__photo-tag { font-family: var(--r-display); font-size: 16px; letter-spacing: 0.18em; color: var(--r-grey); }

    /* Buscador */
    .finder { margin-top: -84px; position: relative; }
    .finder__form { background: #FFFFFF; border-top: 4px solid var(--r-red); box-shadow: 0 24px 50px rgba(13,14,17,0.16); padding: 24px 28px 28px; display: flex; flex-direction: column; gap: 20px; }
    .finder__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 24px; padding-bottom: 18px; border-bottom: 1px solid var(--r-line); }
    .finder__title { margin: 0; display: flex; align-items: center; gap: 12px; font-family: var(--r-display); font-weight: 800; font-size: 28px; line-height: 1; text-transform: uppercase; letter-spacing: 0.02em; }
    .finder__mark { width: 10px; height: 26px; background: var(--r-red); transform: skewX(-12deg); display: inline-block; }
    .finder__cond { display: inline-flex; border: 2px solid var(--r-ink); }
    .finder__cond button { border: 0; background: transparent; color: var(--r-ink); min-height: 40px; padding: 0 20px; font-family: var(--r-display); font-weight: 700; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
    .finder__cond button[aria-checked="true"] { background: var(--r-ink); color: #FFFFFF; }
    .finder__cond button:hover:not([aria-checked="true"]) { background: var(--r-paper); }
    .finder__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 16px; align-items: end; }
    .finder__btn { min-height: 48px; padding: 0 34px; gap: 10px; }
    @media (max-width: 860px) {
      .finder__row { grid-template-columns: 1fr 1fr; }
      .finder__btn { grid-column: 1 / -1; }
    }
    @media (max-width: 520px) {
      .finder__form { padding: 20px 18px 22px; }
      .finder__row { grid-template-columns: 1fr; }
      .finder__cond { width: 100%; }
      .finder__cond button { flex: 1; padding: 0 10px; }
    }

    /* Encabezados de sección */
    .section-head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px 20px; }
    .section-head__titles { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .section-link { font-weight: 600; font-size: 17px; }
    .center { display: flex; justify-content: center; }

    /* Categorías */
    .cats { padding-top: 96px; padding-bottom: 40px; display: flex; flex-direction: column; gap: 32px; }
    .cats__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .cat { background: #FFFFFF; border: 1px solid var(--r-line); color: var(--r-ink); text-decoration: none; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; min-height: 170px; transition: border-color .15s, transform .15s; }
    .cat:hover { color: var(--r-ink); border-color: var(--r-red); transform: translateY(-2px); }
    /* La imagen de la categoría se ve como ícono: alto fijo, sin recortar ni estirar la tarjeta. */
    .cat__img { display: block; height: 64px; width: auto; max-width: 100%; object-fit: contain; object-position: center; }
    .cat__name { font-family: var(--r-display); font-weight: 700; font-size: 26px; text-transform: uppercase; letter-spacing: 0.03em; }
    .cat__text { font-size: 15px; color: var(--r-muted-2); line-height: 1.4; }

    /* Destacadas */
    .featured { padding-top: 56px; padding-bottom: 96px; display: flex; flex-direction: column; gap: 32px; }

    /* Financiación */
    .finance { background: var(--r-red); color: #FFFFFF; }
    .finance__inner { padding-top: 80px; padding-bottom: 80px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 48px; align-items: center; }
    .finance__copy { min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px; }
    .finance__eyebrow { color: #FFFFFF; }
    /* Siempre en dos renglones: "Llevátela hoy," / "pagala en cuotas." */
    .finance__title { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: clamp(34px, 3.4vw, 56px); line-height: 0.95; text-transform: uppercase; white-space: nowrap; }
    .finance__steps li { text-align: center; align-items: center; }
    .finance__text { margin: 0; font-size: 19px; line-height: 1.55; max-width: 480px; }
    .finance__btn { padding: 16px 30px; }
    .finance__steps { min-width: 0; margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-self: stretch; align-content: center; }
    .finance__steps li { background: var(--r-red-deep); padding: 24px 20px; display: flex; flex-direction: column; gap: 10px; line-height: 1.5; }
    .finance__steps strong { font-size: 19px; }
    @media (max-width: 1100px) { .finance__inner { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .finance__steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 420px) { .finance__steps { grid-template-columns: 1fr; } }
    .step__num { font-family: var(--r-display); font-weight: 800; font-size: 44px; line-height: 1; }

    /* Canje */
    .tradein { padding-top: 96px; padding-bottom: 96px; display: flex; flex-wrap: wrap; gap: 56px; align-items: stretch; }
    .tradein__copy { flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 18px; }
    .checks { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 17px; }
    .checks li { display: flex; gap: 12px; align-items: center; }
    .tradein__form { flex: 1 1 520px; min-width: 0; padding: 32px; text-align: center; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; }
    .tradein__form .r-input { text-align: center; }
    .full { grid-column: 1 / -1; }
    .tradein__btn { min-height: 52px; }
    .form-error { margin: 0; color: var(--r-red); font-weight: 600; }

    /* Por qué */
    .why { background: var(--r-ink); color: #FFFFFF; }
    .why__inner { padding-top: 88px; padding-bottom: 88px; display: flex; flex-direction: column; gap: 44px; text-align: center; }
    .why__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; }
    .why__item { display: flex; flex-direction: column; align-items: center; gap: 14px; border-top: 3px solid var(--r-red); padding-top: 22px; }
    .why__item p { margin: 0; color: #C9CBD1; line-height: 1.55; max-width: 340px; }

    /* Service / accesorios */
    .duo { padding-top: 96px; padding-bottom: 96px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 24px; }
    .duo__card { display: flex; flex-direction: column; }
    .duo__photo { position: relative; aspect-ratio: 16 / 7; background: var(--r-photo); display: flex; align-items: center; justify-content: center; font-size: 13px; letter-spacing: 0.16em; color: var(--r-muted); overflow: hidden; }
    .duo__photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .duo__body { padding: 32px; display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; }
    .duo__body p { margin: 0; font-size: 17px; line-height: 1.55; color: var(--r-text-2); }
    .duo__title { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 40px; line-height: 1; text-transform: uppercase; }
    .duo__btn { font-size: 18px; padding: 12px 24px; }

    /* Marcas */
    .brands { border-top: 1px solid var(--r-line); border-bottom: 1px solid var(--r-line); background: #FFFFFF; }
    .brands__inner { padding-top: 80px; padding-bottom: 80px; display: flex; flex-direction: column; gap: 32px; }
    /* Flex + wrap: cada marca nueva cae abajo y la última fila se estira para llenar el ancho. */
    .brand-strip { display: flex; flex-wrap: wrap; gap: 1px; background: var(--r-line); border: 1px solid var(--r-line); }
    .brand-cell { flex: 1 1 calc(25% - 1px); min-height: 140px; padding: 18px 16px; display: grid; place-items: center; background: #FFFFFF; text-decoration: none; transition: background .15s; position: relative; }
    .brand-cell::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--r-red); transform: scaleX(0); transition: transform .2s; }
    .brand-cell:hover { background: var(--r-paper); }
    .brand-cell:hover::after { transform: scaleX(1); }
    .brand-cell img { max-height: 78px; max-width: 80%; width: auto; object-fit: contain; filter: grayscale(1); opacity: .7; transition: filter .2s, opacity .2s; }
    .brand-cell:hover img { filter: none; opacity: 1; }
    .brand-cell span { font-family: var(--r-display); font-weight: 800; font-size: clamp(22px, 2.6vw, 32px); line-height: 1.05; letter-spacing: 0.04em; text-transform: uppercase; text-align: center; color: var(--r-muted); overflow-wrap: anywhere; transition: color .15s; }
    .brand-cell:hover span { color: var(--r-ink); }
    @media (max-width: 991px) { .brand-cell { flex-basis: calc(33.333% - 1px); } }
    @media (max-width: 640px) { .brand-cell { flex-basis: calc(50% - 1px); min-height: 110px; } .brands__inner { padding-top: 56px; padding-bottom: 56px; } }

    /* Visitanos */
    .visit { padding-top: 96px; padding-bottom: 96px; display: flex; flex-wrap: wrap; gap: 48px; }
    .visit__copy { flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 22px; }
    .visit__list { margin: 0; display: flex; flex-direction: column; gap: 18px; font-size: 17px; }
    .visit__list dt { font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--r-muted); }
    .visit__list dd { margin: 4px 0 0; }
    .visit__list a { color: var(--r-ink); text-decoration: none; }
    .visit__list a:hover { color: var(--r-red); }
    .visit__btn { padding: 16px 28px; }
    .visit__map { flex: 1 1 520px; min-width: 0; min-height: 380px; background: #E2E1DC; border: 1px solid #D3D2CD; position: relative; display: flex; align-items: center; justify-content: center; }
    .visit__map iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .visit__map-tag { position: absolute; bottom: 14px; left: 16px; font-size: 13px; letter-spacing: 0.16em; color: var(--r-muted); }

    @media (max-width: 640px) {
      .finance__title { font-size: clamp(28px, 9vw, 44px); }
      .hero__inner { padding-top: 48px; }
    }
  `],
})
export class HomeComponent implements OnInit {
  private catalog = inject(CatalogService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  site = inject(SiteService);

  priceRanges = PRICE_RANGES;

  featured = signal<Product[]>([]);
  loadingFeatured = signal(true);
  categories = signal<CategoryRef[]>([]);
  brands = signal<BrandRef[]>([]);
  tab = signal<Condition>('todas');

  visibleFeatured = computed(() => {
    const tab = this.tab();
    if (tab === 'todas') return this.featured();
    return this.featured().filter((p) => {
      const condition = (p.moto as { condition_type?: string } | undefined)?.condition_type;
      if (!condition) return false;
      return tab === 'nueva' ? condition === 'nueva' : condition !== 'nueva';
    });
  });

  mapUrl = computed<SafeResourceUrl | null>(() => {
    const address = this.site.address();
    if (!address) return null;
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  finder = { condicion: '', categoria: '', marca: '', precio_max: '' };

  tradeIn = { brand: '', model: '', year: '', km: '', name: '' };
  tradeInSending = signal(false);
  tradeInSent = signal(false);
  tradeInError = signal('');

  ngOnInit(): void {
    this.site.load();
    this.catalog.featured().subscribe({
      next: (res) => {
        const motos = res.data.filter((p) => p.type === 'moto');
        this.featured.set(motos.length ? motos : res.data);
        this.loadingFeatured.set(false);
      },
      error: () => this.loadingFeatured.set(false),
    });
    this.catalog.categories('moto').subscribe((c) => this.categories.set(c));
    this.catalog.brands().subscribe((b) => this.brands.set(b));
  }

  categoryText(c: CategoryRef): string {
    return CATEGORY_TEXT[c.slug] ?? `Mirá todas las motos ${c.name.toLowerCase()} en stock.`;
  }

  formatNumber(n: number): string {
    return new Intl.NumberFormat('es-AR').format(n);
  }

  search(): void {
    const queryParams: Record<string, string> = {};
    Object.entries(this.finder).forEach(([key, value]) => {
      if (value) queryParams[key] = String(value);
    });
    this.router.navigate(['/motos'], { queryParams });
  }

  sendTradeIn(): void {
    const t = this.tradeIn;
    if (!t.name.trim()) {
      this.tradeInError.set('Escribí tu nombre.');
      return;
    }
    this.tradeInError.set('');

    const details = [
      `Marca: ${t.brand || '-'}`,
      `Modelo: ${t.model || '-'}`,
      `Año: ${t.year || '-'}`,
      `Kilómetros: ${t.km || '-'}`,
    ];

    // El chat se abre desde el clic (si no, el navegador lo bloquea); la consulta queda en el panel.
    if (!this.site.openWhatsapp([`Hola, soy ${t.name.trim()}. Quiero cotizar mi moto usada (plan canje):`, ...details].join('\n'))) {
      this.tradeInError.set('Todavía no hay un WhatsApp configurado. Probá más tarde.');
      return;
    }
    this.tradeInSent.set(true);
    this.catalog.sendInquiry({ name: t.name.trim(), message: ['Cotización de usada (plan canje)', ...details].join('\n'), source: 'canje' }).subscribe({ error: () => undefined });
  }
}
