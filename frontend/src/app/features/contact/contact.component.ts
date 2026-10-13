import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SiteService } from '../../core/services/site.service';

const REASONS: Record<string, string> = {
  consulta: 'Consulta general',
  financiacion: 'Simulación de financiación',
  service: 'Turno de service',
  canje: 'Cotizar mi usada',
  repuestos: 'Repuestos y accesorios',
};

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>Contacto</span></nav>
        <span class="r-eyebrow">Visitanos</span>
        <h1 class="r-page-head__title">Hablemos de <span>tu próxima moto</span></h1>
        <p class="r-page-head__text">Escribinos, pedí una simulación de financiación o tu turno de service. Te respondemos en el día.</p>
      </div>
    </section>

    <section class="contact r-container">
      <div class="contact__info">
        <dl class="info">
          <div><dt>Showroom</dt><dd>{{ site.address() || 'Consultá la dirección por WhatsApp' }}</dd></div>
          <div><dt>Horarios</dt><dd>{{ site.settings()['business_hours'] || 'Lunes a viernes 9 a 19 h · Sábados 9 a 13 h' }}</dd></div>
          @if (site.phone()) { <div><dt>WhatsApp</dt><dd><a [href]="site.whatsappUrl() || site.phoneUrl()" target="_blank" rel="noopener">{{ site.phone() }}</a></dd></div> }
        </dl>
        @if (site.whatsappUrl()) {
          <a [href]="site.whatsappUrl()" target="_blank" rel="noopener" class="r-btn r-btn--whatsapp wa">Escribinos por WhatsApp</a>
        }
        <div class="why">
          <div><strong>Financiación</strong><span>Cuotas fijas y plan canje.</span></div>
          <div><strong>Taller propio</strong><span>Service para todas las marcas.</span></div>
        </div>
      </div>

      <form class="contact__form r-panel" (ngSubmit)="submit()" aria-label="Formulario de contacto">
        <h2 class="form__title">Escribinos por WhatsApp</h2>
        <p class="form__hint full">Completá estos datos y se abre WhatsApp con tu mensaje listo para enviar.</p>
        <label class="r-field">Motivo
          <select class="r-input" name="reason" [(ngModel)]="reason">
            @for (r of reasons; track r[0]) { <option [value]="r[0]">{{ r[1] }}</option> }
          </select>
        </label>
        <label class="r-field">Nombre<input class="r-input" type="text" name="name" [(ngModel)]="form.name" required /></label>
        <label class="r-field full">Mensaje<textarea class="r-input" name="message" [(ngModel)]="form.message" rows="5" placeholder="Contanos qué estás buscando"></textarea></label>
        @if (error()) { <p class="form-error full">{{ error() }}</p> }
        @if (sent()) { <p class="r-success full">¡Listo! Se abrió WhatsApp con tu mensaje. Si no se abrió, tocá el botón otra vez.</p> }
        <button type="submit" class="r-btn r-btn--whatsapp full submit">Enviar por WhatsApp</button>
      </form>
    </section>
  `,
  styles: [`
    .contact { padding-top: 64px; padding-bottom: 96px; display: flex; flex-wrap: wrap; gap: 48px; align-items: center; }
    .contact__info { flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 28px; }
    .info { margin: 0; display: flex; flex-direction: column; gap: 18px; font-size: 17px; }
    .info dt { font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--r-muted); }
    .info dd { margin: 4px 0 0; }
    .info a { color: var(--r-ink); text-decoration: none; }
    .info a:hover { color: var(--r-red); }
    .wa { padding: 16px 28px; }
    .why { display: flex; flex-direction: column; gap: 16px; align-self: stretch; }
    .why div { display: flex; flex-direction: column; align-items: center; gap: 4px; border-top: 3px solid var(--r-red); padding-top: 12px; }
    .why strong { font-family: var(--r-display); font-size: 22px; text-transform: uppercase; }
    .why span { color: var(--r-muted-2); }
    .contact__form { flex: 1 1 520px; min-width: 0; padding: 32px; text-align: center; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; }
    .form__title { grid-column: 1 / -1; margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 36px; line-height: 1; text-transform: uppercase; }
    .form__hint { grid-column: 1 / -1; margin: -6px 0 0; color: var(--r-muted-2); line-height: 1.45; }
    .contact__form .r-input { text-align: center; text-align-last: center; }
    .full { grid-column: 1 / -1; }
    .submit { min-height: 52px; }
    .form-error { margin: 0; color: var(--r-red); font-weight: 600; }
  `],
})
export class ContactComponent implements OnInit {
  private catalog = inject(CatalogService);
  private route = inject(ActivatedRoute);
  site = inject(SiteService);

  reasons = Object.entries(REASONS);
  reason = 'consulta';
  sending = signal(false);
  sent = signal(false);
  error = signal('');
  form = { name: '', message: '' };

  ngOnInit(): void {
    this.site.load();
    this.route.queryParamMap.subscribe((params) => {
      const motivo = params.get('motivo');
      if (motivo && REASONS[motivo]) this.reason = motivo;
    });
  }

  submit(): void {
    if (!this.form.name.trim()) {
      this.error.set('Ingresá tu nombre.');
      return;
    }
    this.error.set('');

    const text = [`Hola, soy ${this.form.name.trim()}.`, `Motivo: ${REASONS[this.reason]}`, this.form.message.trim()].filter(Boolean).join('\n');

    // Se abre el chat desde el clic (si no, el navegador lo bloquea) y la consulta queda en el panel.
    if (!this.site.openWhatsapp(text)) {
      this.error.set('Todavía no hay un WhatsApp configurado. Probá más tarde.');
      return;
    }
    this.sent.set(true);

    const source = this.reason === 'consulta' ? 'contacto' : this.reason;
    this.catalog.sendInquiry({ name: this.form.name.trim(), message: `[${REASONS[this.reason]}]\n${this.form.message}`.trim(), source }).subscribe({ error: () => undefined });
  }
}
