import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { SiteService } from '../../core/services/site.service';
import { PricePipe } from '../../shared/price.pipe';

@Component({
  selector: 'app-quote-cart',
  standalone: true,
  imports: [FormsModule, RouterLink, PricePipe],
  template: `
    <section class="r-page-head">
      <div class="r-page-head__inner r-container">
        <nav class="r-crumbs" aria-label="Ruta"><a routerLink="/">Inicio</a><span>/</span><span>Cotizador</span></nav>
        <span class="r-eyebrow">Cotizador</span>
        <h1 class="r-page-head__title">Armá tu <span>presupuesto</span></h1>
        <p class="r-page-head__text">Sumá motos, cascos y repuestos y te enviamos una cotización con las opciones de financiación.</p>
      </div>
    </section>

    <section class="r-container r-section">
      @if (sentNumber(); as number) {
        <div class="empty r-panel">
          <p class="r-success">¡Listo! Tu pedido <strong>{{ number }}</strong> quedó registrado y se abrió WhatsApp para enviarlo. Te respondemos por ahí.</p>
          <a routerLink="/" class="r-btn r-btn--red">Volver al inicio</a>
        </div>
      } @else if (cart.items().length === 0) {
        <div class="empty r-panel">
          <p>Tu cotizador está vacío. Recorré el catálogo y agregá los productos que te interesan.</p>
          <a routerLink="/motos" class="r-btn r-btn--red">Ver motos</a>
        </div>
      } @else {
        <div class="layout">
          <div class="r-panel table-wrap">
            <table class="table">
              <thead>
                <tr><th>Producto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th><th><span class="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                @for (item of cart.items(); track item.productId) {
                  <tr>
                    <td class="product">
                      @if (item.image) { <img [src]="item.image" alt="" /> }
                      <span>{{ item.name }}</span>
                    </td>
                    <td>
                      <input class="r-input qty" type="number" min="1" [ngModel]="item.quantity" (ngModelChange)="cart.updateQuantity(item.productId, $event)" [attr.aria-label]="'Cantidad de ' + item.name" />
                    </td>
                    <td>{{ item.price | price: item.currency }}</td>
                    <td class="strong">{{ item.price * item.quantity | price: item.currency }}</td>
                    <td><button type="button" class="remove" (click)="cart.remove(item.productId)">Quitar</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <aside class="summary r-panel">
            <div class="summary__total">
              <span>Total estimado</span>
              <strong>{{ cart.total() | price: 'ARS' }}</strong>
            </div>
            <form class="summary__form" (ngSubmit)="submit()">
              <p class="wa-hint">Te pasamos la cotización por WhatsApp: se abre el chat con la lista lista para enviar.</p>
              <label class="r-field">Tu nombre<input class="r-input" type="text" name="name" [(ngModel)]="form.name" required /></label>
              <label class="r-field">Comentario<textarea class="r-input" name="message" [(ngModel)]="form.message" rows="3" placeholder="Opcional: anticipo, usada para entregar, etc."></textarea></label>
              @if (error()) { <p class="form-error">{{ error() }}</p> }
              <button type="submit" class="r-btn r-btn--whatsapp" [disabled]="sending()">{{ sending() ? 'Enviando...' : 'Pedir cotización por WhatsApp' }}</button>
            </form>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [`
    .empty { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; font-size: 18px; }
    .empty p { margin: 0; max-width: 560px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 24px; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .table-wrap { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; min-width: 560px; }
    .table th, .table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid var(--r-line); vertical-align: middle; }
    .table th { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--r-muted); }
    .product { display: flex; align-items: center; gap: 12px; font-family: var(--r-display); font-weight: 700; font-size: 20px; text-transform: uppercase; }
    .product img { width: 64px; aspect-ratio: 16 / 10; object-fit: cover; }
    .qty { width: 84px; min-height: 42px; padding: 8px; }
    .strong { font-weight: 700; }
    .remove { background: none; border: 0; padding: 0; color: var(--r-red); font-weight: 600; }
    .summary { padding: 28px; display: flex; flex-direction: column; gap: 22px; position: sticky; top: 104px; }
    .summary__total { display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--r-line); padding-bottom: 18px; }
    .summary__total span { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--r-muted); }
    .summary__total strong { font-family: var(--r-display); font-weight: 800; font-size: 40px; color: var(--r-red); }
    .summary__form { display: flex; flex-direction: column; gap: 16px; }
    .wa-hint { margin: 0; color: var(--r-muted-2); line-height: 1.45; }
    .form-error { margin: 0; color: var(--r-red); font-weight: 600; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `],
})
export class QuoteCartComponent {
  cart = inject(CartService);
  sending = signal(false);
  sentNumber = signal<string | null>(null);
  error = signal('');
  private site = inject(SiteService);
  form = { name: '', message: '' };

  submit(): void {
    if (!this.form.name.trim()) {
      this.error.set('Ingresá tu nombre.');
      return;
    }
    this.error.set('');

    const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
    const money = (n: number, c: string) => `${c === 'USD' ? 'US$' : '$'} ${fmt.format(n)}`;
    const lines = this.cart.items().map((i) => `• ${i.quantity} x ${i.name} — ${money(i.price * i.quantity, i.currency)}`);
    const text = [
      `Hola, soy ${this.form.name.trim()}. Quiero cotizar:`,
      ...lines,
      `Total estimado: ${money(this.cart.total(), 'ARS')}`,
      this.form.message.trim() ? `Comentario: ${this.form.message.trim()}` : '',
    ].filter(Boolean).join('\n');

    // El chat se abre desde el clic (si no, el navegador lo bloquea) y el pedido se guarda en el panel.
    if (!this.site.openWhatsapp(text)) {
      this.error.set('Todavía no hay un WhatsApp configurado. Probá más tarde.');
      return;
    }

    this.sending.set(true);
    this.cart.submit({ name: this.form.name.trim(), message: this.form.message }).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.sentNumber.set(res.number);
        this.cart.clear();
      },
      error: () => {
        this.sending.set(false);
        this.error.set('No pudimos enviar la cotización. Revisá los datos y probá de nuevo.');
      },
    });
  }
}
